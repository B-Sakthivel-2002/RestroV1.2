using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class OrderDetail
{
    [JsonPropertyName("itemid")]
    public int ItemID { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; }

    [JsonPropertyName("code")]
    public string Code { get; set; }

    [JsonPropertyName("qty")]
    public int Qty { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("sumofprice")]
    public decimal SumOfPrice => (decimal)Qty * Price;

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}

public class Orderdetail : IBranchScoped
{
    public int Orderdetailid { get; set; }

    public int Orderid { get; set; }

    public int Itemid { get; set; }

    public int Qty { get; set; }

    public decimal Price { get; set; }

    public decimal? Sumofprice { get; set; }

    public string? KOTStatus { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    [NotMapped]
    public string? Name { get; set; }

    [JsonIgnore]
    public virtual Order Order { get; set; }
}
