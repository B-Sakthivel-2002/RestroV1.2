using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

public class CreateTokenRequest
{
    public string? CustomerName { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public int Guests { get; set; }
    public string? Notes { get; set; }

    // Outlet owner only: the branch to queue at (others always use their own branch).
    public int? BranchId { get; set; }
}

public class AssignTokenRequest
{
    // Null = let the system pick the smallest free table that fits.
    public int? TableId { get; set; }
}

// Walk-in token queue of a branch: issue tokens, hold tables for them (system or captain), seat them.
[Route("api/[controller]")]
[Authorize(Roles = "Manager,Admin,SuperAdmin,Captain")]
public class WaitlistController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly SeatingService _seating;
    private readonly DocumentNumberService _numbers;
    private readonly EmailService _email;

    public WaitlistController(HotelContext context, ITenantContext tenant, SeatingService seating, DocumentNumberService numbers, EmailService email)
    {
        _context = context;
        _tenant = tenant;
        _seating = seating;
        _numbers = numbers;
        _email = email;
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateHelper.GetBusinessDate(DateTime.Now));

    // Active tokens (Waiting / Called) from today and yesterday, so a queue survives midnight.
    private IQueryable<WaitlistToken> ActiveTokens(int branchId)
    {
        var since = Today.AddDays(-1);
        return _context.WaitlistTokens.Where(t => t.Branchid == branchId && t.Bizdate >= since && TokenStatus.Active.Contains(t.Status));
    }

