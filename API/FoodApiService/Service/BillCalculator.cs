using System.Globalization;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// appsettings "BillingSettings".
public class BillingSettings
{
    // true = item prices include tax (tax is taken out of the price), false = tax is added on top.
    public bool TaxInclusive { get; set; } = true;
}

public class BillCalcResult
{
    public double SubTotal { get; set; }
    public double Tax { get; set; }
    public double Discount { get; set; }
    public double ExtraAmount { get; set; }
    // Whole rupees, as the order screen always showed it.
    public double Total { get; set; }
    public bool TaxInclusive { get; set; }
    public List<object> Taxes { get; set; } = new();
    public List<object> ExtraCharges { get; set; } = new();
    public int? DiscountId { get; set; }

    // Amounts as the order screen reads them.
    public object ToResponse() => new
    {
        subtotal = SubTotal,
        tax = Tax,
        discount = Discount,
        extraamount = ExtraAmount,
        total = Total,
        taxinclusive = TaxInclusive
    };
}

// Bill totals, calculated on the server. This is the order screen's former calculatetotalprice()
// ported step by step WITHOUT changing the maths: JavaScript numbers are doubles, so this uses double,
// rounds like Number.toFixed, and keeps the same order (taxes -> discount -> extra charges, each on the
// running total). See CalculateAsync for the inputs.
public class BillCalculator
{
    public const string CustomDiscountName = "customize";

    private readonly HotelContext _context;

    public BillingSettings Settings { get; }

    public BillCalculator(HotelContext context, IConfiguration configuration)
    {
        _context = context;
        Settings = configuration.GetSection("BillingSettings").Get<BillingSettings>() ?? new BillingSettings();
    }

    // orderTotals: the totalprice of every order on the bill. orderTypeId: picks the extra charges.
    // discountId: the chosen discount (null = none); customDiscount: the amount typed for the "customize" discount.
    public async Task<BillCalcResult> CalculateAsync(int branchId, IEnumerable<double> orderTotals, int? orderTypeId,
        int? discountId, double? customDiscount)
    {
        // Same lists the order screen loaded (Tax / Discounts / Extracharge APIs: the branch's rows, by id).
        var taxes = await _context.Taxes.AsNoTracking().Where(t => t.Branchid == branchId).OrderBy(t => t.Taxid).ToListAsync();
        var extras = await _context.Extracharges.AsNoTracking().Where(e => e.Branchid == branchId).OrderBy(e => e.Extrachargeid).ToListAsync();
        var discount = discountId is > 0
            ? await _context.Discounts.AsNoTracking().FirstOrDefaultAsync(d => d.Discountid == discountId && d.Branchid == branchId)
            : null;

        return Compute(orderTotals, taxes, extras, discount, orderTypeId, customDiscount, Settings.TaxInclusive);
    }

