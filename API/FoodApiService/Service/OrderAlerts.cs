using FoodApiService.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// appsettings "OrderAlertSettings".
public class OrderAlertSettings
{
    public bool Enabled { get; set; } = true;

    // An item still not marked ready to serve this long after it reached the kitchen -> kitchen alert.
    public int KitchenDelayMinutes { get; set; } = 10;

    // An item marked ready to serve but not picked up this long -> alert to the order's captain.
    public int PickupDelayMinutes { get; set; } = 10;

    // Alert again every this many minutes while the item is still delayed. 0 = alert only once.
    public int RepeatMinutes { get; set; } = 10;

    // How often the delay check runs.
    public int CheckSeconds { get; set; } = 30;
}

public static class OrderAlertTypes
{
    public const string Edited = "edited";
    // A new KOT for a table that already has an open order.
    public const string ItemsAdded = "added";
    public const string Cancelled = "cancelled";
    public const string ReadyToServe = "readytoserve";
    public const string KitchenDelay = "kitchendelay";
    public const string PickupDelay = "pickupdelay";
}

public static class KotStatuses
{
    // null / "" = in the kitchen, not ready yet.
    public const string ReadyToServe = "readytoserve";
    // Picked up by the captain.
    public const string PickedUp = "submitted";
}

// Sends "OrderAlert" (a notification the user sees) to the kitchen and/or the order's captain,
// and "OrderUpdated" (refresh only) to the branch so open KOT screens reload.
public class OrderAlertNotifier
{
    public const string AlertEvent = "OrderAlert";
    public const string RefreshEvent = "OrderUpdated";
    private const string ChefRole = "chef";
    private const string CaptainRole = "captain";
    // The branch head and the outlet owner see every alert of the branch.
    private static readonly string[] SupervisorRoles = { "admin", "superadmin" };

    private readonly IHubContext<KOTNotificationHub> _hub;
    private readonly ILogger<OrderAlertNotifier> _logger;

    public OrderAlertSettings Settings { get; }

    public OrderAlertNotifier(IHubContext<KOTNotificationHub> hub, IConfiguration configuration, ILogger<OrderAlertNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
        Settings = configuration.GetSection("OrderAlertSettings").Get<OrderAlertSettings>() ?? new OrderAlertSettings();
    }

    // Never fails the request that triggered it: a lost notification is logged, the change itself is saved.
    public async Task SendAsync(HotelContext context, Order order, string type, string title, string message,
        IEnumerable<string>? items, bool toKitchen, bool toCaptain, int? byUserId)
    {
        if (!Settings.Enabled)
            return;
        try
        {
            var groups = SupervisorRoles.Select(r => KOTNotificationHub.RoleGroup(order.Branchid, r)).ToList();
            if (toKitchen)
                groups.Add(KOTNotificationHub.RoleGroup(order.Branchid, ChefRole));
            if (toCaptain)
                groups.Add(await CaptainGroupAsync(context, order));

            var info = await OrderInfoAsync(context, order);
            var payload = new
            {
                id = Guid.NewGuid().ToString("N"),
                type,
                title,
                message,
                orderId = order.Orderid,
                orderNumber = order.Ordernumber,
                tableId = order.Tableid,
                tableName = info.TableName,
                orderTypeName = info.OrderTypeName,
                captain = info.Captain,
                items = items?.ToList() ?? new List<string>(),
                byUserId,
                at = DateTime.Now
            };
            await _hub.Clients.Groups(groups.Distinct().ToList()).SendAsync(AlertEvent, payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Order alert {Type} for order {OrderId} could not be sent", type, order.Orderid);
        }
    }

    // Open KOT / captain screens of the branch reload the order.
    public async Task RefreshAsync(Order order, string key)
    {
        try
        {
            await _hub.Clients.Groups(KOTNotificationHub.GroupsFor(order.Branchid))
                .SendAsync(RefreshEvent, new { Key = key, Value = new { OrderId = order.Orderid, OrderStatus = order.Status } });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Order refresh for order {OrderId} could not be sent", order.Orderid);
        }
    }

    // The captain of an order is the user who took it. When that user is not a Captain
    // (an Admin took the order), every captain of the branch gets the alert.
    private static async Task<string> CaptainGroupAsync(HotelContext context, Order order)
    {
        if (order.Createdby is int userId && userId > 0)
        {
            string? role = await context.Userroles.AsNoTracking()
                .Where(r => r.Userid == userId)
                .Join(context.Roles, r => r.Roleid, ro => ro.Roleid, (r, ro) => ro.Rolename)
                .FirstOrDefaultAsync();
            if (KOTNotificationHub.NormalizeRole(role) == CaptainRole)
                return KOTNotificationHub.UserGroup(userId);
        }
        return KOTNotificationHub.RoleGroup(order.Branchid, CaptainRole);
    }

    public record OrderInfo(string? TableName, string? OrderTypeName, string? Captain);

    public static async Task<OrderInfo> OrderInfoAsync(HotelContext context, Order order)
    {
        string? table = order.Tableid is > 0
            ? await context.Tables.AsNoTracking().Where(t => t.Tableid == order.Tableid).Select(t => t.Tablename).FirstOrDefaultAsync()
            : null;
        string? type = await context.Ordertypes.AsNoTracking().Where(t => t.Ordertypeid == order.Ordertypeid).Select(t => t.Ordertypename).FirstOrDefaultAsync();
        string? captain = order.Createdby is > 0
            ? await context.Users.AsNoTracking().Where(u => u.Userid == order.Createdby).Select(u => u.Username).FirstOrDefaultAsync()
            : null;
        return new OrderInfo(table, type, captain);
    }

    // "Table T4" for dine-in, else the order type ("Take Away"), plus the order number.
    public static string Where(OrderInfo info, Order order)
    {
        string place = !string.IsNullOrWhiteSpace(info.TableName) ? "Table " + info.TableName : info.OrderTypeName ?? "Order";
        return string.IsNullOrWhiteSpace(order.Ordernumber) ? place : $"{place} · {order.Ordernumber}";
    }
}

// Every CheckSeconds: open orders whose items sat in the kitchen, or ready but not picked up,
// longer than the configured minutes. One alert per order and stage, repeated every RepeatMinutes.
public class OrderDelayMonitor : BackgroundService
{
    private const string KitchenStage = "kitchen";
    private const string PickupStage = "pickup";

