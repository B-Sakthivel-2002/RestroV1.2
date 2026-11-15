namespace FoodApiService.Service.Sync;

// appsettings "Sync". Decides what this copy of the API is:
//   Standalone (default) - one server, no upload (as before).
//   Branch - runs in the shop with its own database; billing never needs the internet. Every
//            IntervalSeconds it uploads new and changed rows to the online server (ServerUrl).
//   Cloud  - the online server of one customer. Only receives uploads and shows them to the owner:
//            view only, nothing can be changed there.
public sealed class SyncSettings
{
    public string Mode { get; set; } = "Standalone";

    // Branch: this server's branch id. The same branch row (same id) must exist on the online server.
    public int BranchId { get; set; }

    // Branch: address of the online server, e.g. https://a2b.yourdomain.com
    public string? ServerUrl { get; set; }

    // Branch: this branch's upload key; the online server has the same key under BranchKeys.
    public string? Key { get; set; }

    public int IntervalSeconds { get; set; } = 60;

    public int BatchSize { get; set; } = 500;

    // Cloud: upload key of every branch, by branch id, e.g. { "1": "long-random-key", "2": "..." }.
    public Dictionary<string, string> BranchKeys { get; set; } = new();

    // Set at start-up from ConnectionStrings:SSConnectionString (not read from the "Sync" section).
    public string ConnectionString { get; set; } = "";

    public bool IsBranch => Mode.Equals("Branch", StringComparison.OrdinalIgnoreCase);
    public bool IsCloud => Mode.Equals("Cloud", StringComparison.OrdinalIgnoreCase);
    public string ModeName => IsBranch ? "Branch" : IsCloud ? "Cloud" : "Standalone";
}
