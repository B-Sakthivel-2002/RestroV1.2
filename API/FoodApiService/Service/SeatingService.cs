using FoodApiService.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FoodApiService.Service;

public class WaitlistSettings
{
    // Hold a free table for the next waiting token automatically (the captain can still change it).
    public bool AutoAssign { get; set; } = true;

    // Rough wait shown to customers: parties ahead x this, per suitable table.
    public int MinutesPerParty { get; set; } = 10;

    // A held (Called) table is flagged as overdue after this many minutes.
    public int HoldMinutes { get; set; } = 10;

    // When no single free table seats the party, let the system combine 2 or 3 free tables of one floor.
    // Captains can always combine tables by hand.
    public bool AutoCombineTables { get; set; } = true;
}

// Where a party sits: one table, or a main table with extra tables of the same floor combined into it.
public record TablePlan(Table Main, List<Table> Extras)
{
    public IEnumerable<Table> Tables => Extras.Prepend(Main);
    public int Capacity => Tables.Sum(t => t.Capacity);
    public string Names => string.Join(" + ", Tables.Select(t => t.Tablename));
}

// Table seating rules shared by the waitlist, the table board and billing.
//
// Effective state of a table:
//   open orders (submitted / printed)  -> Occupied
//   held for a Called token            -> Reserved
//   otherwise                          -> the stored Tablestate
public class SeatingService
{
    public const string WaitlistChanged = "WaitlistChanged";

    private static readonly string[] OpenOrderStatuses = { "submitted", "printed" };

    private readonly HotelContext _context;
    private readonly IHubContext<KOTNotificationHub> _hub;
    private readonly EmailService _email;
    private readonly WaitlistSettings _settings;
    private readonly ILogger<SeatingService> _logger;

    public SeatingService(HotelContext context, IHubContext<KOTNotificationHub> hub, EmailService email, IConfiguration configuration, ILogger<SeatingService> logger)
    {
        _logger = logger;
        _context = context;
        _hub = hub;
        _email = email;
        _settings = configuration.GetSection("WaitlistSettings").Get<WaitlistSettings>() ?? new WaitlistSettings();
    }

    public WaitlistSettings Settings => _settings;

    public IQueryable<int> OpenOrderTableIds(int branchId) =>
        _context.Orders
            .Where(o => o.Branchid == branchId && o.Tableid != null && OpenOrderStatuses.Contains(o.Status))
            .Select(o => o.Tableid!.Value);

    public IQueryable<int> HeldTableIds(int branchId) =>
        _context.WaitlistTokens
            .Where(t => t.Branchid == branchId && t.Status == TokenStatus.Called && t.Tableid != null)
            .Select(t => t.Tableid!.Value);

    public Task<bool> HasOpenOrdersAsync(int tableId) =>
        _context.Orders.AnyAsync(o => o.Tableid == tableId && OpenOrderStatuses.Contains(o.Status));

    // Active, Available tables with no open orders, no hold and no merge link (either way).
    private IQueryable<Table> FreeTables(int branchId)
    {
        var busy = OpenOrderTableIds(branchId);
        var held = HeldTableIds(branchId);
        return _context.Tables
            .Where(t => t.Branchid == branchId && t.Status == true
                        && t.Tablestate == TableStates.Available
                        && t.Mergedinto == null
                        && !_context.Tables.Any(c => c.Mergedinto == t.Tableid)
                        && !busy.Contains(t.Tableid)
                        && !held.Contains(t.Tableid));
    }

    // Smallest free, active table that seats the party; null when none is free.
    public Task<Table?> FindBestTableAsync(int branchId, int guests) =>
        FreeTables(branchId)
            .Where(t => t.Capacity >= guests)
            .OrderBy(t => t.Capacity).ThenBy(t => t.Tablename)
            .FirstOrDefaultAsync();

