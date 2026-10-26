using System.Text.Json.Serialization;

namespace FoodApiService.Data;

public class CancelOrder
{
    [JsonPropertyName("orderid")]
    public int OrderId { get; set; }

    [JsonPropertyName("complimentaryf")]
    public bool? ComplimentaryF { get; set; }

    [JsonPropertyName("remarks")]
    public string? Remarks { get; set; }
}
