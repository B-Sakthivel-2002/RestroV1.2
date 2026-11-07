using System.Text;
using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Sales report of a period (summary + item-wise) sent to the owner's WhatsApp
// (WhatsAppSettings:OwnerReport:OwnerNumbers). Same bills as the Sales Report page: by business date.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class OwnerReportController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly WhatsAppService _whatsApp;

    public OwnerReportController(HotelContext context, ITenantContext tenant, WhatsAppService whatsApp)
    {
        _context = context;
        _tenant = tenant;
        _whatsApp = whatsApp;
    }

    public class SendRequest
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public int? BranchId { get; set; }
    }

    [HttpPost("Send")]
    public async Task<IActionResult> Send([FromBody] SendRequest request, CancellationToken ct)
    {
        var cfg = _whatsApp.Settings.OwnerReport;
        if (!_whatsApp.IsConfigured)
            return BadRequest(new { status = "Error", message = "WhatsApp is not set up (WhatsAppSettings in appsettings.json)" });
        if (!cfg.Enabled)
            return BadRequest(new { status = "Error", message = "Owner report is switched off (WhatsAppSettings:OwnerReport:Enabled)" });
        if (!cfg.OwnerNumbers.Any(n => !string.IsNullOrWhiteSpace(n)))
            return BadRequest(new { status = "Error", message = "No owner mobile number in WhatsAppSettings:OwnerReport:OwnerNumbers" });

        var report = await BuildAsync(request);
        if (report == null)
            return BadRequest(new { status = "Error", message = "From date must be before To date" });

        var results = await _whatsApp.SendOwnerReportAsync(report.Value.Parameters, report.Value.Text, ct);
        bool allOk = results.All(r => r.Result.Ok);
        return Ok(new
        {
            status = allOk ? "Success" : "Error",
            message = allOk
                ? $"Sales report sent to {results.Count} number(s)"
                : "Not sent to: " + string.Join("; ", results.Where(r => !r.Result.Ok).Select(r => $"{r.To} ({r.Result.Detail})")),
            results = results.Select(r => new { to = r.To, ok = r.Result.Ok }).ToList(),
            preview = report.Value.Text
        });
    }

    // Report text without sending (to check what the owner will get).
    [HttpPost("Preview")]
    public async Task<IActionResult> Preview([FromBody] SendRequest request)
    {
        var report = await BuildAsync(request);
        if (report == null)
            return BadRequest(new { status = "Error", message = "From date must be before To date" });
        return Ok(new { status = "Success", data = new { text = report.Value.Text, parameters = report.Value.Parameters } });
    }

    private async Task<(string[] Parameters, string Text)?> BuildAsync(SendRequest request)
    {
        var from = request.FromDate.Date;
        var to = request.ToDate.Date;
        if (to < from)
            return null;

        var tenant = await _tenant.GetAsync();
        int branch = tenant.ResolveBranch(request.BranchId);
        string branchName = await _context.Branches.Where(b => b.Branchid == branch).Select(b => b.Branchname).FirstOrDefaultAsync() ?? "";

        var toEnd = to.AddDays(1);
        var bills = await _context.Billheaders.AsNoTracking()
            .Where(b => b.Branchid == branch && b.Businessdate >= from && b.Businessdate < toEnd)
            .Select(b => new
            {
                b.Billid, b.Totalamount, b.Subtotal, b.Tax, b.Discount, b.Extraamount, b.Status, b.Paymentmode, b.Iscomplementary
            })
            .ToListAsync();
        var billIds = bills.Select(b => b.Billid).ToList();

        var orders = await (from bd in _context.Billdetails
                            join o in _context.Orders on bd.Orderid equals o.Orderid
                            where billIds.Contains(bd.Billid)
                            select new { o.Orderid, o.Ordertypeid, o.Totalprice }).Distinct().ToListAsync();
        var orderTypes = await _context.Ordertypes.AsNoTracking().ToDictionaryAsync(o => o.Ordertypeid, o => o.Ordertypename);
        var orderIds = orders.Select(o => o.Orderid).ToList();
        var items = await (from od in _context.Orderdetails
                           where orderIds.Contains(od.Orderid) && od.Qty > 0
                           group od by od.Itemid into g
                           select new { Itemid = g.Key, Qty = g.Sum(x => x.Qty), Amount = g.Sum(x => x.Sumofprice ?? x.Qty * x.Price) })
            .ToListAsync();
        var itemIds = items.Select(i => i.Itemid).ToList();
        var itemNames = await _context.Items.AsNoTracking().Where(i => itemIds.Contains(i.Itemid))
            .ToDictionaryAsync(i => i.Itemid, i => i.Itemname ?? "Item");
        var itemList = items.Select(i => new { Name = itemNames.GetValueOrDefault(i.Itemid) ?? "Item", i.Qty, i.Amount })
            .OrderByDescending(i => i.Amount).ToList();

        decimal total = bills.Sum(b => b.Totalamount ?? 0m);
        decimal subtotal = bills.Sum(b => b.Subtotal ?? 0m);
        decimal tax = bills.Sum(b => b.Tax ?? 0m);
        decimal discount = bills.Sum(b => b.Discount ?? 0m);
        decimal extra = bills.Sum(b => b.Extraamount ?? 0m);
        var paidBills = bills.Where(b => b.Status == "paid" && b.Iscomplementary != true).ToList();
        decimal paid = paidBills.Sum(b => b.Totalamount ?? 0m);
        decimal unpaid = bills.Where(b => b.Status != "paid" && b.Iscomplementary != true).Sum(b => b.Totalamount ?? 0m);
        decimal complimentary = bills.Where(b => b.Iscomplementary == true).Sum(b => b.Totalamount ?? 0m);
        var modes = paidBills.GroupBy(b => string.IsNullOrWhiteSpace(b.Paymentmode) ? "Other" : Cap(b.Paymentmode!))
            .Select(g => (Mode: g.Key, Amount: g.Sum(b => b.Totalamount ?? 0m))).OrderByDescending(m => m.Amount).ToList();
        var types = orders.GroupBy(o => o.Ordertypeid.HasValue ? orderTypes.GetValueOrDefault(o.Ordertypeid.Value) ?? "Other" : "Other")
            .Select(g => (Type: g.Key, Orders: g.Count(), Amount: g.Sum(o => o.Totalprice ?? 0m))).OrderByDescending(t => t.Amount).ToList();

        string period = from == to ? from.ToString("dd-MM-yyyy") : $"{from:dd-MM-yyyy} to {to:dd-MM-yyyy}";
        string modeText = modes.Count == 0 ? "-" : string.Join(", ", modes.Select(m => $"{m.Mode} {Money(m.Amount)}"));
        int max = Math.Max(1, _whatsApp.Settings.OwnerReport.MaxItemsInTemplate);
        string topItems = itemList.Count == 0 ? "-"
            : string.Join("; ", itemList.Take(max).Select(i => $"{i.Name} x{i.Qty} {Money(i.Amount)}"))
              + (itemList.Count > max ? $"; +{itemList.Count - max} more" : "");

        var parameters = new[]
        {
            branchName,
            period,
            bills.Count.ToString(),
            Money(total),
            $"Paid {Money(paid)}, Unpaid {Money(unpaid)}, Complimentary {Money(complimentary)}",
            $"Tax {Money(tax)}, Discount {Money(discount)}",
            modeText,
            topItems
        };

        var text = new StringBuilder();
        text.AppendLine($"*Sales Report - {branchName}*");
        text.AppendLine(period);
        text.AppendLine();
        text.AppendLine("*Summary*");
        text.AppendLine($"Bills: {bills.Count}");
        text.AppendLine($"Sub total: {Money(subtotal)}");
        text.AppendLine($"Tax: {Money(tax)}");
        text.AppendLine($"Discount: {Money(discount)}");
        if (extra != 0) text.AppendLine($"Extra charges: {Money(extra)}");
        text.AppendLine($"*Total sales: {Money(total)}*");
        text.AppendLine($"Paid: {Money(paid)} | Unpaid: {Money(unpaid)} | Complimentary: {Money(complimentary)}");
        if (modes.Count > 0) text.AppendLine("Payment: " + modeText);
        if (types.Count > 0) text.AppendLine("Order types: " + string.Join(", ", types.Select(t => $"{t.Type} {t.Orders} ({Money(t.Amount)})")));
        text.AppendLine();
        text.AppendLine("*Item wise*");
        if (itemList.Count == 0) text.AppendLine("No items sold");
        foreach (var i in itemList)
            text.AppendLine($"{i.Name} x{i.Qty} - {Money(i.Amount)}");

        // WhatsApp text messages are limited to 4096 characters.
        string body = text.ToString().TrimEnd();
        if (body.Length > 4000)
            body = body[..3990] + "\n...";
        return (parameters, body);
    }

    private static string Money(decimal amount) => "Rs." + amount.ToString("#,##0.00");

    // "upi" -> "UPI", "cash" -> "Cash".
    private static string Cap(string mode)
    {
        string s = mode.Trim().ToLowerInvariant();
        return s == "upi" ? "UPI" : s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..];
    }
}