    // Fewest free tables of one floor that together seat the party (2, then 3), with the fewest spare seats.
    // The biggest table of the set is the main one; null when no such set exists.
    public async Task<TablePlan?> FindBestCombinationAsync(int branchId, int guests)
    {
        var free = await FreeTables(branchId).ToListAsync();
        foreach (int size in new[] { 2, 3 })
        {
            List<Table>? best = null;
            int bestSpare = int.MaxValue;
            foreach (var floor in free.GroupBy(t => t.Floorid))
            {
                var tables = floor.OrderByDescending(t => t.Capacity).ThenBy(t => t.Tablename).Take(25).ToList();
                foreach (var set in Combinations(tables, size))
                {
                    int spare = set.Sum(t => t.Capacity) - guests;
                    if (spare >= 0 && spare < bestSpare)
                    {
                        best = set;
                        bestSpare = spare;
                    }
                }
            }
            if (best != null)
                return new TablePlan(best[0], best.Skip(1).ToList());
        }
        return null;
    }

    private static IEnumerable<List<Table>> Combinations(List<Table> tables, int size, int start = 0)
    {
        if (size == 0)
        {
            yield return new List<Table>();
            yield break;
        }
        for (int i = start; i <= tables.Count - size; i++)
            foreach (var rest in Combinations(tables, size - 1, i + 1))
            {
                rest.Insert(0, tables[i]);
                yield return rest;
            }
    }

    // The system's pick for a party: one table, or (AutoCombineTables) tables combined on one floor.
    public async Task<TablePlan?> FindBestPlanAsync(int branchId, int guests)
    {
        var table = await FindBestTableAsync(branchId, guests);
        if (table != null)
            return new TablePlan(table, new List<Table>());
        return _settings.AutoCombineTables ? await FindBestCombinationAsync(branchId, guests) : null;
    }

    // Why a table cannot be given to a token, or null when it can.
    // combinedWith: main tables this one may already be combined into (the token's own tables).
    public async Task<string?> CannotHoldReasonAsync(Table table, int guests, int? exceptTokenId = null, ICollection<int>? combinedWith = null)
    {
        if (table.Status != true)
            return "Table is inactive";
        if (table.Mergedinto != null && (combinedWith == null || !combinedWith.Contains(table.Mergedinto.Value)))
            return "Table is merged with another table";
        if (table.Tablestate != TableStates.Available && table.Tablestate != TableStates.Reserved)
            return $"Table is {table.Tablestate}";
        if (await HasOpenOrdersAsync(table.Tableid))
            return "Table has open orders";
        if (await _context.WaitlistTokens.AnyAsync(t => t.Tableid == table.Tableid && t.Status == TokenStatus.Called && t.Tokenid != exceptTokenId))
            return "Table is already held for another token";
        if (table.Capacity < guests)
            return $"Table seats {table.Capacity}, party is {guests}";
        return null;
    }

    // Why these tables cannot seat the party together, or null when they can.
    public async Task<string?> CannotHoldReasonAsync(TablePlan plan, int guests, int? exceptTokenId = null)
    {
        // Tables the token already holds (its main table and the ones combined into it) may be re-picked.
        int? ownMain = exceptTokenId == null ? null : await _context.WaitlistTokens
            .Where(t => t.Tokenid == exceptTokenId && t.Status == TokenStatus.Called).Select(t => t.Tableid).FirstOrDefaultAsync();
        var combinedWith = new List<int> { plan.Main.Tableid };
        if (ownMain.HasValue)
            combinedWith.Add(ownMain.Value);

        if (plan.Extras.Count == 0)
            return await CannotHoldReasonAsync(plan.Main, guests, exceptTokenId, combinedWith);

        if (plan.Tables.Any(t => t.Floorid != plan.Main.Floorid))
            return "Combined tables must be on the same floor";
        var planIds = plan.Tables.Select(t => t.Tableid).ToList();
        if (plan.Main.Tableid != ownMain
            && await _context.Tables.AnyAsync(t => t.Mergedinto == plan.Main.Tableid && !planIds.Contains(t.Tableid)))
            return $"{plan.Main.Tablename} has other tables merged into it";
        foreach (var table in plan.Tables)
        {
            string? reason = await CannotHoldReasonAsync(table, 0, exceptTokenId, combinedWith);
            if (reason != null)
                return table.Tablename + ": " + reason;
        }
        if (plan.Capacity < guests)
            return $"Tables seat {plan.Capacity}, party is {guests}";
        return null;
    }

