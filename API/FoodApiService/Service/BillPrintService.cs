using System.Drawing;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// Customer bill ticket (moved unchanged from BillController so it can print in the background).
public class BillPrintService
{
    private readonly HotelContext _context;
    private readonly IConfiguration _configuration;
    private readonly PrintQueue _printQueue;

    public BillPrintService(HotelContext context, IConfiguration configuration, PrintQueue printQueue)
    {
        _context = context;
        _configuration = configuration;
        _printQueue = printQueue;
    }

    // Loads everything the bill needs and queues the ticket on the bill printer (same layout as before).
    // Returns the print job (null = bill not found); the job's result is null when printed, else the error.
    public async Task<Task<string?>?> QueueAsync(int billId)
    {
        var bill = await _context.Billheaders.AsNoTracking()
            .Include(x => x.Billdetails)
                .ThenInclude(d => d.Order)
                    .ThenInclude(o => o.Orderdetails)
            .FirstOrDefaultAsync(x => x.Billid == billId);

        if (bill == null) return null;

        string hotelName = _configuration["RestaurantSettings:HotelName"] ?? "RESTAURANT";
        string hotelDescription = _configuration["RestaurantSettings:HotelDescription"] ?? "";
        string cashierName = await _context.Users
            .Where(u => (int?)u.Userid == bill.CreatedBy)
            .Select(u => u.Username)
            .FirstOrDefaultAsync() ?? "Admin";

        // Order type
        string orderTypeName = await _context.Billdetails
            .Where(d => d.Billid == bill.Billid)
            .Select(d => _context.Ordertypes
                .Where(x => (int?)x.Ordertypeid == d.Order.Ordertypeid)
                .Select(x => x.Ordertypename)
                .FirstOrDefault())
            .FirstOrDefaultAsync() ?? "TAKEAWAY";

        // Items grouped by itemid
        var billItemIds = bill.Billdetails
            .SelectMany(d => d.Order?.Orderdetails ?? new List<Orderdetail>())
            .Select(od => od.Itemid).Distinct().ToList();
        var itemNames = await _context.Items.AsNoTracking()
            .Where(i => billItemIds.Contains(i.Itemid))
            .Select(i => new { i.Itemid, i.Itemname })
            .ToDictionaryAsync(i => i.Itemid, i => i.Itemname);
        var items = bill.Billdetails
            .SelectMany(d => d.Order?.Orderdetails ?? new List<Orderdetail>())
            .GroupBy(od => od.Itemid)
            .Select(gp => new
            {
                ItemName = itemNames.GetValueOrDefault(gp.Key) ?? "Unknown Item",
                Price = gp.FirstOrDefault().Price,
                Qty = gp.Sum(x => x.Qty),
                SubTotal = gp.Sum(x => x.Sumofprice)
            })
            .ToList();

        var job = _printQueue.Enqueue(_configuration["PrinterSettings:BillPrinter"], graphics =>
        {
            float y = 10f;
            float left = 10f;
            float width = 263f;

            Font headerFont = new Font("Courier New", 12f, FontStyle.Bold);
            Font normalFont = new Font("Courier New", 9f, FontStyle.Regular);
            Font boldFont = new Font("Courier New", 9f, FontStyle.Bold);

            var centerFormat = new StringFormat { Alignment = StringAlignment.Center };
            var rightFormat = new StringFormat { Alignment = StringAlignment.Far };

            // Hotel name
            graphics.DrawString(hotelName, headerFont, Brushes.Black, new RectangleF(left, y, width, 40f), centerFormat);
            y += 20f;

            // Hotel description
            if (!string.IsNullOrEmpty(hotelDescription))
            {
                SizeF descSize = graphics.MeasureString(hotelDescription, normalFont, (int)width);
                graphics.DrawString(hotelDescription, normalFont, Brushes.Black, new RectangleF(left, y, width, descSize.Height), centerFormat);
                y += descSize.Height + 10f;
            }

            // Bill number
            string billNo = bill.Billnumber.Contains("-") ? bill.Billnumber.Split('-').Last() : bill.Billnumber;
            graphics.DrawString("*** Bill No - " + billNo + " ***", boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Token number
            graphics.DrawString($"Token No#:{bill.Billid}", boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Order type
            graphics.DrawString(orderTypeName.ToUpper(), boldFont, Brushes.Black, new RectangleF(left, y, width, 15f), centerFormat);
            y += 15f;

            // Cashier
            graphics.DrawString("Cashier# " + cashierName, normalFont, Brushes.Black, left, y);
            y += 15f;

            // Date
            graphics.DrawString($"Date : {bill.Datetime:dd/MM/yyyy hh:mm tt}", normalFont, Brushes.Black, left, y);
            y += 20f;

            // Separator
            string separator = new string('-', 37);
            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            // Column headers
            graphics.DrawString("ITEM NAME", boldFont, Brushes.Black, left, y);
            graphics.DrawString("PRICE", boldFont, Brushes.Black, left + 130f, y);
            graphics.DrawString("QTY", boldFont, Brushes.Black, left + 185f, y);
            graphics.DrawString("SUB", boldFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            // Items grouped by itemid
            int itemCount = 0;
            decimal totalQty = 0;

            float nameWidth = 120f;
            foreach (var item in items)
            {
                if (item.Qty > 0)
                {
                    SizeF nameSize = graphics.MeasureString(item.ItemName, boldFont, (int)nameWidth);
                    graphics.DrawString(item.ItemName, boldFont, Brushes.Black, new RectangleF(left, y, nameWidth, nameSize.Height));
                    graphics.DrawString($"{item.Price:F2}", normalFont, Brushes.Black, left + 130f, y);
                    graphics.DrawString($"{item.Qty}", normalFont, Brushes.Black, left + 185f, y);
                    graphics.DrawString($"{item.SubTotal:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
                    y += nameSize.Height + 3f;
                    itemCount++;
                    totalQty += (decimal)item.Qty;
                }
            }

            // Totals
            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            graphics.DrawString("Sub Total RS", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{bill.Subtotal:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            decimal taxRate = 2.500m;
            decimal halfTax = bill.Tax.GetValueOrDefault() / 2m;
            graphics.DrawString($"CGST:{taxRate:F3}%", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{halfTax:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString($"SGST:{taxRate:F3}%", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{halfTax:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            decimal subtotalPlusTax = bill.Subtotal.GetValueOrDefault() + bill.Tax.GetValueOrDefault();
            decimal total = bill.Totalamount ?? decimal.Round(subtotalPlusTax, 0);
            decimal roundOff = total - subtotalPlusTax;
            graphics.DrawString("Round Off", normalFont, Brushes.Black, left + 60f, y);
            graphics.DrawString($"{roundOff:F2}", normalFont, Brushes.Black, left + width, y, rightFormat);
            y += 15f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
            y += 12f;

            graphics.DrawString("Total RS", headerFont, Brushes.Black, left + 40f, y);
            graphics.DrawString($"{total:F2}", headerFont, Brushes.Black, left + width, y, rightFormat);
            y += 25f;

            graphics.DrawString($"Total Items - {itemCount}, Qty - {totalQty:G0}", normalFont, Brushes.Black, left, y);
            y += 15f;

            graphics.DrawString("Settlement Type : " + bill.Paymentmode, normalFont, Brushes.Black, left, y);
            y += 20f;

            graphics.DrawString(separator, normalFont, Brushes.Black, left, y);
        });

        return job;
    }
}
