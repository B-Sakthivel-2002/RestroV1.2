namespace FoodApiService.Models;

public class User : IBranchScoped
{
    public int Userid { get; set; }

    public string Username { get; set; }

    public string Password { get; set; }

    public bool? Status { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
