using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Timeslot : IBranchScoped
{
    public int Timeslotid { get; set; }

    public DateTime? Starttime { get; set; }

    public DateTime? Endtime { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    [JsonIgnore]
    public virtual ICollection<Tablebooking> Tablebookings { get; set; } = new List<Tablebooking>();
}
