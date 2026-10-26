using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class BillUpdateRequest
{
    [JsonPropertyName("billid")]
    public int? BillId { get; set; }

    [JsonPropertyName("notes")]
    public string Notes { get; set; }

    [JsonPropertyName("paidamount")]
    public decimal? Paidamount { get; set; }

    [JsonPropertyName("paymentmode")]
    public string? Paymentmode { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    public bool? Iscomplementary { get; set; }

    [JsonPropertyName("complementaryreason")]
    public string? Complementaryreason { get; set; }

    public string? Lifecyclestatus { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
