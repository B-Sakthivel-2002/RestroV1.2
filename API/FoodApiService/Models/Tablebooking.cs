using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Tablebooking : IBranchScoped
{
    public int Bookingid { get; set; }

    public int Tableid { get; set; }

    public int Timeslotid { get; set; }

    public DateTime? Bookingdate { get; set; }

    public int? Numberofguests { get; set; }

    public bool? Status { get; set; }

    public int? Customerid { get; set; }

    [JsonIgnore]
    public virtual Table Table { get; set; }

    [JsonIgnore]
    public virtual Timeslot Timeslot { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
