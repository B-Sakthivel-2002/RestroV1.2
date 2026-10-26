using System.Drawing;
using System.Drawing.Printing;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// Result of printing one kitchen's part of a KOT. KitchenId null = items without an (active) kitchen,
// printed on PrinterSettings:KitchenPrinter.
public record KotPrintResult(int? KitchenId, string Kitchen, string? Printer, int Items, bool Ok, string? Error);

// Kitchen order tickets: an order's items are grouped by the kitchen that prepares them and each
// group prints on that kitchen's printer. One kitchen's printer failing never stops the others.
public class KotPrintService
{
    public const string DefaultKitchenName = "Kitchen";

    private readonly HotelContext _context;
    private readonly IConfiguration _configuration;

    public KotPrintService(HotelContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    private string? DefaultPrinter => _configuration["PrinterSettings:KitchenPrinter"];

    // kitchenFilter: null = every kitchen of the order, 0 = only the items without a kitchen, n = only kitchen n.
    public List<KotPrintResult> PrintOrder(int orderId, int? kitchenFilter = null)
    {
        var results = new List<KotPrintResult>();
        var order = _context.Orders.AsNoTracking().Include(o => o.Orderdetails).FirstOrDefault(o => o.Orderid == orderId);
        if (order == null || order.Orderdetails.Count == 0)
            return results;

        string waiterName = _context.Users.Where(u => u.Userid == order.Waiterid).Select(u => u.Username).FirstOrDefault() ?? "NA";
        string orderType = _context.Ordertypes.Where(o => o.Ordertypeid == order.Ordertypeid).Select(o => o.Ordertypename).FirstOrDefault() ?? "";
        string tableName = order.Tableid > 0
            ? _context.Tables.Where(t => t.Tableid == order.Tableid).Select(t => t.Tablename).FirstOrDefault() ?? $"Table {order.Tableid}"
            : "";

        var itemIds = order.Orderdetails.Select(d => d.Itemid).Distinct().ToList();
        var items = _context.Items.AsNoTracking().Where(i => itemIds.Contains(i.Itemid))
            .Select(i => new { i.Itemid, i.Itemname, i.Kitchenid })
            .ToDictionary(i => i.Itemid);
        var kitchenIds = items.Values.Where(i => i.Kitchenid != null).Select(i => i.Kitchenid!.Value).Distinct().ToList();
        // Inactive kitchens fall back to the default kitchen printer.
        var kitchens = _context.Kitchens.AsNoTracking().Where(k => kitchenIds.Contains(k.Kitchenid) && k.Status).ToDictionary(k => k.Kitchenid);

        var groups = order.Orderdetails
            .GroupBy(d => items.TryGetValue(d.Itemid, out var item) && item.Kitchenid is int kid && kitchens.ContainsKey(kid) ? kid : (int?)null)
            .OrderBy(g => g.Key == null).ThenBy(g => g.Key);

        foreach (var group in groups)
        {
            if (kitchenFilter != null && (group.Key ?? 0) != kitchenFilter)
                continue;

            var kitchen = group.Key is int id ? kitchens[id] : null;
            string kitchenName = kitchen?.Kitchenname ?? DefaultKitchenName;
            string? printer = kitchen?.Printername ?? DefaultPrinter;
            var lines = group.Select(d => (d.Qty, Name: items.TryGetValue(d.Itemid, out var it) ? it.Itemname ?? "Unknown" : "Unknown")).ToList();

            try
            {
                Print(printer, g => DrawTicket(g, order, kitchenName, orderType, tableName, waiterName, lines));
                results.Add(new KotPrintResult(group.Key, kitchenName, printer, lines.Count, true, null));
            }
            catch (Exception ex)
            {
                results.Add(new KotPrintResult(group.Key, kitchenName, printer, lines.Count, false, ex.Message));
            }
        }
        return results;
    }

    // One line per failed kitchen, for the captain's message.
    public static string Describe(IEnumerable<KotPrintResult> failed) =>
        string.Join("; ", failed.Select(r => $"{r.Kitchen}: {r.Error}"));

    // Returns null when the test ticket was sent, else the error.
    public string? PrintTest(Kitchen kitchen)
    {
        try
        {
            Print(kitchen.Printername, g =>
            {
                var font = new Font("Courier New", 10f, FontStyle.Bold);
                g.DrawString("TEST PRINT", font, Brushes.Black, 10f, 10f);
                g.DrawString("Kitchen : " + kitchen.Kitchenname, font, Brushes.Black, 10f, 30f);
                g.DrawString(DateTime.Now.ToString("dd/MM/yyyy hh:mm tt"), font, Brushes.Black, 10f, 50f);
            });
            return null;
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }

    private static void Print(string? printerName, Action<Graphics> draw)
    {
        var printDocument = new PrintDocument();
        printDocument.DefaultPageSettings.PaperSize = new PaperSize("ThermalRoll", 283, 600);
        printDocument.PrintPage += (sender, e) => draw(e.Graphics!);

        // No printer name = the Windows default printer (as before kitchens existed).
        if (!string.IsNullOrWhiteSpace(printerName))
        {
            printDocument.PrinterSettings.PrinterName = printerName;
            if (!printDocument.PrinterSettings.IsValid)
                throw new Exception($"Printer '{printerName}' not found on the API computer.");
        }
        printDocument.Print();
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
