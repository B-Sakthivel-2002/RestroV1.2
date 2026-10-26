namespace FoodApiService.Models;

public class Role : IOutletScoped
{
    public int Roleid { get; set; }

    public string Rolename { get; set; }

    public string? Description { get; set; }

    public bool? Status { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
