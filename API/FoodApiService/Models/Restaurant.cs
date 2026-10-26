using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Restaurant
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = "success";

    [JsonPropertyName("message")]
    public string Message { get; set; } = "Food menu retrieved successfully";

    [JsonPropertyName("hotel")]
    public Hotel Hotel { get; set; }

    [JsonPropertyName("menu")]
    public List<MenuCategory> Menu { get; set; }

    public int? BranchId { get; set; }

    public int? OutletId { get; set; }
}
