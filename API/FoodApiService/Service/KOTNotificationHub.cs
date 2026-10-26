using FoodApiService.Models;
using Microsoft.AspNetCore.SignalR;

namespace FoodApiService.Service;

public class KOTNotificationHub : Hub
{
    // Clients that connect without a token (older clients) keep receiving every branch's events.
    // Remove this group once every client sends its token.
    public const string UnscopedGroup = "unscoped";

    private const string BranchIdsKey = "branchIds";

    private readonly HotelContext _context;

    public KOTNotificationHub(HotelContext context)
    {
        _context = context;
    }

    public static string BranchGroup(int? branchId) => "branch-" + branchId.GetValueOrDefault();

    // Groups an event about one branch goes to: that branch's clients plus unscoped clients.
    public static IReadOnlyList<string> GroupsFor(int? branchId) => new[] { BranchGroup(branchId), UnscopedGroup };

    public override async Task OnConnectedAsync()
    {
        var tenant = await TenantContext.ResolveAsync(Context.User, _context);
        if (tenant == null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UnscopedGroup);
        }
        else
        {
            // Outlet owners join every branch of their outlet; everyone else just their own branch.
            foreach (int branchId in tenant.BranchIds)
                await Groups.AddToGroupAsync(Context.ConnectionId, BranchGroup(branchId));
            Context.Items[BranchIdsKey] = tenant.BranchIds;
        }
        await base.OnConnectedAsync();
    }

    public async Task NotifyOrderUpdate(object orderDetail)
    {
        await CallerAudience().SendAsync("OrderUpdated", orderDetail);
    }

    public async Task NotifyOrderSettled(object settlementDetail)
    {
        await CallerAudience().SendAsync("OrderSettled", settlementDetail);
    }

    public async Task NotifyTableStatus(object tableDetail)
    {
        await CallerAudience().SendAsync("TableStatus", tableDetail);
    }

    // Client-initiated notifications stay within the caller's branches.
    private IClientProxy CallerAudience()
    {
        if (Context.Items.TryGetValue(BranchIdsKey, out var ids) && ids is IReadOnlyList<int> branchIds)
            return Clients.Groups(branchIds.Select(id => BranchGroup(id)).Append(UnscopedGroup).ToList());

        return Clients.All;
    }
}
