namespace FoodApiService.Models;

public class Tax : IBranchScoped
{
    public int Taxid { get; set; }

    public string? Taxname { get; set; }

    public decimal? Taxrate { get; set; }

    public decimal? Taxfrom { get; set; }

    public decimal? Taxto { get; set; }

    public string? Taxtype { get; set; }

    public bool? Taxrangestatus { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
