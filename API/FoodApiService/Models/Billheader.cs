namespace FoodApiService.Models;

public class Billheader : IBranchScoped
{
    public int Billid { get; set; }

    public string Billnumber { get; set; }

    public DateTime Datetime { get; set; }

    public int? Customerid { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? Billname { get; set; }

    public string? Gstin { get; set; }

    public string? Notes { get; set; }

    public decimal? Totalamount { get; set; }

    public decimal? Subtotal { get; set; }

    public decimal? Tax { get; set; }

    public decimal? Extraamount { get; set; }

    public decimal? Discount { get; set; }

    public int? Taxid { get; set; }

    public int? Discountid { get; set; }

    public decimal? Paidamount { get; set; }

    public string? Paymentmode { get; set; }

    public string? Status { get; set; }

    public int? CreatedBy { get; set; }

    public bool? Iscomplementary { get; set; }

    public string? Complementaryreason { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }

    public int? Updatedby { get; set; }

    public string? Lifecyclestatus { get; set; }

    public DateTime? Businessdate { get; set; }

    public virtual ICollection<Billdetail> Billdetails { get; set; } = new List<Billdetail>();
}
