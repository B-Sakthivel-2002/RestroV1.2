namespace FoodApiService.Models;

public class Customer : IBranchScoped
{
    public int Customerid { get; set; }

    public string? Name { get; set; }

    public string? Contactnumber { get; set; }

    public string? Email { get; set; }

    public string? Address { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
