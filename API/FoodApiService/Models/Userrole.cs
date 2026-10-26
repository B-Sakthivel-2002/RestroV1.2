namespace FoodApiService.Models;

public class Userrole : IBranchScoped
{
    public int Userroleid { get; set; }

    public int Userid { get; set; }

    public int Roleid { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
