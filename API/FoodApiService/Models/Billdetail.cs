using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Billdetail : IBranchScoped
{
    public int Billdetailid { get; set; }

    public int Billid { get; set; }

    public int Orderid { get; set; }

    public int? Taxid { get; set; }

    public int? Discountid { get; set; }

    public int? Extraamountid { get; set; }

    public virtual Billheader Bill { get; set; }

    public virtual Order Order { get; set; }

    public int? Branchid { get; set; }

    public int? Outletid { get; set; }
}
