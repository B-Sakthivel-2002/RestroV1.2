namespace FoodApiService.Models;

public class Mealtype : IBranchScoped
{
    public int Mealtypeid { get; set; }

    public string? Mealtypename { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
