using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Hotel
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; }

    [JsonPropertyName("location")]
    public string Location { get; set; }

    public int? BranchId { get; set; }

    public int? OutletId { get; set; }
}
