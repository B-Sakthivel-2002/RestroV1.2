namespace FoodApiService.Models;

public class Ordertype : IOutletScoped
{
    public int Ordertypeid { get; set; }

    public string? Ordertypename { get; set; }

    public bool status { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
