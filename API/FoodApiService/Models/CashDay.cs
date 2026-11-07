namespace FoodApiService.Models;

// Cash drawer of one branch for one business day: opening float and the cash counted at the end.
public class CashDay : IBranchScoped
{
    public int Cashdayid { get; set; }

    public DateOnly Bizdate { get; set; }

    public decimal Openingcash { get; set; }

    // null = not counted yet.
    public decimal? Countedcash { get; set; }

    public string? Notes { get; set; }

    public int? Updatedby { get; set; }

    public DateTime? Updatedat { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}

// An expense, or cash put into / taken out of the drawer, on a business day.
public class CashEntry : IBranchScoped
{
    public int Cashentryid { get; set; }

    public DateOnly Bizdate { get; set; }

    // expense | cashin | cashout (see CashEntryTypes).
    public string Entrytype { get; set; } = CashEntryTypes.Expense;

    public string? Category { get; set; }

    public decimal Amount { get; set; }

    // cash | upi | card | bank. Only cash changes the drawer.
    public string Paymentmode { get; set; } = "cash";

    public string? Notes { get; set; }

    public int? Createdby { get; set; }

    public DateTime Createdat { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}

public static class CashEntryTypes
{
    public const string Expense = "expense";
    public const string CashIn = "cashin";
    public const string CashOut = "cashout";

    public static readonly string[] All = { Expense, CashIn, CashOut };
}
