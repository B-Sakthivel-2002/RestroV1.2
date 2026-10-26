using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class AddOrderDetail
{
    [JsonPropertyName("orderdetailid")]
    public int OrderDetailId { get; set; }

    [JsonPropertyName("itemid")]
    public int ItemID { get; set; }

    [JsonPropertyName("qty")]
    public int Qty { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("sumofprice")]
    public decimal SumOfPrice { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
