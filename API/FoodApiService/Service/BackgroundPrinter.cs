using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;

namespace FoodApiService.Service;

// Takes KOT / bill printing off the request: CreateOrder and CreateBill only queue a request here
// and answer at once. This worker loads the ticket data in its own scope and hands the tickets to
// PrintQueue (one worker per printer, so one slow printer never holds up the others). When a ticket
// fails, the user who sent it and the branch admins get a live "Printing failed" alert (OrderAlert).
public class BackgroundPrinter : BackgroundService
{
    private record Request(bool Bill, int Id, int UserId, int? BranchId);

    private readonly Channel<Request> _requests = Channel.CreateUnbounded<Request>(new UnboundedChannelOptions { SingleReader = true });
    private readonly IServiceScopeFactory _scopes;
    private readonly IHubContext<KOTNotificationHub> _hub;
    private readonly ILogger<BackgroundPrinter> _logger;

    public BackgroundPrinter(IServiceScopeFactory scopes, IHubContext<KOTNotificationHub> hub, ILogger<BackgroundPrinter> logger)
    {
        _scopes = scopes;
        _hub = hub;
        _logger = logger;
    }

    public void QueueKot(int orderId, int userId, int? branchId) => _requests.Writer.TryWrite(new Request(false, orderId, userId, branchId));

    public void QueueBill(int billId, int userId, int? branchId) => _requests.Writer.TryWrite(new Request(true, billId, userId, branchId));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var request in _requests.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await HandleAsync(request);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Background printing of {Kind} {Id} failed", request.Bill ? "bill" : "KOT", request.Id);
                    await NotifyAsync(request, new[] { ex.Message.TrimEnd('.', ' ') });
                }
            }
        }
        catch (OperationCanceledException) { }
    }

    private async Task HandleAsync(Request request)
    {
        using var scope = _scopes.CreateScope();
        if (request.Bill)
        {
            var job = await scope.ServiceProvider.GetRequiredService<BillPrintService>().QueueAsync(request.Id);
            if (job != null)
                _ = ReportAsync(request, new[] { job }, new[] { "Bill" });
        }
        else
        {
            var (tickets, jobs) = await scope.ServiceProvider.GetRequiredService<KotPrintService>().QueueOrderAsync(request.Id);
            if (jobs.Count > 0)
                _ = ReportAsync(request, jobs, tickets.Select(t => $"{t.Kitchen} ({t.Printer ?? "default printer"})").ToArray());
        }
    }

    // Waits for the printers without holding up the next request (PrintQueue times stuck jobs out).
    private async Task ReportAsync(Request request, IReadOnlyList<Task<string?>> jobs, string[] labels)
    {
        try
        {
            var outcomes = await Task.WhenAll(jobs);
            var failed = outcomes.Select((error, i) => (error, label: labels[i])).Where(x => !string.IsNullOrEmpty(x.error))
                .Select(x => $"{x.label}: {x.error!.TrimEnd('.', ' ')}").ToArray();
            if (failed.Length > 0)
                await NotifyAsync(request, failed);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Waiting for the printers failed");
        }
    }

    private async Task NotifyAsync(Request request, string[] failures)
    {
        try
        {
            var groups = new List<string> { KOTNotificationHub.UserGroup(request.UserId) };
            groups.AddRange(new[] { "admin", "superadmin" }.Select(r => KOTNotificationHub.RoleGroup(request.BranchId, r)));
            string what = request.Bill ? $"Bill {request.Id}" : $"KOT {request.Id}";
            await _hub.Clients.Groups(groups).SendAsync(OrderAlertNotifier.AlertEvent, new
            {
                id = Guid.NewGuid().ToString("N"),
                type = "printfailed",
                title = request.Bill ? "Bill printing failed" : "KOT saved - printing failed",
                message = $"{what} not printed: {string.Join("; ", failures)}. Check the printer and use the print button to reprint.",
                orderId = request.Bill ? 0 : request.Id,
                items = failures,
                byUserId = (int?)null,
                at = DateTime.Now
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Print failure alert could not be sent");
        }
    }
}
