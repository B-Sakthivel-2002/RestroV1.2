using FoodApiService.Models;

namespace FoodApiService.Service;

// Bill lifecycle values used when a settled bill is reopened for editing or cancelled.
public static class BillLifecycle
{
    public const string Printed = "printed";
    public const string Finalized = "finalized";
    public const string Complementary = "complementary";
    // Its orders are open again on the table; settling it again keeps the bill number.
    public const string Reopened = "reopened";
    // Stays listed for audit, but is left out of every total.
    public const string Cancelled = "cancelled";

    public static bool IsSettled(string? lifecycle) => lifecycle == Finalized || lifecycle == Complementary;

    // Bills that count in sales figures.
    public static IQueryable<Billheader> NotCancelled(this IQueryable<Billheader> bills) =>
        bills.Where(b => b.Lifecyclestatus != Cancelled);
}