    // Links the extra tables to the main one (mergedinto) and gives them the main table's state;
    // tables combined before (with the previous main table, or dropped from the set) are freed.
    public async Task CombineAsync(WaitlistToken token, int? previousMainId, TablePlan plan, string extraState, int? userId)
    {
        var keep = plan.Extras.Select(t => t.Tableid).ToHashSet();
        var mains = new[] { previousMainId, plan.Main.Tableid }.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var linked = await _context.Tables.Where(t => t.Mergedinto != null && mains.Contains(t.Mergedinto.Value)).ToListAsync();
        foreach (var table in linked.Where(t => !(t.Mergedinto == plan.Main.Tableid && keep.Contains(t.Tableid))))
        {
            table.Mergedinto = null;
            SetState(table, TableStates.Available, userId, TableEvents.Unmerged, token.Tokenid, $"{token.Tokencode} no longer uses this table");
        }
        foreach (var table in plan.Extras)
        {
            if (table.Mergedinto != plan.Main.Tableid)
            {
                table.Mergedinto = plan.Main.Tableid;
                AddHistory(table.Tableid, table.Branchid, table.Outletid, TableEvents.Merged, userId, tokenId: token.Tokenid,
                    relatedTableId: plan.Main.Tableid, notes: $"Combined with {plan.Main.Tablename} for {token.Tokencode} ({token.Guests} guests)");
            }
            SetState(table, extraState, userId, TableEvents.StateChanged, token.Tokenid);
        }
    }

    // Holds the table for the token (status Called). Returns false when another request
    // took the table first (unique index ux_waitlist_token_table_held).
    public async Task<bool> TryHoldAsync(WaitlistToken token, TablePlan plan, string mode, int? userId)
    {
        var table = plan.Main;
        int? previousTable = token.Status == TokenStatus.Called ? token.Tableid : null;
        await CombineAsync(token, previousTable, plan, TableStates.Reserved, userId);

        token.Status = TokenStatus.Called;
        token.Tableid = table.Tableid;
        token.Assignmode = mode;
        token.Calledat = DateTime.Now;
        token.Updatedby = userId;

        if (previousTable.HasValue && previousTable != table.Tableid)
            AddHistory(previousTable.Value, token.Branchid, token.Outletid, TableEvents.TokenReleased, userId, tokenId: token.Tokenid,
                notes: $"{token.Tokencode} moved to {table.Tablename}");
        AddHistory(table.Tableid, token.Branchid, token.Outletid, TableEvents.TokenAssigned, userId, tokenId: token.Tokenid,
            notes: $"{token.Tokencode} ({token.Guests} guests) - {mode}" + (plan.Extras.Count > 0 ? $" with {plan.Names}" : ""));

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            _context.ChangeTracker.Clear();
            return false;
        }

