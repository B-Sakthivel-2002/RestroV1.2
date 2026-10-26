using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Choice : IBranchScoped
{
    public int Choiceid { get; set; }

    public string? Choicename { get; set; }

    public string? Description { get; set; }

    public bool? Isfree { get; set; }

    public decimal? Additioncost { get; set; }

    [JsonIgnore]
    public virtual ICollection<Itemchoice> Itemchoices { get; set; } = new List<Itemchoice>();

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
