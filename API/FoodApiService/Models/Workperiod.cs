namespace FoodApiService.Models;

public class Workperiod : IBranchScoped
{
    public int Id { get; set; }

    public DateOnly Date { get; set; }

    public DateTime Openedat { get; set; }

    public DateTime? Closedat { get; set; }

    public string? Status { get; set; }

    public int? Openedby { get; set; }

    public int? Closedby { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
