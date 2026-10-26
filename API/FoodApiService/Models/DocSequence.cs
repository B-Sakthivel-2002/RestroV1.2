namespace FoodApiService.Models;

// Per-branch, per-business-day counter used to generate order/bill numbers atomically.
public class DocSequence
{
    public int Branchid { get; set; }

    public string Doctype { get; set; } = null!;

    public DateOnly Bizdate { get; set; }

    public int Lastvalue { get; set; }
}
