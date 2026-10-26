using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class AddOrders
{
    [JsonPropertyName("orderid")]
    public int OrderId { get; set; }

    [JsonPropertyName("waiterid")]
    public int WaiterID { get; set; }

    [JsonPropertyName("tableid")]
    public int TableID { get; set; }

    [JsonPropertyName("timedate")]
    public DateTime TimeDate { get; set; }

    [JsonPropertyName("customerid")]
    public int CustomerID { get; set; }

    [JsonPropertyName("bookingid")]
    public int BookingID { get; set; }

    [JsonPropertyName("totalprice")]
    public decimal TotalPrice { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; }

    [JsonPropertyName("billingid")]
    public int BillingID { get; set; }

    [JsonPropertyName("ordertypeid")]
    public int OrderTypeID { get; set; }

    [JsonPropertyName("printedf")]
    public bool? PrintedF { get; set; }

    [JsonPropertyName("comments")]
    public string? Comments { get; set; }

    [JsonPropertyName("orderdetail")]
    public List<AddOrderDetail> OrderDetail { get; set; } = new List<AddOrderDetail>();

    // Split bill: the guest tab the order was taken on (null = the first guest).
    [JsonPropertyName("guestlabel")]
    public string? GuestLabel { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