    private readonly IServiceScopeFactory _scopes;
    private readonly OrderAlertNotifier _notifier;
    private readonly ILogger<OrderDelayMonitor> _logger;
    // (orderId, stage) -> last alert. In memory: after an API restart a delay is alerted once more.
    private readonly Dictionary<(int, string), DateTime> _lastAlert = new();

    public OrderDelayMonitor(IServiceScopeFactory scopes, OrderAlertNotifier notifier, ILogger<OrderDelayMonitor> logger)
    {
        _scopes = scopes;
        _notifier = notifier;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = _notifier.Settings;
        if (!settings.Enabled)
            return;
        var interval = TimeSpan.FromSeconds(Math.Max(10, settings.CheckSeconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAsync(settings, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Delayed order check failed");
            }
            try { await Task.Delay(interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task CheckAsync(OrderAlertSettings settings, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<HotelContext>();

        var now = DateTime.Now;
        var kitchenBefore = now.AddMinutes(-Math.Max(1, settings.KitchenDelayMinutes));
        var pickupBefore = now.AddMinutes(-Math.Max(1, settings.PickupDelayMinutes));
        // Only today's running orders (submitted = in the kitchen / being served, not billed or cancelled).
        var openSince = now.AddHours(-24);

        var late = await context.Orderdetails.AsNoTracking()
            .Where(d => d.Order.Status == "submitted" && d.Order.Timedate >= openSince)
            .Where(d => ((d.KOTStatus == null || d.KOTStatus == "") && (d.Kotstatusat ?? d.Order.Timedate) < kitchenBefore)
                     || (d.KOTStatus == KotStatuses.ReadyToServe && d.Kotstatusat != null && d.Kotstatusat < pickupBefore))
            .Select(d => new
            {
                d.Orderid, d.Qty, d.KOTStatus,
                Since = d.Kotstatusat ?? d.Order.Timedate,
                Item = context.Items.Where(i => i.Itemid == d.Itemid).Select(i => i.Itemname).FirstOrDefault()
            })
            .ToListAsync(ct);

        var due = late
            .GroupBy(d => (d.Orderid, Stage: d.KOTStatus == KotStatuses.ReadyToServe ? PickupStage : KitchenStage))
            .ToList();

        // Forget orders that are no longer late, so a later delay alerts again.
        var current = due.Select(g => g.Key).ToHashSet();
        foreach (var key in _lastAlert.Keys.Where(k => !current.Contains(k)).ToList())
            _lastAlert.Remove(key);

        foreach (var group in due)
        {
            if (_lastAlert.TryGetValue(group.Key, out var last)
                && (settings.RepeatMinutes <= 0 || now - last < TimeSpan.FromMinutes(settings.RepeatMinutes)))
                continue;

            var order = await context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Orderid == group.Key.Orderid, ct);
            if (order == null)
                continue;
            var info = await OrderAlertNotifier.OrderInfoAsync(context, order);
            int minutes = (int)(now - group.Min(d => d.Since)).TotalMinutes;
            var items = group.Select(d => $"{d.Item ?? "Item"} x{d.Qty}").ToList();

            if (group.Key.Stage == KitchenStage)
                await _notifier.SendAsync(context, order, OrderAlertTypes.KitchenDelay, "Order delayed in kitchen",
                    $"{OrderAlertNotifier.Where(info, order)}: {items.Count} item(s) not ready for {minutes} min",
                    items, toKitchen: true, toCaptain: false, byUserId: null);
            else
                await _notifier.SendAsync(context, order, OrderAlertTypes.PickupDelay, "Ready, not picked up",
                    $"{OrderAlertNotifier.Where(info, order)}: {items.Count} item(s) waiting for pickup for {minutes} min",
                    items, toKitchen: false, toCaptain: true, byUserId: null);

            _lastAlert[group.Key] = now;
        }
    }
}
