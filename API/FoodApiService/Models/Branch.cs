using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Branch
{
    public int Branchid { get; set; }

    public string? Branchname { get; set; }

    public string? Addressline1 { get; set; }

    public string? Addressline2 { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }

    public string? Phone1 { get; set; }

    public string? Phone2 { get; set; }

    public string? Email { get; set; }

    public string? Website { get; set; }

    [JsonIgnore]
    public virtual ICollection<Floor> Floors { get; set; } = new List<Floor>();

    public int? Outletid { get; set; }

    public string? Code { get; set; }

    // Express Stall is available in this branch.
    public bool Expressstall { get; set; }

    // A settled bill of the open work period may be cancelled.
    public bool Ordercancel { get; set; }

    // A settled bill of the open work period may be reopened to change its items.
    public bool Orderedit { get; set; }

    [JsonIgnore]
    public virtual Outlet? Outlet { get; set; }
}
