using System.Drawing;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// Result of printing one kitchen's part of a KOT. KitchenId null = items without an (active) kitchen,
// printed on PrinterSettings:KitchenPrinter. Pending = still printing in the background when the
// request answered (not a failure; a later failure is only logged).
public record KotPrintResult(int? KitchenId, string Kitchen, string? Printer, int Items, bool Ok, string? Error, bool Pending = false);

// Kitchen order tickets: an order's items are grouped by the kitchen that prepares them and each
// group prints on that kitchen's printer. One kitchen's printer failing never stops the others.
// Printing goes through PrintQueue, so a slow or stuck printer never holds up the request.
public class KotPrintService
{
    public const string DefaultKitchenName = "Kitchen";

    private readonly HotelContext _context;
    private readonly IConfiguration _configuration;
    private readonly PrintQueue _queue;

    public KotPrintService(HotelContext context, IConfiguration configuration, PrintQueue queue)
    {
        _context = context;
        _configuration = configuration;
        _queue = queue;
    }

    private string? DefaultPrinter => _configuration["PrinterSettings:KitchenPrinter"];

    // kitchenFilter: null = every kitchen of the order, 0 = only the items without a kitchen, n = only kitchen n.
    public async Task<List<KotPrintResult>> PrintOrderAsync(int orderId, int? kitchenFilter = null)
    {
        var results = new List<KotPrintResult>();
        var order = await _context.Orders.AsNoTracking().Include(o => o.Orderdetails).FirstOrDefaultAsync(o => o.Orderid == orderId);
        if (order == null || order.Orderdetails.Count == 0)
            return results;

        string waiterName = await _context.Users.Where(u => u.Userid == order.Waiterid).Select(u => u.Username).FirstOrDefaultAsync() ?? "NA";
        string orderType = await _context.Ordertypes.Where(o => o.Ordertypeid == order.Ordertypeid).Select(o => o.Ordertypename).FirstOrDefaultAsync() ?? "";
        string tableName = order.Tableid > 0
            ? await _context.Tables.Where(t => t.Tableid == order.Tableid).Select(t => t.Tablename).FirstOrDefaultAsync() ?? $"Table {order.Tableid}"
            : "";

        var itemIds = order.Orderdetails.Select(d => d.Itemid).Distinct().ToList();
        var items = (await _context.Items.AsNoTracking().Where(i => itemIds.Contains(i.Itemid))
                .Select(i => new { i.Itemid, i.Itemname, i.Kitchenid })
                .ToListAsync())
            .ToDictionary(i => i.Itemid);
        var kitchenIds = items.Values.Where(i => i.Kitchenid != null).Select(i => i.Kitchenid!.Value).Distinct().ToList();
        // Inactive kitchens fall back to the default kitchen printer.
        var kitchens = (await _context.Kitchens.AsNoTracking().Where(k => kitchenIds.Contains(k.Kitchenid) && k.Status).ToListAsync())
            .ToDictionary(k => k.Kitchenid);

        var groups = order.Orderdetails
            .GroupBy(d => items.TryGetValue(d.Itemid, out var item) && item.Kitchenid is int kid && kitchens.ContainsKey(kid) ? kid : (int?)null)
            .OrderBy(g => g.Key == null).ThenBy(g => g.Key);

        var tickets = new List<(int? KitchenId, string Kitchen, string? Printer, int Items)>();
        var jobs = new List<Task<string?>>();
        foreach (var group in groups)
        {
            if (kitchenFilter != null && (group.Key ?? 0) != kitchenFilter)
                continue;

            var kitchen = group.Key is int id ? kitchens[id] : null;
            string kitchenName = kitchen?.Kitchenname ?? DefaultKitchenName;
            string? printer = kitchen?.Printername ?? DefaultPrinter;
            var lines = group.Select(d => (d.Qty, Name: items.TryGetValue(d.Itemid, out var it) ? it.Itemname ?? "Unknown" : "Unknown")).ToList();

            tickets.Add((group.Key, kitchenName, printer, lines.Count));
            jobs.Add(_queue.Enqueue(printer, g => DrawTicket(g, order, kitchenName, orderType, tableName, waiterName, lines)));
        }

        var outcomes = await _queue.WaitAsync(jobs);
        for (int i = 0; i < tickets.Count; i++)
        {
            var t = tickets[i];
            string? outcome = outcomes[i];
            results.Add(outcome == ""
                ? new KotPrintResult(t.KitchenId, t.Kitchen, t.Printer, t.Items, true, null, Pending: true)
                : new KotPrintResult(t.KitchenId, t.Kitchen, t.Printer, t.Items, outcome == null, outcome));
        }
        return results;
    }