    // Queue of one branch: active tokens first (in arrival order), then today's closed ones.
    [HttpGet]
    public async Task<IActionResult> GetQueue([FromQuery] int? branchId = null, [FromQuery] bool includeClosed = true)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);
        var today = Today;

        var tokens = await _context.WaitlistTokens.AsNoTracking()
            .Where(t => t.Branchid == branch && t.Bizdate >= today.AddDays(-1)
                        && (TokenStatus.Active.Contains(t.Status) || (includeClosed && t.Bizdate == today)))
            .OrderBy(t => t.Createdat)
            .Select(t => new
            {
                t.Tokenid, t.Tokencode, t.Customername, t.Mobile, t.Email, t.Guests, t.Notes, t.Status,
                t.Tableid, Tablename = t.Table != null ? t.Table.Tablename : null, t.Assignmode,
                t.Createdat, t.Calledat, t.Seatedat, t.Closedat
            })
            .ToListAsync();

        int suitableTables = await _context.Tables.CountAsync(t => t.Branchid == branch && t.Status == true && t.Tablestate != TableStates.Blocked);
        var now = DateTime.Now;
        int position = 0;
        var list = tokens.Select(t =>
        {
            int? pos = t.Status == TokenStatus.Waiting ? ++position : null;
            return new
            {
                t.Tokenid, t.Tokencode, t.Customername, t.Mobile, t.Email, t.Guests, t.Notes, t.Status,
                t.Tableid, t.Tablename, t.Assignmode, t.Createdat, t.Calledat, t.Seatedat, t.Closedat,
                Position = pos,
                EstimatedMinutes = pos.HasValue ? Estimate(pos.Value - 1, suitableTables) : (int?)null,
                WaitingMinutes = (int)((t.Seatedat ?? t.Closedat ?? now) - t.Createdat).TotalMinutes,
                HoldOverdue = t.Status == TokenStatus.Called && t.Calledat.HasValue && (now - t.Calledat.Value).TotalMinutes > _seating.Settings.HoldMinutes
            };
        }).ToList();

        return Ok(new
        {
            status = "Success",
            message = "Waitlist fetched successfully",
            data = list,
            summary = new
            {
                branchId = branch,
                waiting = list.Count(t => t.Status == TokenStatus.Waiting),
                called = list.Count(t => t.Status == TokenStatus.Called),
                seatedToday = list.Count(t => t.Status == TokenStatus.Seated),
                autoAssign = _seating.Settings.AutoAssign,
                emailEnabled = _email.IsConfigured
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateToken([FromBody] CreateTokenRequest request)
    {
        string name = request.CustomerName?.Trim() ?? "";
        string mobile = request.Mobile?.Trim() ?? "";
        string? email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

        if (name.Length == 0 || name.Length > 100)
            return BadRequest(new { status = "Error", message = "Customer name is required (max 100 characters)" });
        if (mobile.Length < 6 || mobile.Length > 20 || !mobile.All(c => char.IsDigit(c) || c == '+' || c == ' ' || c == '-'))
            return BadRequest(new { status = "Error", message = "Enter a valid mobile number" });
        if (email != null && (email.Length > 150 || !System.Net.Mail.MailAddress.TryCreate(email, out _)))
            return BadRequest(new { status = "Error", message = "Enter a valid email address" });
        if (request.Guests < 1 || request.Guests > 50)
            return BadRequest(new { status = "Error", message = "Guests must be between 1 and 50" });

        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(request.BranchId);
        if (branch <= 0)
            return BadRequest(new { status = "Error", message = "Your user has no branch" });

        // One active token per mobile number in a branch.
        var existing = await ActiveTokens(branch).AsNoTracking().FirstOrDefaultAsync(t => t.Mobile == mobile);
        if (existing != null)
            return Conflict(new { status = "Error", message = $"This mobile number already has token {existing.Tokencode} ({existing.Status})", data = new { existing.Tokenid, existing.Tokencode } });

        var today = Today;
        int number = await _numbers.NextValueAsync(DocumentNumberService.Token, branch, today);
        var token = new WaitlistToken
        {
            Tokencode = $"T-{number:D3}",
            Bizdate = today,
            Customername = name,
            Mobile = mobile,
            Email = email,
            Guests = request.Guests,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Status = TokenStatus.Waiting,
            Createdat = DateTime.Now,
            Createdby = tenant.UserId
        };
        token.StampBranch(tenant, branch);
        _context.WaitlistTokens.Add(token);
        await _context.SaveChangesAsync();

        int ahead = await ActiveTokens(branch).CountAsync(t => t.Status == TokenStatus.Waiting && t.Createdat < token.Createdat);
        int suitableTables = await _context.Tables.CountAsync(t => t.Branchid == branch && t.Status == true && t.Tablestate != TableStates.Blocked);
        int estimate = Estimate(ahead, suitableTables);
        _email.SendTokenCreated(token, await _seating.BranchNameAsync(branch), ahead, estimate);

        await _seating.AutoAssignAsync(branch, tenant.UserId);
        await _seating.NotifyAsync(branch);

        // Re-read: auto-assign may already have held a table for this token.
        var saved = await _context.WaitlistTokens.AsNoTracking().Include(t => t.Table).FirstAsync(t => t.Tokenid == token.Tokenid);
        return Ok(new
        {
            status = "Success",
            message = $"Token {saved.Tokencode} created",
            data = new
            {
                saved.Tokenid, saved.Tokencode, saved.Customername, saved.Mobile, saved.Email, saved.Guests, saved.Status,
                saved.Tableid, Tablename = saved.Table?.Tablename, saved.Createdat,
                PartiesAhead = ahead,
                EstimatedMinutes = estimate,
                EmailSent = _email.IsConfigured && saved.Email != null
            }
        });
    }

    // The table the system would pick for this token right now.
    [HttpGet("{id}/Suggest")]
    public async Task<IActionResult> Suggest(int id)
    {
        var tenant = await _tenant.GetAsync();
        var token = await _context.WaitlistTokens.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(t => t.Tokenid == id);
        if (token == null)
            return NotFound(new { status = "Error", message = "Token not found" });

        var table = await _seating.FindBestTableAsync(token.Branchid!.Value, token.Guests);
        return Ok(new
        {
            status = "Success",
            message = table == null ? "No free table fits this party right now" : $"Suggested table {table.Tablename}",
            data = table == null ? null : new { table.Tableid, table.Tablename, table.Capacity, table.Floorid }
        });
    }

    // Holds a table for the token: the given table (captain's choice) or the best free one (system).
    [HttpPost("{id}/Assign")]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignTokenRequest? request)
    {
        var tenant = await _tenant.GetAsync();
        var token = await _context.WaitlistTokens.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tokenid == id);
        if (token == null)
            return NotFound(new { status = "Error", message = "Token not found" });
        if (!TokenStatus.Active.Contains(token.Status))
            return BadRequest(new { status = "Error", message = $"Token is already {token.Status}" });

        int branch = token.Branchid!.Value;
        Table? table;
        string mode;
        if (request?.TableId is int tableId)
        {
            table = await _context.Tables.FirstOrDefaultAsync(t => t.Tableid == tableId && t.Branchid == branch);
            if (table == null)
                return NotFound(new { status = "Error", message = "Table not found in this branch" });
            if (token.Tableid == table.Tableid && token.Status == TokenStatus.Called)
                return Ok(new { status = "Success", message = $"{token.Tokencode} is already holding {table.Tablename}" });

            string? reason = await _seating.CannotHoldReasonAsync(table, token.Guests, token.Tokenid);
            if (reason != null)
                return BadRequest(new { status = "Error", message = reason });
            mode = "Manual";
        }
        else
        {
            table = await _seating.FindBestTableAsync(branch, token.Guests);
            if (table == null)
                return BadRequest(new { status = "Error", message = $"No free table for {token.Guests} guests right now" });
            mode = "Auto";
        }

        if (!await _seating.TryHoldAsync(token, table, mode, tenant.UserId))
            return Conflict(new { status = "Error", message = "That table was just given to another token. Please try again." });

        await _seating.NotifyAsync(branch);
        return Ok(new { status = "Success", message = $"{token.Tokencode} -> {table.Tablename}", data = new { token.Tokenid, token.Tableid, table.Tablename } });
    }

    // The party sits down: at its held table, or directly at a given free table.
    [HttpPost("{id}/Seat")]
    public async Task<IActionResult> Seat(int id, [FromBody] AssignTokenRequest? request)
    {
        var tenant = await _tenant.GetAsync();
        var token = await _context.WaitlistTokens.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tokenid == id);
        if (token == null)
            return NotFound(new { status = "Error", message = "Token not found" });
        if (!TokenStatus.Active.Contains(token.Status))
            return BadRequest(new { status = "Error", message = $"Token is already {token.Status}" });

        int branch = token.Branchid!.Value;
        int? tableId = request?.TableId ?? token.Tableid;
        if (tableId == null)
            return BadRequest(new { status = "Error", message = "Choose a table first" });

        var table = await _context.Tables.FirstOrDefaultAsync(t => t.Tableid == tableId && t.Branchid == branch);
        if (table == null)
            return NotFound(new { status = "Error", message = "Table not found in this branch" });

        string? reason = await _seating.CannotHoldReasonAsync(table, token.Guests, token.Tokenid);
        if (reason != null)
            return BadRequest(new { status = "Error", message = reason });

        if (token.Status == TokenStatus.Called && token.Tableid != table.Tableid)
            _seating.AddHistory(token.Tableid!.Value, token.Branchid, token.Outletid, TableEvents.TokenReleased, tenant.UserId,
                tokenId: token.Tokenid, notes: $"{token.Tokencode} seated at {table.Tablename} instead");

        token.Status = TokenStatus.Seated;
        token.Tableid = table.Tableid;
        token.Seatedat = DateTime.Now;
        token.Closedat = token.Seatedat;
        token.Updatedby = tenant.UserId;
        _seating.SetState(table, TableStates.Occupied, tenant.UserId, TableEvents.Seated, token.Tokenid,
            $"{token.Tokencode} {token.Customername} ({token.Guests} guests)");
        await _context.SaveChangesAsync();

        await _seating.NotifyAsync(branch);
        return Ok(new { status = "Success", message = $"{token.Tokencode} seated at {table.Tablename}", data = new { token.Tokenid, table.Tableid, table.Tablename, table.Floorid } });
    }

    [HttpPost("{id}/Cancel")]
    public Task<IActionResult> Cancel(int id) => Close(id, TokenStatus.Cancelled);

    [HttpPost("{id}/NoShow")]
    public Task<IActionResult> NoShow(int id) => Close(id, TokenStatus.NoShow);

    private async Task<IActionResult> Close(int id, string status)
    {
        var tenant = await _tenant.GetAsync();
        var token = await _context.WaitlistTokens.ForBranch(tenant).FirstOrDefaultAsync(t => t.Tokenid == id);
        if (token == null)
            return NotFound(new { status = "Error", message = "Token not found" });
        if (!TokenStatus.Active.Contains(token.Status))
            return BadRequest(new { status = "Error", message = $"Token is already {token.Status}" });

        bool freedTable = token.Status == TokenStatus.Called && token.Tableid.HasValue;
        if (freedTable)
            _seating.AddHistory(token.Tableid!.Value, token.Branchid, token.Outletid, TableEvents.TokenReleased, tenant.UserId,
                tokenId: token.Tokenid, notes: $"{token.Tokencode} {status}");

        token.Status = status;
        token.Closedat = DateTime.Now;
        token.Updatedby = tenant.UserId;
        await _context.SaveChangesAsync();

        // The released table can go to the next party in line.
        if (freedTable)
            await _seating.AutoAssignAsync(token.Branchid!.Value, tenant.UserId);
        await _seating.NotifyAsync(token.Branchid);
        return Ok(new { status = "Success", message = $"{token.Tokencode} marked {status}" });
    }

    // Rough wait: parties ahead share the branch's tables, MinutesPerParty each.
    private int Estimate(int partiesAhead, int tables)
    {
        int perTable = (int)Math.Ceiling((partiesAhead + 1) / (double)Math.Max(1, tables));
        return partiesAhead == 0 ? 0 : perTable * _seating.Settings.MinutesPerParty;
    }
}
