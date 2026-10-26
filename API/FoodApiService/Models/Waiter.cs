namespace FoodApiService.Models;

public class Waiter : IBranchScoped
{
    public int Waiterid { get; set; }

    public string? Waitername { get; set; }

    public string? Shift { get; set; }

    public string? Contactnumber { get; set; }

    public DateOnly? Datejoined { get; set; }

    public bool? Status { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