    // One line per failed kitchen, for the captain's message.
    public static string Describe(IEnumerable<KotPrintResult> failed) =>
        string.Join("; ", failed.Select(r => $"{r.Kitchen}: {r.Error}"));

    // Returns null when the test ticket was printed (or is still printing), else the error.
    public async Task<string?> PrintTestAsync(Kitchen kitchen)
    {
        var job = _queue.Enqueue(kitchen.Printername, g =>
        {
            var font = new Font("Courier New", 10f, FontStyle.Bold);
            g.DrawString("TEST PRINT", font, Brushes.Black, 10f, 10f);
            g.DrawString("Kitchen : " + kitchen.Kitchenname, font, Brushes.Black, 10f, 30f);
            g.DrawString(DateTime.Now.ToString("dd/MM/yyyy hh:mm tt"), font, Brushes.Black, 10f, 50f);
        });
        string? outcome = (await _queue.WaitAsync(new[] { job }))[0];
        return string.IsNullOrEmpty(outcome) ? null : outcome;
    }

    private static void DrawTicket(Graphics g, Order order, string kitchenName, string orderType, string tableName, string waiterName,
        List<(int Qty, string Name)> lines)
    {
        float y = 10f, x = 10f, width = 263f;
        Font headerFont = new("Courier New", 12f, FontStyle.Bold);
        Font boldFont = new("Courier New", 10f, FontStyle.Bold);
        Font normalFont = new("Courier New", 9f, FontStyle.Regular);
        StringFormat centerFormat = new() { Alignment = StringAlignment.Center };
        string separator = new('-', 37);

        g.DrawString("KITCHEN ORDER TICKET", headerFont, Brushes.Black, new RectangleF(x, y, width, 20f), centerFormat);
        y += 25f;
        g.DrawString(kitchenName.ToUpperInvariant(), headerFont, Brushes.Black, new RectangleF(x, y, width, 20f), centerFormat);
        y += 25f;
        g.DrawString($"KOT No : {order.Orderid}", boldFont, Brushes.Black, x, y); y += 15f;
        g.DrawString("Order No : " + order.Ordernumber, normalFont, Brushes.Black, x, y); y += 15f;
        g.DrawString("Type : " + orderType, normalFont, Brushes.Black, x, y); y += 15f;
        if (order.Tableid > 0) { g.DrawString($"Table : {tableName}", normalFont, Brushes.Black, x, y); y += 15f; }
        if (!string.IsNullOrEmpty(order.Guestlabel)) { g.DrawString("Guest : " + order.Guestlabel, normalFont, Brushes.Black, x, y); y += 15f; }

        g.DrawString("Waiter : " + waiterName, normalFont, Brushes.Black, x, y); y += 15f;
        g.DrawString($"Time : {order.Timedate:dd/MM/yyyy hh:mm tt}", normalFont, Brushes.Black, x, y); y += 15f;
        g.DrawString(separator, normalFont, Brushes.Black, x, y); y += 15f;

        foreach (var line in lines)
        {
            g.DrawString($"{line.Qty} x {line.Name}", boldFont, Brushes.Black, x, y); y += 20f;
        }

        g.DrawString(separator, normalFont, Brushes.Black, x, y); y += 15f;
        if (!string.IsNullOrWhiteSpace(order.Comments))
        {
            g.DrawString("Notes:", boldFont, Brushes.Black, x, y); y += 15f;
            SizeF size = g.MeasureString(order.Comments, normalFont, (int)width);
            g.DrawString(order.Comments, normalFont, Brushes.Black, new RectangleF(x, y, width, size.Height));
            y += size.Height + 10f;
        }
        g.DrawString("*** END OF KOT ***", boldFont, Brushes.Black, new RectangleF(x, y, width, 20f), centerFormat);
    }
}
