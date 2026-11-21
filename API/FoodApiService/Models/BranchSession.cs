namespace FoodApiService.Models;

// "Log out all devices" of one branch: logins issued before Revokedat (UTC) are refused.
// Kept apart from the branch row so saving the Branch page can never clear it.
public class BranchSession
{
    public int Branchid { get; set; }

    // UTC, stored as timestamp without time zone.
    public DateTime Revokedat { get; set; }

    public int? Revokedby { get; set; }
}
