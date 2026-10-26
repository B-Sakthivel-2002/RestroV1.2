namespace FoodApiService.Models;

public class Extracharge : IBranchScoped
{
    public int Extrachargeid { get; set; }

    public string? Extrachargename { get; set; }

    public decimal? Extrachargerate { get; set; }

    public decimal? Extrachargefrom { get; set; }

    public decimal? Extrachargeto { get; set; }

    public string? Extrachargetype { get; set; }

    public bool? Extrachargestatus { get; set; }

    public int? Ordertypeid { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
