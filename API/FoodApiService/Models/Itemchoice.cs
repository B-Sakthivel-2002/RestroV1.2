using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Itemchoice : IBranchScoped
{
    public int Itemchoiceid { get; set; }

    public int Itemid { get; set; }

    public int Choiceid { get; set; }

    public string? Description { get; set; }

    public decimal? Price { get; set; }

    [JsonIgnore]
    public virtual Choice Choice { get; set; }

    [JsonIgnore]
    public virtual Item Item { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
