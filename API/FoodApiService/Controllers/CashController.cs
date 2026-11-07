using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// appsettings "CashSettings".
public class CashSettings
{
    public string[] ExpenseCategories { get; set; } =
        { "Groceries", "Vegetables", "Milk", "Gas", "Salary", "Rent", "Electricity", "Maintenance", "Transport", "Other" };

    public string[] PaymentModes { get; set; } = { "cash", "upi", "card", "bank" };
}

// Daily expenses and cash drawer of a branch: opening cash, expenses, cash in / out,
// cash sales from settled bills, expected vs counted cash. Independent of the work period.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class CashController : ControllerBase
{
    private const string CashMode = "cash";

    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly CashSettings _settings;

    public CashController(HotelContext context, ITenantContext tenant, IConfiguration configuration)
    {
        _context = context;
        _tenant = tenant;
        _settings = configuration.GetSection("CashSettings").Get<CashSettings>() ?? new CashSettings();
    }

    public class DayRequest
    {
        public DateOnly? Date { get; set; }
        public int? BranchId { get; set; }
        public decimal OpeningCash { get; set; }
        public decimal? CountedCash { get; set; }
        public string? Notes { get; set; }
    }

    public class EntryRequest
    {
        public DateOnly? Date { get; set; }
        public int? BranchId { get; set; }
        public string? EntryType { get; set; }
        public string? Category { get; set; }
        public decimal Amount { get; set; }
        public string? PaymentMode { get; set; }
        public string? Notes { get; set; }
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateHelper.GetBusinessDate(DateTime.Now));

    // One business day: drawer, entries, sales from bills and the totals.
    [HttpGet("Day")]
    public async Task<IActionResult> GetDay([FromQuery] DateOnly? date = null, [FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);
        var day = date ?? Today;

        var drawer = await _context.CashDays.AsNoTracking().FirstOrDefaultAsync(d => d.Branchid == branch && d.Bizdate == day);
        var entries = await _context.CashEntries.AsNoTracking()
            .Where(e => e.Branchid == branch && e.Bizdate == day)
            .OrderBy(e => e.Createdat)
            .Select(e => new
            {
                e.Cashentryid, e.Entrytype, e.Category, e.Amount, e.Paymentmode, e.Notes, e.Createdat,
                Createdby = _context.Users.Where(u => u.Userid == e.Createdby).Select(u => u.Username).FirstOrDefault()
            })
            .ToListAsync();

        var sales = (await SalesByDayAsync(branch, day, day)).GetValueOrDefault(day) ?? new DaySales();
        var totals = Totals(drawer, entries.Select(e => (e.Entrytype, e.Amount, e.Paymentmode)), sales);

        string? updatedBy = drawer?.Updatedby is int uid
            ? await _context.Users.Where(u => u.Userid == uid).Select(u => u.Username).FirstOrDefaultAsync()
            : null;

        return Ok(new
        {
            status = "Success",
            data = new
            {
                date = day,
                branchId = branch,
                drawer = drawer == null ? null : new { drawer.Openingcash, drawer.Countedcash, drawer.Notes, drawer.Updatedat, updatedBy },
                entries,
                sales,
                totals,
                categories = _settings.ExpenseCategories,
                paymentModes = _settings.PaymentModes
            }
        });
    }

    // Opening cash, counted cash and notes of a day (created on first save).
    [HttpPost("Day")]
    public async Task<IActionResult> SaveDay([FromBody] DayRequest request)
    {
        if (request.OpeningCash < 0 || request.OpeningCash > 100_000_000 || request.CountedCash is < 0 or > 100_000_000)
            return BadRequest(new { status = "Error", message = "Enter a valid amount" });

        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(request.BranchId);
        var day = request.Date ?? Today;

        var drawer = await _context.CashDays.FirstOrDefaultAsync(d => d.Branchid == branch && d.Bizdate == day);
        if (drawer == null)
        {
            drawer = new CashDay { Bizdate = day };
            drawer.StampBranch(tenant, branch);
            _context.CashDays.Add(drawer);
        }
        drawer.Openingcash = request.OpeningCash;
        drawer.Countedcash = request.CountedCash;
        drawer.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        drawer.Updatedby = tenant.UserId;
        drawer.Updatedat = DateTime.Now;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Cash details saved" });
    }

    [HttpPost("Entry")]
    public async Task<IActionResult> AddEntry([FromBody] EntryRequest request)
    {
        string type = (request.EntryType ?? "").Trim().ToLowerInvariant();
        if (!CashEntryTypes.All.Contains(type))
            return BadRequest(new { status = "Error", message = "Type must be expense, cashin or cashout" });
        if (request.Amount <= 0 || request.Amount > 100_000_000)
            return BadRequest(new { status = "Error", message = "Enter an amount greater than 0" });
        string mode = string.IsNullOrWhiteSpace(request.PaymentMode) ? CashMode : request.PaymentMode.Trim().ToLowerInvariant();
        if (mode.Length > 20)
            return BadRequest(new { status = "Error", message = "Invalid payment mode" });
        string? category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        if (category?.Length > 60)
            return BadRequest(new { status = "Error", message = "Category is too long (max 60 characters)" });
        if (type == CashEntryTypes.Expense && category == null)
            return BadRequest(new { status = "Error", message = "Choose an expense category" });

        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(request.BranchId);
        var entry = new CashEntry
        {
            Bizdate = request.Date ?? Today,
            Entrytype = type,
            Category = category,
            Amount = Math.Round(request.Amount, 2),
            // Cash in / out always moves cash.
            Paymentmode = type == CashEntryTypes.Expense ? mode : CashMode,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Createdby = tenant.UserId,
            Createdat = DateTime.Now
        };
        entry.StampBranch(tenant, branch);
        _context.CashEntries.Add(entry);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Entry added", data = new { entry.Cashentryid } });
    }

    [HttpPost("Entry/{id}/Delete")]
    public async Task<IActionResult> DeleteEntry(int id)
    {
        var tenant = await _tenant.GetAsync();
        var entry = await _context.CashEntries.ForBranch(tenant).FirstOrDefaultAsync(e => e.Cashentryid == id);
        if (entry == null)
            return NotFound(new { status = "Error", message = "Entry not found" });
        _context.CashEntries.Remove(entry);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Entry deleted" });
    }

    // Day by day for a period, plus expenses by category.
    [HttpGet("Report")]
    public async Task<IActionResult> GetReport([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, [FromQuery] int? branchId = null)
    {
        if (toDate < fromDate)
            return BadRequest(new { status = "Error", message = "From date must be before To date" });
        if (toDate.DayNumber - fromDate.DayNumber > 366)
            return BadRequest(new { status = "Error", message = "Choose a period of at most one year" });

        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);

        var drawers = await _context.CashDays.AsNoTracking()
            .Where(d => d.Branchid == branch && d.Bizdate >= fromDate && d.Bizdate <= toDate)
            .ToDictionaryAsync(d => d.Bizdate);
        var entries = await _context.CashEntries.AsNoTracking()
            .Where(e => e.Branchid == branch && e.Bizdate >= fromDate && e.Bizdate <= toDate)
            .ToListAsync();
        var sales = await SalesByDayAsync(branch, fromDate, toDate);

        var days = drawers.Keys.Concat(entries.Select(e => e.Bizdate)).Concat(sales.Keys).Distinct().OrderBy(d => d)
            .Select(d =>
            {
                var t = Totals(drawers.GetValueOrDefault(d),
                    entries.Where(e => e.Bizdate == d).Select(e => (e.Entrytype, e.Amount, e.Paymentmode)),
                    sales.GetValueOrDefault(d) ?? new DaySales());
                return new { date = d, totals = t };
            })
            .ToList();

        var byCategory = entries.Where(e => e.Entrytype == CashEntryTypes.Expense)
            .GroupBy(e => e.Category ?? "Other")
            .Select(g => new { category = g.Key, count = g.Count(), amount = g.Sum(e => e.Amount) })
            .OrderByDescending(x => x.amount)
            .ToList();

        return Ok(new
        {
            status = "Success",
            data = new
            {
                fromDate, toDate, branchId = branch, days, byCategory,
                totals = new
                {
                    sales = days.Sum(d => d.totals.TotalPaidSales),
                    cashSales = days.Sum(d => d.totals.CashSales),
                    expenses = days.Sum(d => d.totals.Expenses),
                    cashExpenses = days.Sum(d => d.totals.CashExpenses),
                    cashIn = days.Sum(d => d.totals.CashIn),
                    cashOut = days.Sum(d => d.totals.CashOut),
                    difference = days.Where(d => d.totals.Difference.HasValue).Sum(d => d.totals.Difference!.Value)
                }
            }
        });
    }

    public class DaySales
    {
        public int Bills { get; set; }
        // Settled, paid bills by payment mode (bill total; split payments are shown as "split").
        public Dictionary<string, decimal> ByMode { get; set; } = new();
        public decimal Unpaid { get; set; }
        public decimal Complimentary { get; set; }
    }

    public record DayTotals(decimal OpeningCash, decimal CashSales, decimal TotalPaidSales, decimal Expenses, decimal CashExpenses,
        decimal CashIn, decimal CashOut, decimal ExpectedCash, decimal? CountedCash, decimal? Difference);

    private static DayTotals Totals(CashDay? drawer, IEnumerable<(string Type, decimal Amount, string Mode)> entries, DaySales sales)
    {
        var list = entries.ToList();
        decimal opening = drawer?.Openingcash ?? 0m;
        decimal cashSales = sales.ByMode.GetValueOrDefault(CashMode);
        decimal expenses = list.Where(e => e.Type == CashEntryTypes.Expense).Sum(e => e.Amount);
        decimal cashExpenses = list.Where(e => e.Type == CashEntryTypes.Expense && e.Mode == CashMode).Sum(e => e.Amount);
        decimal cashIn = list.Where(e => e.Type == CashEntryTypes.CashIn).Sum(e => e.Amount);
        decimal cashOut = list.Where(e => e.Type == CashEntryTypes.CashOut).Sum(e => e.Amount);
        decimal expected = opening + cashSales + cashIn - cashOut - cashExpenses;
        decimal? counted = drawer?.Countedcash;
        return new DayTotals(opening, cashSales, sales.ByMode.Values.Sum(), expenses, cashExpenses, cashIn, cashOut, expected,
            counted, counted.HasValue ? counted.Value - expected : null);
    }

    // Settled bills (finalized) per business day of the branch.
    private async Task<Dictionary<DateOnly, DaySales>> SalesByDayAsync(int branch, DateOnly from, DateOnly to)
    {
        var fromDt = from.ToDateTime(TimeOnly.MinValue);
        var toDt = to.ToDateTime(TimeOnly.MinValue).AddDays(1);
        // Settled bills are "finalized"; complimentary bills are closed as "complementary".
        var bills = await _context.Billheaders.AsNoTracking()
            .Where(b => b.Branchid == branch && b.Businessdate >= fromDt && b.Businessdate < toDt
                        && (b.Lifecyclestatus == "finalized" || b.Lifecyclestatus == "complementary"))
            .Select(b => new { b.Businessdate, b.Totalamount, b.Paymentmode, b.Status, b.Iscomplementary, b.Lifecyclestatus })
            .ToListAsync();

        return bills.GroupBy(b => DateOnly.FromDateTime(b.Businessdate!.Value))
            .ToDictionary(g => g.Key, g => new DaySales
            {
                Bills = g.Count(),
                ByMode = g.Where(b => b.Iscomplementary != true && b.Status == "paid" && b.Lifecyclestatus == "finalized")
                    .GroupBy(b => string.IsNullOrWhiteSpace(b.Paymentmode) ? "other" : b.Paymentmode!.Trim().ToLowerInvariant())
                    .ToDictionary(m => m.Key, m => m.Sum(b => b.Totalamount ?? 0m)),
                Unpaid = g.Where(b => b.Iscomplementary != true && b.Status != "paid").Sum(b => b.Totalamount ?? 0m),
                Complimentary = g.Where(b => b.Iscomplementary == true).Sum(b => b.Totalamount ?? 0m)
            });
    }
}
