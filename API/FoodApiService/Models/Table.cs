using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Table : IBranchScoped
{
    public int Tableid { get; set; }

    public int Floorid { get; set; }

    public string? Tablename { get; set; }

    public string? Description { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    public bool? Status { get; set; }

    // Seats at the table; the waitlist only offers tables with Capacity >= party size.
    public int Capacity { get; set; } = 4;

    // Stored seating state (see TableStates). Open orders always make the table Occupied.
    public string Tablestate { get; set; } = TableStates.Available;

    public DateTime? Statesince { get; set; }

    // Set while this table is merged into another one (the other table carries the orders and the bill).
    public int? Mergedinto { get; set; }

    [JsonIgnore]
    public virtual Floor Floor { get; set; }

    [JsonIgnore]
    public virtual ICollection<Tablebooking> Tablebookings { get; set; } = new List<Tablebooking>();
}

public static class TableStates
{
    public const string Available = "Available";
    public const string Occupied = "Occupied";
    public const string Reserved = "Reserved";
    public const string Cleaning = "Cleaning";
    public const string Blocked = "Blocked";

    // States a captain may set by hand (Occupied comes from seating / open orders).
    public static readonly string[] Manual = { Available, Reserved, Cleaning, Blocked };
}
