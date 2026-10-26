using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Order : IBranchScoped
{
    public int Orderid { get; set; }

    public int Waiterid { get; set; }

    public string? Ordernumber { get; set; }

    public int? Tableid { get; set; }

    public DateTime Timedate { get; set; }

    public int? Customerid { get; set; }

    public int? Bookingid { get; set; }

    public int? Qty { get; set; }

    public decimal? Price { get; set; }

    public decimal? Totalprice { get; set; }

    public int? Billingid { get; set; }

    public int? Ordertypeid { get; set; }

    public string? Status { get; set; }

    public bool? PrintedF { get; set; }

    public bool? ComplimentaryF { get; set; }

    public string? Comments { get; set; }

    public string? Remarks { get; set; }

    public int? Createdby { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    public DateTime? Businessdate { get; set; }

    // Split bill: which guest at the table this order belongs to (null = the first guest).
    public string? Guestlabel { get; set; }

    [JsonIgnore]
    public virtual ICollection<Billdetail> Billdetails { get; set; } = new List<Billdetail>();

    [JsonIgnore]
    public virtual ICollection<Orderdetail> Orderdetails { get; set; } = new List<Orderdetail>();
}
