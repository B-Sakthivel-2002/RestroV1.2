using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class MenuCategory
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; }

    [JsonPropertyName("flag")]
    public bool Flag { get; set; }

    [JsonPropertyName("expressstall")]
    public bool ExpressStall { get; set; }

    [JsonPropertyName("orderdetail")]
    public List<OrderDetail> OrderDetail { get; set; }

    public int? BranchId { get; set; }

    public int? OutletId { get; set; }
}
