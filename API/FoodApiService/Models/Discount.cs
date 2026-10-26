namespace FoodApiService.Models;

public class Discount : IBranchScoped
{
    public int Discountid { get; set; }

    public string? Discountname { get; set; }

    public decimal? Discountrate { get; set; }

    public string? Discounttype { get; set; }

    public decimal? Discountfrom { get; set; }

    public decimal? Discountto { get; set; }

    public bool? Discountrangestatus { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