        _email.SendTableReady(token, table, await BranchNameAsync(token.Branchid));
        return true;
    }

    public async Task<string> BranchNameAsync(int? branchId) =>
        await _context.Branches.AsNoTracking().Where(b => b.Branchid == branchId).Select(b => b.Branchname).FirstOrDefaultAsync() ?? "";

    // Gives free tables to waiting tokens in arrival order (a party that does not fit is skipped,
    // so a smaller party behind it can be seated). Runs only when AutoAssign is on.
    public async Task<int> AutoAssignAsync(int branchId, int? userId)
    {
        if (!_settings.AutoAssign)
            return 0;

        // Today's and yesterday's tokens, so a queue survives midnight.
        var since = DateOnly.FromDateTime(DateHelper.GetBusinessDate(DateTime.Now)).AddDays(-1);
        int assigned = 0;
        var waiting = await _context.WaitlistTokens
            .Where(t => t.Branchid == branchId && t.Bizdate >= since && t.Status == TokenStatus.Waiting)
            .OrderBy(t => t.Createdat)
            .ToListAsync();

        foreach (var token in waiting)
        {
            // Two attempts: another request may hold the best table between the lookup and the save.
            for (int attempt = 0; attempt < 2; attempt++)
            {
                var plan = await FindBestPlanAsync(branchId, token.Guests);
                if (plan == null)
                    break;

                var tracked = await _context.WaitlistTokens.FirstAsync(t => t.Tokenid == token.Tokenid);
                if (tracked.Status != TokenStatus.Waiting)
                    break;
                if (await TryHoldAsync(tracked, plan, "Auto", userId))
                {
                    assigned++;
                    break;
                }
            }
        }
        return assigned;
    }

    // Stored state change with a history row (no save).
    public void SetState(Table table, string newState, int? userId, string evt = TableEvents.StateChanged, int? tokenId = null, string? notes = null)
    {
        if (table.Tablestate == newState)
            return;

        AddHistory(table.Tableid, table.Branchid, table.Outletid, evt, userId, table.Tablestate, newState, tokenId, notes: notes);
        table.Tablestate = newState;
        table.Statesince = DateTime.Now;
    }

    // After a bill is settled or an order cancelled: a table with no open orders left becomes Available
    // and is offered to the waiting queue.
    // Never throws: billing must not fail because of seating bookkeeping.
    public async Task ReleaseIfFreeAsync(IEnumerable<int?> tableIds, int? userId)
    {
        try
        {
            var ids = tableIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
            if (ids.Count == 0)
                return;

            var released = new List<Table>();
            var tables = await _context.Tables
                .Where(t => ids.Contains(t.Tableid) && (t.Tablestate == TableStates.Occupied || t.Tablestate == TableStates.Available))
                .ToListAsync();
            foreach (var table in tables)
            {
                if (await HasOpenOrdersAsync(table.Tableid))
                    continue;
                string next = TableStates.Available;
                bool changed = false;
                if (table.Tablestate != next)
                {
                    SetState(table, next, userId, TableEvents.Released, notes: "Orders settled");
                    changed = true;
                }
                if (await ReleaseMergedAsync(table, next, userId) > 0)
                    changed = true;
                if (changed)
                    released.Add(table);
            }
            if (released.Count == 0)
                return;
            await _context.SaveChangesAsync();

            foreach (var branchId in released.Select(t => t.Branchid).Distinct())
            {
                if (branchId.HasValue)
                    await AutoAssignAsync(branchId.Value, userId);
                await NotifyAsync(branchId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Releasing tables after billing failed");
        }
    }

    // Tables merged into this one are separated again and get the given state (no save).
    public async Task<int> ReleaseMergedAsync(Table target, string newState, int? userId)
    {
        var children = await _context.Tables.Where(t => t.Mergedinto == target.Tableid).ToListAsync();
        foreach (var child in children)
        {
            child.Mergedinto = null;
            AddHistory(child.Tableid, child.Branchid, child.Outletid, TableEvents.Unmerged, userId, child.Tablestate, newState,
                relatedTableId: target.Tableid, notes: $"Separated from {target.Tablename}");
            child.Tablestate = newState;
            child.Statesince = DateTime.Now;
        }
        return children.Count;
    }

    // A table merged into another one takes its orders on that table.
    public async Task<int?> ResolveTableIdAsync(int? tableId)
    {
        if (tableId is not > 0)
            return tableId;
        int? target = await _context.Tables.Where(t => t.Tableid == tableId).Select(t => t.Mergedinto).FirstOrDefaultAsync();
        return target ?? tableId;
    }

    public void AddHistory(int tableId, int? branchId, int? outletId, string evt, int? userId,
        string? fromState = null, string? toState = null, int? tokenId = null, int? relatedTableId = null, int? orderId = null, string? notes = null)
    {
        _context.TableHistories.Add(new TableHistory
        {
            Tableid = tableId,
            Event = evt,
            Fromstate = fromState,
            Tostate = toState,
            Tokenid = tokenId,
            Relatedtableid = relatedTableId,
            Orderid = orderId,
            Notes = notes,
            Userid = userId,
            Createdat = DateTime.Now,
            Branchid = branchId,
            Outletid = outletId
        });
    }

    // Tells the branch's captain screens to refresh the queue and the table board.
    public Task NotifyAsync(int? branchId) =>
        _hub.Clients.Groups(KOTNotificationHub.GroupsFor(branchId)).SendAsync(WaitlistChanged, new { branchId });
}
