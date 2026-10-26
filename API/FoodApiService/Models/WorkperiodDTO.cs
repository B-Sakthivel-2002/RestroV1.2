using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class WorkperiodDTO
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("date")]
    public DateOnly Date { get; set; }

    [JsonPropertyName("openedat")]
    public DateTime Openedat { get; set; }

    [JsonPropertyName("closedat")]
    public DateTime? Closedat { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; }

    [JsonPropertyName("openedby")]
    public string Openedby { get; set; }

    [JsonPropertyName("closedby")]
    public string Closedby { get; set; }

    [JsonPropertyName("branch")]
    public string Branch { get; set; }

    [JsonPropertyName("pendingorderscount")]
    public int PendingOrdersCount { get; set; }

    [JsonPropertyName("printedorderscount")]
    public int PrintedOrdersCount { get; set; }

    [JsonPropertyName("completedorderscount")]
    public int CompletedOrdersCount { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
