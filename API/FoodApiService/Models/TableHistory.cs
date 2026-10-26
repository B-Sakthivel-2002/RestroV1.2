namespace FoodApiService.Models;

// Audit trail of a table: state changes, token holds, seating, transfers and merges.
public class TableHistory : IBranchScoped
{
    public int Historyid { get; set; }

    public int Tableid { get; set; }

    public string Event { get; set; } = "";

    public string? Fromstate { get; set; }

    public string? Tostate { get; set; }

    // The other table of a transfer / merge.
    public int? Relatedtableid { get; set; }

    public int? Tokenid { get; set; }

    public int? Orderid { get; set; }

    public string? Notes { get; set; }

    public int? Userid { get; set; }

    public DateTime Createdat { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}

public static class TableEvents
{
    public const string StateChanged = "StateChanged";
    public const string TokenAssigned = "TokenAssigned";
    public const string TokenReleased = "TokenReleased";
    public const string Seated = "Seated";
    public const string Released = "Released";
    public const string TransferOut = "TransferOut";
    public const string TransferIn = "TransferIn";
    public const string Merged = "Merged";
    public const string Unmerged = "Unmerged";
    public const string Split = "Split";
}