    // The arithmetic only (no database): lists in the order the screen had them.
    public static BillCalcResult Compute(IEnumerable<double> orderTotals, IReadOnlyList<Tax> taxes, IReadOnlyList<Extracharge> extras,
        Discount? discount, int? orderTypeId, double? customDiscount, bool inclusive)
    {
        var result = new BillCalcResult { TaxInclusive = inclusive, DiscountId = discount?.Discountid };

        // let localtotalprice = orders.reduce((sum, order) => sum + (Number(order.totalprice) || 0), 0)
        double local = 0;
        foreach (var t in orderTotals)
            local += double.IsNaN(t) ? 0 : t;
        result.SubTotal = ToFixed(local, 2);

        // Taxes: inclusive = taken out of the total, exclusive = added to the running total.
        if (taxes.Count > 0 && local != 0)
        {
            double localTax = 0;
            foreach (var x in taxes)
            {
                bool inRange = x.Taxrangestatus == true ? N(x.Taxfrom) <= local && N(x.Taxto) >= local : true;
                if (!inRange) continue;
                double amount = 0;
                double rate = N(x.Taxrate);
                if (x.Taxtype == "percentage")
                    amount = inclusive ? local - local / (1 + rate / 100) : local * rate / 100;
                else if (x.Taxtype == "flat")
                    amount = rate;
                if (amount != 0 && !double.IsNaN(amount))
                {
                    if (!inclusive) local += amount;
                    localTax += amount;
                    result.Taxes.Add(new { taxid = x.Taxid, taxname = x.Taxname, amount = ToFixed(amount, 2) });
                }
            }
            result.Tax = ToFixed(localTax, 2);
            if (inclusive)
                result.SubTotal = ToFixed(local - localTax, 2);
        }

        // Discount on the running total (after tax).
        if (discount != null)
        {
            if (discount.Discountname == CustomDiscountName)
            {
                double custom = customDiscount is double c && !double.IsNaN(c) ? c : 0;
                result.Discount = ToFixed(custom, 2);
                local -= custom;
            }
            else
            {
                bool inRange = discount.Discountrangestatus == true ? N(discount.Discountfrom) <= local && N(discount.Discountto) >= local : true;
                if (inRange)
                {
                    double amount = 0;
                    if (discount.Discounttype == "percentage")
                        amount = local * N(discount.Discountrate) / 100;
                    else if (discount.Discounttype == "flat")
                        amount = N(discount.Discountrate);
                    local -= amount;
                    result.Discount = ToFixed(amount, 2);
                }
            }
        }

        // Extra charges of this order type, each on the running total.
        if (extras.Count > 0 && local != 0)
        {
            double localExtra = 0;
            foreach (var x in extras)
            {
                if (x.Ordertypeid != orderTypeId) continue;
                bool inRange = x.Extrachargestatus == true ? N(x.Extrachargefrom) <= local && N(x.Extrachargeto) >= local : true;
                if (!inRange) continue;
                double amount = 0;
                if (x.Extrachargetype == "percentage")
                    amount = local * N(x.Extrachargerate) / 100;
                else if (x.Extrachargetype == "flat")
                    amount = N(x.Extrachargerate);
                if (amount != 0 && !double.IsNaN(amount))
                {
                    local += amount;
                    localExtra += amount;
                    result.ExtraCharges.Add(new { extrachargeid = x.Extrachargeid, extrachargename = x.Extrachargename, amount = ToFixed(amount, 2) });
                }
            }
            result.ExtraAmount = ToFixed(localExtra, 2);
        }

        // parseFloat(localtotalprice.toFixed())
        result.Total = ToFixed(local, 0);
        return result;
    }

    // Totals of a bill for saved orders (CreateBill): order totals and type from the database.
    public async Task<BillCalcResult> CalculateForOrdersAsync(int branchId, IReadOnlyCollection<int> orderIds, int? discountId, double? customDiscount)
    {
        var orders = await _context.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Orderid))
            .OrderBy(o => o.Orderid).Select(o => new { o.Totalprice, o.Ordertypeid }).ToListAsync();
        return await CalculateAsync(branchId, orders.Select(o => (double)(o.Totalprice ?? 0m)), orders.FirstOrDefault()?.Ordertypeid,
            discountId, customDiscount);
    }

    // JavaScript null / undefined in arithmetic and comparisons counts as 0.
    private static double N(decimal? value) => (double)(value ?? 0m);

    // Number.prototype.toFixed: rounds the EXACT binary value of the double, an exact tie goes away from zero
    // (2.5 -> 3, 0.125 -> 0.13). .NET's "F" format rounds exact ties to even, so the rounding is done here on
    // the exact decimal digits (.NET Core 3+ prints a double's exact digits for any precision).
    public static double ToFixed(double value, int digits)
    {
        if (double.IsNaN(value) || double.IsInfinity(value))
            return value;
        string exact = Math.Abs(value).ToString("F" + (digits + 60), CultureInfo.InvariantCulture);
        int point = exact.IndexOf('.');
        string kept = exact[..(point + 1 + digits)].TrimEnd('.');
        bool roundUp = exact[point + 1 + digits] >= '5';
        decimal result = decimal.Parse(kept, CultureInfo.InvariantCulture);
        if (roundUp)
            result += digits == 0 ? 1m : 1m / (decimal)Math.Pow(10, digits);
        double d = (double)result;
        return value < 0 && d != 0 ? -d : d;
    }
}
