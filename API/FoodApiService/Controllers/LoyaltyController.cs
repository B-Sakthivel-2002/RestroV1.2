using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// appsettings "LoyaltySettings".
public class LoyaltySettings
{
    // Points = floor(lifetime spend / RupeesPerPoint) * PointsPerStep. Earn + view only (no redemption yet).
    public decimal RupeesPerPoint { get; set; } = 100;
    public int PointsPerStep { get; set; } = 1;

    // A customer with no visit for this many days is listed as inactive (win-back list).
    public int InactiveDays { get; set; } = 30;

    // Lowest MinSpend first. Lifetime spend decides the tier.
    public List<LoyaltyTier> Tiers { get; set; } = new()
    {
        new() { Name = "Bronze", MinSpend = 0 },
        new() { Name = "Silver", MinSpend = 5000 },
        new() { Name = "Gold", MinSpend = 15000 },
        new() { Name = "Platinum", MinSpend = 40000 }
    };
}

public class LoyaltyTier
{
    public string Name { get; set; } = "";
    public decimal MinSpend { get; set; }
}

// Customer loyalty and customer reports, from settled (finalized), paid, non-complimentary bills
// that have a customer. Customers are per branch.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class LoyaltyController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly LoyaltySettings _settings;

    public LoyaltyController(HotelContext context, ITenantContext tenant, IConfiguration configuration)
    {
        _context = context;
        _tenant = tenant;
        _settings = configuration.GetSection("LoyaltySettings").Get<LoyaltySettings>() ?? new LoyaltySettings();
        _settings.Tiers = _settings.Tiers.OrderBy(t => t.MinSpend).ToList();
        if (_settings.RupeesPerPoint <= 0) _settings.RupeesPerPoint = 100;
    }

    private record BillRow(int Billid, int CustomerId, DateTime Date, DateTime Time, decimal Amount, string? Mode, string? Name, string? Phone, string? Billnumber);
    private record LineRow(int Billid, int CustomerId, int Itemid, int Qty, decimal Amount, int? Ordertypeid);

    private IQueryable<Billheader> LoyaltyBills(int branch) => _context.Billheaders.AsNoTracking()
        .Where(b => b.Branchid == branch && b.Customerid > 0 && b.Lifecyclestatus == "finalized"
                    && b.Status == "paid" && b.Iscomplementary != true);

    private async Task<List<BillRow>> BillsAsync(int branch, int? customerId = null)
    {
        var q = LoyaltyBills(branch);
        if (customerId.HasValue) q = q.Where(b => b.Customerid == customerId);
        return (await q.Select(b => new { b.Billid, b.Customerid, b.Businessdate, b.Datetime, b.Totalamount, b.Paymentmode, b.Billname, b.Phone, b.Billnumber })
                .ToListAsync())
            .Select(b => new BillRow(b.Billid, b.Customerid!.Value, (b.Businessdate ?? b.Datetime).Date, b.Datetime, b.Totalamount ?? 0m,
                b.Paymentmode, b.Billname, b.Phone, b.Billnumber))
            .ToList();
    }

    private async Task<List<LineRow>> LinesAsync(int branch, int? customerId = null)
    {
        var bills = LoyaltyBills(branch);
        if (customerId.HasValue) bills = bills.Where(b => b.Customerid == customerId);
        return await (from b in bills
                      join bd in _context.Billdetails on b.Billid equals bd.Billid
                      join od in _context.Orderdetails on bd.Orderid equals od.Orderid
                      where od.Qty > 0
                      select new LineRow(b.Billid, b.Customerid!.Value, od.Itemid, od.Qty, od.Sumofprice ?? od.Qty * od.Price, od.Order.Ordertypeid))
            .ToListAsync();
    }

    private async Task<Dictionary<int, (string Item, string Category)>> ItemNamesAsync(IEnumerable<int> itemIds)
    {
        var ids = itemIds.Distinct().ToList();
        return (await _context.Items.AsNoTracking().Where(i => ids.Contains(i.Itemid))
                .Select(i => new { i.Itemid, i.Itemname, Category = i.Category.Categoryname }).ToListAsync())
            .ToDictionary(i => i.Itemid, i => (i.Itemname ?? "Item", i.Category ?? "Other"));
    }

    private int Points(decimal spend) => (int)Math.Floor(spend / _settings.RupeesPerPoint) * _settings.PointsPerStep;

    private LoyaltyTier Tier(decimal spend) =>
        _settings.Tiers.LastOrDefault(t => spend >= t.MinSpend) ?? new LoyaltyTier { Name = "Member" };

    private LoyaltyTier? NextTier(decimal spend) => _settings.Tiers.FirstOrDefault(t => t.MinSpend > spend);

    // All loyalty customers with lifetime and period figures, plus the overall KPIs of the period.
    [HttpGet("Summary")]
    public async Task<IActionResult> Summary([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);
        var to = (toDate ?? DateTime.Today).Date;
        var from = (fromDate ?? to.AddDays(-29)).Date;
        var today = DateHelper.GetBusinessDate(DateTime.Now).Date;

        var bills = await BillsAsync(branch);
        var lines = await LinesAsync(branch);
        var names = await ItemNamesAsync(lines.Select(l => l.Itemid));
        var customerIds = bills.Select(b => b.CustomerId).Distinct().ToList();
        var customers = await _context.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Customerid))
            .ToDictionaryAsync(c => c.Customerid, c => new { c.Name, c.Contactnumber });

        var linesByCustomer = lines.GroupBy(l => l.CustomerId).ToDictionary(g => g.Key, g => g.ToList());
        var rows = bills.GroupBy(b => b.CustomerId).Select(g =>
        {
            var c = customers.GetValueOrDefault(g.Key);
            var mine = linesByCustomer.GetValueOrDefault(g.Key) ?? new List<LineRow>();
            decimal spent = g.Sum(b => b.Amount);
            var inPeriod = g.Where(b => b.Date >= from && b.Date <= to).ToList();
            var first = g.Min(b => b.Date);
            var last = g.Max(b => b.Date);
            var next = NextTier(spent);
            return new
            {
                customerId = g.Key,
                name = c?.Name ?? g.Select(b => b.Name).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)) ?? "Customer",
                phone = c?.Contactnumber ?? g.Select(b => b.Phone).FirstOrDefault(p => !string.IsNullOrWhiteSpace(p)),
                visits = g.Count(),
                totalSpent = spent,
                avgBill = Math.Round(spent / g.Count(), 2),
                points = Points(spent),
                tier = Tier(spent).Name,
                nextTier = next?.Name,
                toNextTier = next == null ? (decimal?)null : next.MinSpend - spent,
                firstVisit = first,
                lastVisit = last,
                daysSinceLastVisit = (int)(today - last).TotalDays,
                periodVisits = inPeriod.Count,
                periodSpent = inPeriod.Sum(b => b.Amount),
                isNew = first >= from && first <= to,
                favouriteItems = mine.GroupBy(l => l.Itemid).OrderByDescending(x => x.Sum(l => l.Qty)).Take(3)
                    .Select(x => names.TryGetValue(x.Key, out var n) ? n.Item : "Item").ToList(),
                favouriteCategory = mine.GroupBy(l => names.TryGetValue(l.Itemid, out var n) ? n.Category : "Other")
                    .OrderByDescending(x => x.Sum(l => l.Amount)).Select(x => x.Key).FirstOrDefault()
            };
        })
        .OrderByDescending(r => r.totalSpent)
        .ToList();

        var active = rows.Where(r => r.periodVisits > 0).ToList();
        var periodBillIds = bills.Where(b => b.Date >= from && b.Date <= to).Select(b => b.Billid).ToHashSet();

        return Ok(new
        {
            status = "Success",
            data = new
            {
                branchId = branch,
                fromDate = from,
                toDate = to,
                settings = new { _settings.RupeesPerPoint, _settings.PointsPerStep, _settings.InactiveDays, tiers = _settings.Tiers },
                kpis = new
                {
                    totalCustomers = rows.Count,
                    activeCustomers = active.Count,
                    newCustomers = rows.Count(r => r.isNew),
                    repeatCustomers = active.Count(r => r.visits > 1),
                    repeatRate = active.Count == 0 ? 0 : Math.Round(100m * active.Count(r => r.visits > 1) / active.Count, 1),
                    periodRevenue = active.Sum(r => r.periodSpent),
                    periodVisits = active.Sum(r => r.periodVisits),
                    avgSpendPerCustomer = active.Count == 0 ? 0 : Math.Round(active.Sum(r => r.periodSpent) / active.Count, 2),
                    pointsOutstanding = rows.Sum(r => r.points),
                    inactiveCustomers = rows.Count(r => r.daysSinceLastVisit > _settings.InactiveDays)
                },
                tierCounts = _settings.Tiers.Select(t => new { tier = t.Name, count = rows.Count(r => r.tier == t.Name) }).ToList(),
                // What loyalty customers bought in the period.
                topItems = lines.Where(l => periodBillIds.Contains(l.Billid))
                    .GroupBy(l => l.Itemid)
                    .Select(g => new
                    {
                        item = names.TryGetValue(g.Key, out var n) ? n.Item : "Item",
                        category = names.TryGetValue(g.Key, out var m) ? m.Category : "Other",
                        qty = g.Sum(l => l.Qty),
                        amount = g.Sum(l => l.Amount),
                        customers = g.Select(l => l.CustomerId).Distinct().Count()
                    })
                    .OrderByDescending(x => x.qty).Take(15).ToList(),
                customers = rows
            }
        });
    }

    // One customer: profile, points / tier, item-wise purchases, interests and habits.
    [HttpGet("Customer/{id}")]
    public async Task<IActionResult> CustomerDetail(int id, [FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);
        var customer = await _context.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Customerid == id && c.Branchid == branch);
        var bills = await BillsAsync(branch, id);
        if (customer == null && bills.Count == 0)
            return NotFound(new { status = "Error", message = "Customer not found" });

        var lines = await LinesAsync(branch, id);
        var names = await ItemNamesAsync(lines.Select(l => l.Itemid));
        var orderTypes = await _context.Ordertypes.AsNoTracking().ToDictionaryAsync(o => o.Ordertypeid, o => o.Ordertypename);
        var billDates = bills.ToDictionary(b => b.Billid, b => b.Date);
        decimal spent = bills.Sum(b => b.Amount);
        var next = NextTier(spent);
        var today = DateHelper.GetBusinessDate(DateTime.Now).Date;
        decimal itemsTotal = lines.Sum(l => l.Amount);
        string[] days = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

        return Ok(new
        {
            status = "Success",
            data = new
            {
                customerId = id,
                name = customer?.Name ?? bills.Select(b => b.Name).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)) ?? "Customer",
                phone = customer?.Contactnumber ?? bills.Select(b => b.Phone).FirstOrDefault(p => !string.IsNullOrWhiteSpace(p)),
                email = customer?.Email,
                address = customer?.Address,
                visits = bills.Count,
                totalSpent = spent,
                avgBill = bills.Count == 0 ? 0 : Math.Round(spent / bills.Count, 2),
                points = Points(spent),
                tier = Tier(spent).Name,
                nextTier = next?.Name,
                toNextTier = next == null ? (decimal?)null : next.MinSpend - spent,
                firstVisit = bills.Count == 0 ? (DateTime?)null : bills.Min(b => b.Date),
                lastVisit = bills.Count == 0 ? (DateTime?)null : bills.Max(b => b.Date),
                daysSinceLastVisit = bills.Count == 0 ? (int?)null : (int)(today - bills.Max(b => b.Date)).TotalDays,
                avgDaysBetweenVisits = bills.Select(b => b.Date).Distinct().Count() < 2 ? (double?)null
                    : Math.Round((bills.Max(b => b.Date) - bills.Min(b => b.Date)).TotalDays / (bills.Select(b => b.Date).Distinct().Count() - 1), 1),
                items = lines.GroupBy(l => l.Itemid).Select(g => new
                {
                    item = names.TryGetValue(g.Key, out var n) ? n.Item : "Item",
                    category = names.TryGetValue(g.Key, out var m) ? m.Category : "Other",
                    qty = g.Sum(l => l.Qty),
                    amount = g.Sum(l => l.Amount),
                    timesOrdered = g.Select(l => l.Billid).Distinct().Count(),
                    lastOrdered = g.Max(l => billDates.GetValueOrDefault(l.Billid))
                }).OrderByDescending(x => x.qty).ToList(),
                categories = lines.GroupBy(l => names.TryGetValue(l.Itemid, out var n) ? n.Category : "Other").Select(g => new
                {
                    category = g.Key,
                    qty = g.Sum(l => l.Qty),
                    amount = g.Sum(l => l.Amount),
                    share = itemsTotal == 0 ? 0 : Math.Round(100m * g.Sum(l => l.Amount) / itemsTotal, 1)
                }).OrderByDescending(x => x.amount).ToList(),
                orderTypes = lines.GroupBy(l => l.Ordertypeid).Select(g => new
                {
                    orderType = g.Key.HasValue ? orderTypes.GetValueOrDefault(g.Key.Value) ?? "Other" : "Other",
                    visits = g.Select(l => l.Billid).Distinct().Count()
                }).OrderByDescending(x => x.visits).ToList(),
                paymentModes = bills.GroupBy(b => string.IsNullOrWhiteSpace(b.Mode) ? "other" : b.Mode!.ToLowerInvariant())
                    .Select(g => new { mode = g.Key, bills = g.Count(), amount = g.Sum(b => b.Amount) })
                    .OrderByDescending(x => x.bills).ToList(),
                monthly = bills.GroupBy(b => new DateTime(b.Date.Year, b.Date.Month, 1)).OrderBy(g => g.Key).TakeLast(12)
                    .Select(g => new { month = g.Key.ToString("yyyy-MM"), visits = g.Count(), amount = g.Sum(b => b.Amount) }).ToList(),
                weekdays = days.Select((d, i) => new { day = d, visits = bills.Count(b => (int)b.Date.DayOfWeek == i) }).ToList(),
                timeOfDay = new[]
                {
                    new { slot = "Morning (6-11)", visits = bills.Count(b => b.Time.Hour >= 6 && b.Time.Hour < 11) },
                    new { slot = "Lunch (11-16)", visits = bills.Count(b => b.Time.Hour >= 11 && b.Time.Hour < 16) },
                    new { slot = "Evening (16-19)", visits = bills.Count(b => b.Time.Hour >= 16 && b.Time.Hour < 19) },
                    new { slot = "Dinner (19-24)", visits = bills.Count(b => b.Time.Hour >= 19) },
                    new { slot = "Late night (0-6)", visits = bills.Count(b => b.Time.Hour < 6) }
                },
                bills = bills.OrderByDescending(b => b.Time).Take(50)
                    .Select(b => new { b.Billid, billNumber = b.Billnumber, date = b.Date, time = b.Time, amount = b.Amount, mode = b.Mode }).ToList()
            }
        });
    }
}
