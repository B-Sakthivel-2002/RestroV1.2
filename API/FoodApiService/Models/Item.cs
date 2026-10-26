using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Item : IBranchScoped
{
    public int Itemid { get; set; }

    public int Categoryid { get; set; }

    public string? Itemname { get; set; }

    public string? Description { get; set; }

    public decimal? Defaultprice { get; set; }

    public int? Qty { get; set; }

    public bool? Active { get; set; }

    public string? Code { get; set; }

    // Kitchen that prepares the item; its KOT goes to that kitchen's printer.
    public int? Kitchenid { get; set; }

    [JsonIgnore]
    public virtual Category Category { get; set; }

    [JsonIgnore]
    public virtual ICollection<Itemchoice> Itemchoices { get; set; } = new List<Itemchoice>();

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
