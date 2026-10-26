using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Floor
{
    public int Floorid { get; set; }

    public int Branchid { get; set; }

    public string? Floorname { get; set; }

    public int? Capacity { get; set; }

    public string? Description { get; set; }

    public bool? Status { get; set; }

    [JsonIgnore]
    public virtual Branch Branch { get; set; }

    [JsonIgnore]
    public virtual ICollection<Table> Tables { get; set; } = new List<Table>();

    public int? Outletid { get; set; }
}
