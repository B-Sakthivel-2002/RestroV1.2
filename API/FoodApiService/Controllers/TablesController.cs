using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Manager,Admin,SuperAdmin,Captain")]
public class TablesController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly SeatingService _seating;

    public TablesController(HotelContext context, ITenantContext tenant, SeatingService seating)
    {
        _context = context;
        _tenant = tenant;
        _seating = seating;
    }

    // Table master: every branch the caller may see (all outlet branches for an owner).
    [HttpGet]
    public async Task<IActionResult> GetTables()
    {
        var tenant = await _tenant.GetAsync();

        var list = await _context.Tables.ForBranch(tenant).Select(t => new
        {
            Tableid = t.Tableid,
            Floorid = t.Floorid,
            Tablename = t.Tablename,
            Description = t.Description,
            Status = t.Status,
            Capacity = t.Capacity,
            Tablestate = t.Tablestate,
            OrderTotalAmount = _context.Orders.Where(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")).Sum(o => o.Totalprice) ?? 0m,
            // Open orders first: an order moved in from another table may be older than the table's last settled order.
            OrderStatus = _context.Orders.Where(o => o.Tableid == t.Tableid).OrderByDescending(o => o.Status == "submitted" || o.Status == "printed").ThenByDescending(o => o.Timedate).Select(o => o.Status).FirstOrDefault(),
            PrintStatus = _context.Orders.Where(o => o.Tableid == t.Tableid).OrderByDescending(o => o.Status == "submitted" || o.Status == "printed").ThenByDescending(o => o.Timedate).Select(o => o.PrintedF).FirstOrDefault()
        }).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Error", message = "No tables found", data = (object)null });

        return Ok(new { status = "Success", message = "Tables fetched successfully", data = list });
    }

    // Dine-in screen: only the caller's own branch, where their orders are taken.
    [HttpGet("GetActiveTables")]
    public async Task<IActionResult> GetActiveTables()
    {
        var tenant = await _tenant.GetAsync();
        int branchid = tenant.BranchId;

        var list = await _context.Tables.Where(t => t.Branchid == branchid && t.Status == true).Select(t => new
        {
            Tableid = t.Tableid,
            Floorid = t.Floorid,
            Tablename = t.Tablename,
            Description = t.Description,
            Status = t.Status,
            Capacity = t.Capacity,
            // Merged tables open the main table's orders.
            Mergedinto = t.Mergedinto,
            Mergedintoname = _context.Tables.Where(m => m.Tableid == t.Mergedinto).Select(m => m.Tablename).FirstOrDefault(),
            OrderTotalAmount = _context.Orders.Where(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")).Sum(o => o.Totalprice) ?? 0m,
            // Open orders first: an order moved in from another table may be older than the table's last settled order.
            OrderStatus = _context.Orders.Where(o => o.Tableid == t.Tableid).OrderByDescending(o => o.Status == "submitted" || o.Status == "printed").ThenByDescending(o => o.Timedate).Select(o => o.Status).FirstOrDefault(),
            PrintStatus = _context.Orders.Where(o => o.Tableid == t.Tableid).OrderByDescending(o => o.Status == "submitted" || o.Status == "printed").ThenByDescending(o => o.Timedate).Select(o => o.PrintedF).FirstOrDefault(),
            StoredState = t.Tablestate,
            OpenOrders = _context.Orders.Count(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")),
            HeldToken = _context.WaitlistTokens.Where(w => w.Tableid == t.Tableid && w.Status == TokenStatus.Called).Select(w => w.Tokencode).FirstOrDefault(),
            SeatedToken = _context.WaitlistTokens
                .Where(w => w.Tableid == t.Tableid && w.Status == TokenStatus.Seated && t.Tablestate == TableStates.Occupied)
                .OrderByDescending(w => w.Seatedat).Select(w => w.Tokencode).FirstOrDefault()
        }).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Error", message = "No tables found", data = (object)null });

        // Tablestate / Tokencode: the same state and token the Waitlist & Tables board shows.
        var data = list.Select(t => new
        {
            t.Tableid, t.Floorid, t.Tablename, t.Description, t.Status, t.Capacity, t.Mergedinto, t.Mergedintoname,
            t.OrderTotalAmount, t.OrderStatus, t.PrintStatus,
            Tablestate = t.OpenOrders > 0 ? TableStates.Occupied : t.HeldToken != null ? TableStates.Reserved : t.StoredState,
            Tokencode = t.HeldToken ?? t.SeatedToken
        }).ToList();

        return Ok(new { status = "Success", message = "Tables fetched successfully", data });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTable(int id)
    {
        var tenant = await _tenant.GetAsync();
        var table = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == id);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found", data = (object)null });

        return Ok(new { status = "Success", message = "Table fetched successfully", data = table });
    }

    [HttpPost]
    public async Task<IActionResult> PostTable([FromBody] Table table)
    {
        var tenant = await _tenant.GetAsync();
        var floor = await FindFloor(tenant, table.Floorid);
        if (floor == null)
            return BadRequest(new { status = "Error", message = "Floor not found", data = (object)null });

        // A table always belongs to its floor's branch.
        table.Branchid = floor.Branchid;
        table.Outletid = tenant.OutletId;
        if (table.Capacity < 1)
            table.Capacity = 4;
        table.Tablestate = TableStates.Available;
        table.Statesince = DateTime.Now;
        _context.Tables.Add(table);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetTable", new { id = table.Tableid }, new { status = "Success", message = "Table created successfully", data = table });
    }

    [HttpPost("UpdateTable")]
    public async Task<IActionResult> UpdateTable([FromBody] Table table)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Tables.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == table.Tableid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Table not found", data = (object)null });
        var floor = await FindFloor(tenant, table.Floorid);
        if (floor == null)
            return BadRequest(new { status = "Error", message = "Floor not found", data = (object)null });

        table.Branchid = floor.Branchid;
        table.Outletid = existing.Outletid ?? tenant.OutletId;
        if (table.Capacity < 1)
            table.Capacity = existing.Capacity;
        // Seating state is changed only through the table board, never by the master form.
        table.Tablestate = existing.Tablestate;
        table.Statesince = existing.Statesince;
        _context.Entry(table).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Table updated successfully", data = table });
    }

    [HttpPost("DeleteTable/{id}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        var tenant = await _tenant.GetAsync();
        var table = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == id);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found", data = (object)null });

        _context.Tables.Remove(table);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Table deleted successfully", data = table });
    }

    // Captain's live table board for one branch: effective state, held / seated token, open bill.
    [HttpGet("Board")]
    public async Task<IActionResult> GetBoard([FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);

        var floors = await _context.Floors.AsNoTracking()
            .Where(f => f.Branchid == branch && f.Status == true)
            .OrderBy(f => f.Floorid)
            .Select(f => new { f.Floorid, f.Floorname })
            .ToListAsync();

        var tables = await _context.Tables.AsNoTracking()
            .Where(t => t.Branchid == branch && t.Status == true)
            .OrderBy(t => t.Floorid).ThenBy(t => t.Tablename)
            .Select(t => new
            {
                t.Tableid, t.Floorid, t.Tablename, t.Capacity, t.Tablestate, t.Statesince, t.Mergedinto,
                Mergedintoname = _context.Tables.Where(m => m.Tableid == t.Mergedinto).Select(m => m.Tablename).FirstOrDefault(),
                Mergedtables = _context.Tables.Where(m => m.Mergedinto == t.Tableid).Select(m => m.Tablename).ToList(),
                OpenOrders = _context.Orders.Count(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")),
                OpenAmount = _context.Orders.Where(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")).Sum(o => o.Totalprice) ?? 0m,
                FirstOrderAt = _context.Orders.Where(o => o.Tableid == t.Tableid && (o.Status == "submitted" || o.Status == "printed")).Min(o => (DateTime?)o.Timedate),
                Held = _context.WaitlistTokens
                    .Where(w => w.Tableid == t.Tableid && w.Status == TokenStatus.Called)
                    .Select(w => new { w.Tokenid, w.Tokencode, w.Customername, w.Guests, w.Calledat, w.Assignmode })
                    .FirstOrDefault(),
                Seated = _context.WaitlistTokens
                    .Where(w => w.Tableid == t.Tableid && w.Status == TokenStatus.Seated && t.Tablestate == TableStates.Occupied)
                    .OrderByDescending(w => w.Seatedat)
                    .Select(w => new { w.Tokenid, w.Tokencode, w.Customername, w.Guests, w.Seatedat })
                    .FirstOrDefault()
            })
            .ToListAsync();

        var board = tables.Select(t => new
        {
            t.Tableid, t.Floorid, t.Tablename, t.Capacity, t.Mergedinto, t.Mergedintoname, t.Mergedtables,
            State =t.OpenOrders > 0 ? TableStates.Occupied : t.Held != null ? TableStates.Reserved : t.Tablestate,
            StoredState = t.Tablestate,
            Since = t.OpenOrders > 0 ? (t.Seated?.Seatedat ?? t.FirstOrderAt) : t.Held?.Calledat ?? t.Statesince,
            t.OpenOrders, t.OpenAmount, t.Held, t.Seated
        }).ToList();

        return Ok(new
        {
            status = "Success",
            message = "Table board fetched successfully",
            data = new
            {
                branchId = branch,
                floors,
                tables = board,
                counts = BoardStates.ToDictionary(s => s, s => board.Count(b => b.State == s))
            }
        });
    }

    private static readonly string[] BoardStates =
        { TableStates.Available, TableStates.Occupied, TableStates.Reserved, TableStates.Blocked };

    public class TableStateRequest
    {
        public string? State { get; set; }
        public string? Notes { get; set; }
    }

    // Captain sets a table Available, Blocked or Reserved.
    [HttpPost("{id}/State")]
    public async Task<IActionResult> SetState(int id, [FromBody] TableStateRequest request)
    {
        var tenant = await _tenant.GetAsync();
        string? state = TableStates.Manual.FirstOrDefault(s => string.Equals(s, request?.State, StringComparison.OrdinalIgnoreCase));
        if (state == null)
            return BadRequest(new { status = "Error", message = "State must be one of: " + string.Join(", ", TableStates.Manual) });

        var table = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == id);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found", data = (object)null });
        if (table.Mergedinto != null)
            return BadRequest(new { status = "Error", message = "Table is merged with another table. Unmerge it first." });
        if (await _seating.HasOpenOrdersAsync(table.Tableid))
            return BadRequest(new { status = "Error", message = "Table has open orders. Settle or move them first." });
        if (await _context.WaitlistTokens.AnyAsync(w => w.Tableid == table.Tableid && w.Status == TokenStatus.Called))
            return BadRequest(new { status = "Error", message = "Table is held for a token. Seat, move or cancel the token first." });

        _seating.SetState(table, state, tenant.UserId, notes: string.IsNullOrWhiteSpace(request!.Notes) ? null : request.Notes.Trim());
        await _seating.ReleaseMergedAsync(table, state, tenant.UserId);
        await _context.SaveChangesAsync();

        if (state == TableStates.Available)
            await _seating.AutoAssignAsync(table.Branchid!.Value, tenant.UserId);
        await _seating.NotifyAsync(table.Branchid);
        return Ok(new { status = "Success", message = $"{table.Tablename} is now {state}", data = new { table.Tableid, table.Tablestate } });
    }

    public class TransferRequest
    {
        public int FromTableId { get; set; }
        public int ToTableId { get; set; }

        // Only these orders; null or empty = every open order of the table.
        public List<int>? OrderIds { get; set; }
    }

    public class MergeRequest
    {
        // The table that keeps the orders and gets the bill.
        public int TargetTableId { get; set; }
        public List<int> SourceTableIds { get; set; } = new();
    }

    private static readonly string[] OpenOrderStatuses = { "submitted", "printed" };

    // Moves a table's open orders (all, or the chosen ones) to a free table. When everything moves,
    // the seated party goes with it and the old table becomes Available.
    [HttpPost("Transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest request)
    {
        var tenant = await _tenant.GetAsync();
        if (request == null || request.FromTableId == request.ToTableId)
            return BadRequest(new { status = "Error", message = "Choose two different tables" });

        var from = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == request.FromTableId);
        var to = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == request.ToTableId);
        if (from == null || to == null)
            return NotFound(new { status = "Error", message = "Table not found" });
        if (from.Branchid != to.Branchid)
            return BadRequest(new { status = "Error", message = "Tables are in different branches" });
        if (from.Mergedinto != null)
            return BadRequest(new { status = "Error", message = "This table is merged with another table. Move the main table instead." });

        string? reason = await TargetProblem(to, mustBeFree: true);
        if (reason != null)
            return BadRequest(new { status = "Error", message = reason });

        var open = await _context.Orders.Where(o => o.Tableid == from.Tableid && OpenOrderStatuses.Contains(o.Status)).ToListAsync();
        var moving = request.OrderIds is { Count: > 0 } ? open.Where(o => request.OrderIds.Contains(o.Orderid)).ToList() : open;
        if (request.OrderIds is { Count: > 0 } && moving.Count != request.OrderIds.Distinct().Count())
            return BadRequest(new { status = "Error", message = "Some orders are not open on this table" });
        if (moving.Count == 0 && from.Tablestate != TableStates.Occupied)
            return BadRequest(new { status = "Error", message = "Nothing to move: the table has no open orders" });
        if (moving.Any(o => o.Status == "printed"))
            return BadRequest(new { status = "Error", message = "The bill is already printed for these orders. Settle it, or move the orders before printing." });

        foreach (var order in moving)
            order.Tableid = to.Tableid;

        bool everything = moving.Count == open.Count;
        string orderNumbers = string.Join(", ", moving.Select(o => o.Ordernumber));
        _seating.AddHistory(from.Tableid, from.Branchid, from.Outletid, TableEvents.TransferOut, tenant.UserId,
            relatedTableId: to.Tableid, notes: everything ? $"All orders moved. {orderNumbers}" : orderNumbers);
        _seating.AddHistory(to.Tableid, to.Branchid, to.Outletid, TableEvents.TransferIn, tenant.UserId,
            relatedTableId: from.Tableid, notes: orderNumbers);
        _seating.SetState(to, TableStates.Occupied, tenant.UserId, notes: $"Moved from {from.Tablename}");

        if (everything)
        {
            // The party moved: its token, and any tables merged with the old table, follow it.
            var seated = await _context.WaitlistTokens
                .Where(w => w.Tableid == from.Tableid && w.Status == TokenStatus.Seated)
                .OrderByDescending(w => w.Seatedat).FirstOrDefaultAsync();
            if (seated != null)
                seated.Tableid = to.Tableid;
            foreach (var child in await _context.Tables.Where(t => t.Mergedinto == from.Tableid).ToListAsync())
                child.Mergedinto = to.Tableid;

            _seating.SetState(from, TableStates.Available, tenant.UserId, notes: $"Guests moved to {to.Tablename}");
        }
        await _context.SaveChangesAsync();
        if (everything)
            await _seating.AutoAssignAsync(from.Branchid!.Value, tenant.UserId);
        await _seating.NotifyAsync(from.Branchid);

        return Ok(new
        {
            status = "Success",
            message = $"{moving.Count} order(s) moved from {from.Tablename} to {to.Tablename}",
            data = new { fromTableId = from.Tableid, toTableId = to.Tableid, to.Tablename, to.Floorid, movedOrders = moving.Select(o => o.Orderid) }
        });
    }

    // Joins other tables to the target table: their open orders move onto it (one bill), and they stay
    // linked (Occupied) until the target is settled or they are unmerged.
    [HttpPost("Merge")]
    public async Task<IActionResult> Merge([FromBody] MergeRequest request)
    {
        var tenant = await _tenant.GetAsync();
        var sourceIds = request?.SourceTableIds?.Distinct().Where(id => id != request.TargetTableId).ToList() ?? new List<int>();
        if (sourceIds.Count == 0)
            return BadRequest(new { status = "Error", message = "Choose at least one table to merge" });

        var target = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == request!.TargetTableId);
        if (target == null)
            return NotFound(new { status = "Error", message = "Table not found" });
        string? targetProblem = await TargetProblem(target, mustBeFree: false);
        if (targetProblem != null)
            return BadRequest(new { status = "Error", message = targetProblem });
        if (await _context.Orders.AnyAsync(o => o.Tableid == target.Tableid && o.Status == "printed"))
            return BadRequest(new { status = "Error", message = $"The bill for {target.Tablename} is already printed. Settle it first." });

        var sources = await _context.Tables.Where(t => sourceIds.Contains(t.Tableid) && t.Branchid == target.Branchid).ToListAsync();
        if (sources.Count != sourceIds.Count)
            return NotFound(new { status = "Error", message = "Some tables were not found in this branch" });

        foreach (var source in sources)
        {
            if (source.Mergedinto != null)
                return BadRequest(new { status = "Error", message = $"{source.Tablename} is already merged with another table" });
            if (source.Status != true || source.Tablestate == TableStates.Blocked)
                return BadRequest(new { status = "Error", message = $"{source.Tablename} is not available" });
            if (await _context.WaitlistTokens.AnyAsync(w => w.Tableid == source.Tableid && w.Status == TokenStatus.Called))
                return BadRequest(new { status = "Error", message = $"{source.Tablename} is held for a waiting token" });
            if (await _context.Orders.AnyAsync(o => o.Tableid == source.Tableid && o.Status == "printed"))
                return BadRequest(new { status = "Error", message = $"The bill for {source.Tablename} is already printed. Settle it first." });
        }

        int moved = 0;
        foreach (var source in sources)
        {
            var orders = await _context.Orders.Where(o => o.Tableid == source.Tableid && o.Status == "submitted").ToListAsync();
            foreach (var order in orders)
                order.Tableid = target.Tableid;
            moved += orders.Count;

            // Tables already merged into the source now belong to the target.
            foreach (var child in await _context.Tables.Where(t => t.Mergedinto == source.Tableid).ToListAsync())
                child.Mergedinto = target.Tableid;

            source.Mergedinto = target.Tableid;
            _seating.SetState(source, TableStates.Occupied, tenant.UserId, TableEvents.Merged, notes: $"Merged into {target.Tablename}");
            _seating.AddHistory(target.Tableid, target.Branchid, target.Outletid, TableEvents.Merged, tenant.UserId,
                relatedTableId: source.Tableid, notes: $"{source.Tablename} joined ({orders.Count} order(s) moved)");
        }
        _seating.SetState(target, TableStates.Occupied, tenant.UserId, notes: "Tables merged");
        await _context.SaveChangesAsync();
        await _seating.NotifyAsync(target.Branchid);

        return Ok(new
        {
            status = "Success",
            message = $"{string.Join(", ", sources.Select(s => s.Tablename))} merged into {target.Tablename} ({moved} order(s) moved)",
            data = new { targetTableId = target.Tableid, target.Tablename, target.Floorid, movedOrders = moved }
        });
    }

    // Separates a merged table again. Orders already moved stay on the main table.
    [HttpPost("{id}/Unmerge")]
    public async Task<IActionResult> Unmerge(int id)
    {
        var tenant = await _tenant.GetAsync();
        var table = await _context.Tables.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == id);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found" });
        if (table.Mergedinto == null)
            return BadRequest(new { status = "Error", message = "Table is not merged" });

        int? targetId = table.Mergedinto;
        string? targetName = await _context.Tables.Where(t => t.Tableid == targetId).Select(t => t.Tablename).FirstOrDefaultAsync();
        table.Mergedinto = null;
        _seating.SetState(table, TableStates.Available, tenant.UserId, TableEvents.Unmerged, notes: $"Separated from {targetName}");
        _seating.AddHistory(targetId!.Value, table.Branchid, table.Outletid, TableEvents.Unmerged, tenant.UserId,
            relatedTableId: table.Tableid, notes: $"{table.Tablename} separated");
        await _context.SaveChangesAsync();
        await _seating.NotifyAsync(table.Branchid);
        return Ok(new { status = "Success", message = $"{table.Tablename} separated from {targetName}" });
    }

    // Why a table cannot receive guests from another table, or null when it can.
    private async Task<string?> TargetProblem(Table table, bool mustBeFree)
    {
        if (table.Status != true)
            return $"{table.Tablename} is inactive";
        if (table.Mergedinto != null)
            return $"{table.Tablename} is merged with another table";
        if (table.Tablestate == TableStates.Blocked)
            return $"{table.Tablename} is blocked";
        if (await _context.WaitlistTokens.AnyAsync(w => w.Tableid == table.Tableid && w.Status == TokenStatus.Called))
            return $"{table.Tablename} is held for a waiting token";
        if (mustBeFree && await _seating.HasOpenOrdersAsync(table.Tableid))
            return $"{table.Tablename} already has orders. Use Merge to combine tables.";
        return null;
    }

    // Everything that happened to a table, newest first.
    [HttpGet("{id}/History")]
    public async Task<IActionResult> GetHistory(int id, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, [FromQuery] int take = 200)
    {
        var tenant = await _tenant.GetAsync();
        var table = await _context.Tables.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(t => t.Tableid == id);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found", data = (object)null });

        var query = _context.TableHistories.AsNoTracking().Where(h => h.Tableid == id);
        if (from.HasValue)
            query = query.Where(h => h.Createdat >= from.Value.Date);
        if (to.HasValue)
            query = query.Where(h => h.Createdat < to.Value.Date.AddDays(1));

        var list = await query
            .OrderByDescending(h => h.Createdat).ThenByDescending(h => h.Historyid)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(h => new
            {
                h.Historyid, h.Event, h.Fromstate, h.Tostate, h.Notes, h.Createdat, h.Orderid,
                Tokencode = _context.WaitlistTokens.Where(w => w.Tokenid == h.Tokenid).Select(w => w.Tokencode).FirstOrDefault(),
                Relatedtable = _context.Tables.Where(t => t.Tableid == h.Relatedtableid).Select(t => t.Tablename).FirstOrDefault(),
                Username = _context.Users.Where(u => u.Userid == h.Userid).Select(u => u.Username).FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new { status = "Success", message = "Table history fetched successfully", data = new { table.Tableid, table.Tablename, history = list } });
    }

    private Task<Floor?> FindFloor(TenantInfo tenant, int floorId)
    {
        var branchIds = tenant.BranchIds;
        return _context.Floors.AsNoTracking().FirstOrDefaultAsync(f => f.Floorid == floorId && branchIds.Contains(f.Branchid));
    }
}
