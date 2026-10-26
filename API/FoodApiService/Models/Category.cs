using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Category : IBranchScoped
{
    public int Categoryid { get; set; }

    public string? Categoryname { get; set; }

    public int? Branchid { get; set; }

    public bool Flag { get; set; }

    [JsonIgnore]
    public virtual ICollection<Item> Items { get; set; } = new List<Item>();

    public int? Outletid { get; set; }
}
