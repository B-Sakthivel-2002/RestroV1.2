using System.Text.Json.Serialization;

namespace FoodApiService.Models;

// One walk-in party waiting for a table. Numbered T-001.. per branch and business day.
public class WaitlistToken : IBranchScoped
{
    public int Tokenid { get; set; }

    public string Tokencode { get; set; } = "";

    public DateOnly Bizdate { get; set; }

    public string Customername { get; set; } = "";

    public string Mobile { get; set; } = "";

    public string? Email { get; set; }

    public int Guests { get; set; }

    public string? Notes { get; set; }

    // Waiting | Called | Seated | Cancelled | NoShow (see TokenStatus).
    public string Status { get; set; } = TokenStatus.Waiting;

    // The table held for (Called) or given to (Seated) this party.
    public int? Tableid { get; set; }

    // Auto (system picked the table) or Manual (captain picked it).
    public string? Assignmode { get; set; }

    public DateTime Createdat { get; set; }

    public DateTime? Calledat { get; set; }

    public DateTime? Seatedat { get; set; }

    public DateTime? Closedat { get; set; }

    public int? Createdby { get; set; }

    public int? Updatedby { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    [JsonIgnore]
    public virtual Table? Table { get; set; }
}

public static class TokenStatus
{
    public const string Waiting = "Waiting";
    public const string Called = "Called";
    public const string Seated = "Seated";
    public const string Cancelled = "Cancelled";
    public const string NoShow = "NoShow";

    public static readonly string[] Active = { Waiting, Called };
}
