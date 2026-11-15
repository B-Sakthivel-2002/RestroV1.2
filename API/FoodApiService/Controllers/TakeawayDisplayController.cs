using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Customer-facing TV for take-away orders (read only): which tokens are being prepared and which are
// ready to collect. The token is the "Token No#" printed on the customer's bill (the bill id), or the
// order number when the order has no bill yet. No phone, amount or items here: the screen is public.
[Route("api/[controller]")]
[Authorize(Roles = "Manager,Admin,SuperAdmin,Captain")]
public class TakeawayDisplayController : ControllerBase
{
    private const int TakeawayTypeId = 2;

    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly IConfiguration _configuration;

    public TakeawayDisplayController(HotelContext context, ITenantContext tenant, IConfiguration configuration)
    {
        _context = context;
        _tenant = tenant;
        _configuration = configuration;
    }

    // Preparing: some item is still in the kitchen. Ready: every item is ready or picked up, at least one
    // still waiting at the counter. A token drops off when all its items are marked picked up, when it is
    // cancelled, or after TakeawayDisplay:ReadyMinutes (default 5) on the Ready list.
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(branchId);
        var now = DateTime.Now;
        var today = DateHelper.GetBusinessDate(now).Date;
        int readyMinutes = _configuration.GetValue("TakeawayDisplay:ReadyMinutes", 5);

        var rows = await _context.Orders.AsNoTracking()
            .Where(o => o.Branchid == branch && o.Ordertypeid == TakeawayTypeId
                        && o.Businessdate != null && o.Businessdate.Value.Date == today
                        && o.Status != "cancelled"
                        && !o.Billdetails.Any(d => d.Bill.Lifecyclestatus == BillLifecycle.Cancelled))
            .Select(o => new
            {
                o.Orderid,
                o.Ordernumber,
                o.Timedate,
                BillId = o.Billdetails.Select(d => (int?)d.Billid).FirstOrDefault(),
                Customer = _context.Customers.Where(c => c.Customerid == o.Customerid).Select(c => c.Name).FirstOrDefault(),
                Lines = o.Orderdetails.Select(d => new { d.KOTStatus, d.Kotstatusat }).ToList()
            })
            .ToListAsync();

        static bool InKitchen(string? s) => string.IsNullOrEmpty(s);

        // One token per bill (a bill can hold several orders), else per order.
        var tokens = rows
            .Where(r => r.Lines.Count > 0)
            .GroupBy(r => r.BillId.HasValue ? "b" + r.BillId : "o" + r.Orderid)
            .Select(g =>
            {
                var lines = g.SelectMany(r => r.Lines).ToList();
                bool preparing = lines.Any(l => InKitchen(l.KOTStatus));
                bool waiting = lines.Any(l => l.KOTStatus == KotStatuses.ReadyToServe);
                var first = g.OrderBy(r => r.Timedate).First();
                return new
                {
                    token = first.BillId?.ToString() ?? OrderToken(first.Ordernumber) ?? first.Orderid.ToString(),
                    customer = FirstName(g.Select(r => r.Customer).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n))),
                    status = preparing ? "preparing" : waiting ? "ready" : "collected",
                    orderedat = first.Timedate,
                    readyat = preparing ? (DateTime?)null : lines.Max(l => l.Kotstatusat)
                };
            })
            .Where(t => t.status == "preparing"
                        || (t.status == "ready" && (t.readyat == null || (now - t.readyat.Value).TotalMinutes < readyMinutes)))
            .ToList();

        return Ok(new
        {
            status = "Success",
            preparing = tokens.Where(t => t.status == "preparing").OrderBy(t => t.orderedat).ToList(),
            ready = tokens.Where(t => t.status == "ready").OrderByDescending(t => t.readyat).ToList(),
            summary = new
            {
                branchId = branch,
                branchName = await _context.Branches.AsNoTracking().Where(b => b.Branchid == branch).Select(b => b.Branchname).FirstOrDefaultAsync() ?? "",
                serverTime = now,
                readyMinutes
            }
        });
    }

    // "...-010" -> "10" (the running number of an order that has no bill yet).
    private static string? OrderToken(string? orderNumber)
    {
        string? tail = orderNumber?.Split('-').Last().TrimStart('0');
        return string.IsNullOrEmpty(tail) ? null : tail;
    }

    // Only the first name goes on a public screen.
    private static string? FirstName(string? name) =>
        string.IsNullOrWhiteSpace(name) ? null : name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
}
