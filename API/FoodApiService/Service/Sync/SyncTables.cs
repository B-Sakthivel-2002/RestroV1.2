namespace FoodApiService.Service.Sync;

// The tables copied from a branch server to the online server, and how record ids are kept apart.
//
// Every branch server numbers new rows from its own range: branch N uses ids N*60,000,000 up to
// (N+1)*60,000,000-1, so rows of different branches never share an id on the online server and
// the online server can use the very same tables and reports. Ids below 60,000,000 are the seed
// rows of RestroDB.sql (order types, roles, the owner login, ...), which every database has alike.
// 32-bit ids leave room for branch ids 1..34.
public static class SyncTables
{
    public const long RangeSize = 60_000_000;
    public const int MaxBranchId = 34;

    // Ranged = new rows get ids from the branch's range. Private = columns never sent to the online server.
    public sealed record Table(string Name, string Key, bool Ranged = true, string[]? Private = null)
    {
        public string Quoted => "\"" + Name + "\"";
    }

    // Parents before children, so a first upload arrives in a sensible order (the online server has no
    // foreign keys anyway: rows are applied in the order they changed on the branch).
    public static readonly Table[] All =
    [
        new("outlet", "outletid", Ranged: false),
        new("branch", "branchid", Ranged: false),
        new("role", "roleid"),
        new("ordertype", "ordertypeid"),
        new("kitchen", "kitchenid"),
        new("categories", "categoryid"),
        new("mealtype", "mealtypeid"),
        new("item", "itemid"),
        new("choice", "choiceid"),
        new("itemchoice", "itemchoiceid"),
        new("tax", "taxid"),
        new("discount", "discountid"),
        new("extracharge", "extrachargeid"),
        new("customers", "customerid"),
        new("floor", "floorid"),
        new("Table", "tableid"),
        // Passwords stay on the branch: branch logins cannot sign in online (online logins are made there).
        new("user", "userid", Private: ["password"]),
        new("userroles", "userroleid"),
        new("waiter", "waiterid"),
        new("workperiods", "id"),
        new("Order", "orderid"),
        new("orderdetail", "orderdetailid"),
        new("billheader", "billid"),
        new("billdetail", "billdetailid"),
        new("cash_day", "cashdayid"),
        new("cash_entry", "cashentryid"),
    ];

    public static readonly Dictionary<string, Table> ByName = All.ToDictionary(t => t.Name, StringComparer.Ordinal);

    public static long RangeStart(int branchId) => branchId * RangeSize;

    // May this branch send (and replace online) this row? Its own range, or a seed row of its own
    // branch / a shared seed row. The branch row itself only by that branch.
    public static bool BelongsTo(Table table, long id, int? rowBranch, int branchId)
    {
        if (table.Name == "branch")
            return id == branchId;
        long start = RangeStart(branchId);
        if (id >= start && id < start + RangeSize)
            return true;
        return id < RangeSize && (rowBranch == null || rowBranch == branchId);
    }
}
