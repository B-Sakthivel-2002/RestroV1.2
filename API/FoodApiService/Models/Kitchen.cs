namespace FoodApiService.Models;

// A kitchen of a branch (Main Kitchen, Tandoor, Juice Bar, ...) with its own KOT printer.
public class Kitchen : IBranchScoped
{
    public int Kitchenid { get; set; }

    public string Kitchenname { get; set; } = "";

    // Windows printer name as installed on the API computer.
    public string? Printername { get; set; }

    public bool Status { get; set; } = true;

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
