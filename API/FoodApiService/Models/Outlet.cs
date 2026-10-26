using System.Text.Json.Serialization;

namespace FoodApiService.Models;

public class Outlet
{
    public int Outletid { get; set; }

    public string Outletname { get; set; } = null!;

    public string? Code { get; set; }

    public string? Phone { get; set; }

    public string? Email { get; set; }

    public bool? Status { get; set; }

    [JsonIgnore]
    public virtual ICollection<Branch> Branches { get; set; } = new List<Branch>();
}
