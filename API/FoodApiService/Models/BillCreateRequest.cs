using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class BillCreateRequest
{
    [JsonPropertyName("billid")]
    public int? BillId { get; set; }

    [JsonPropertyName("datetime")]
    public DateTime DateTime { get; set; }

    [JsonPropertyName("customerid")]
    public int? CustomerID { get; set; }

    [JsonPropertyName("phone")]
    public string Phone { get; set; }

    [JsonPropertyName("address")]
    public string Address { get; set; }

    [JsonPropertyName("billname")]
    public string BillName { get; set; }

    [JsonPropertyName("gstin")]
    public string Gstin { get; set; }

    [JsonPropertyName("notes")]
    public string Notes { get; set; }

    [JsonPropertyName("totalamount")]
    public decimal TotalAmount { get; set; }

    [JsonPropertyName("subtotal")]
    public decimal SubTotal { get; set; }

    [JsonPropertyName("tax")]
    public decimal Tax { get; set; }

    [JsonPropertyName("extraamount")]
    public decimal ExtraAmount { get; set; }

    [JsonPropertyName("discount")]
    public decimal Discount { get; set; }

    [JsonPropertyName("discountid")]
    public List<int> DiscountID { get; set; }

    [JsonPropertyName("taxid")]
    public List<int> TaxID { get; set; }

    [JsonPropertyName("extraamountid")]
    public List<int> ExtraamountId { get; set; }

    [JsonPropertyName("paidamount")]
    public decimal? Paidamount { get; set; }

    [JsonPropertyName("paymentmode")]
    public string? Paymentmode { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("createdby")]
    public int? CreatedBy { get; set; }

    [JsonPropertyName("iscomplementary")]
    public bool? Iscomplementary { get; set; }

    [JsonPropertyName("complementaryreason")]
    public string? Complementaryreason { get; set; }

    [JsonPropertyName("orderids")]
    public List<int> OrderIds { get; set; }

    [JsonPropertyName("lifecyclestatus")]
    public string? Lifecyclestatus { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
