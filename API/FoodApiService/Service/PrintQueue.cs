using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Printing;
using System.Threading.Channels;

namespace FoodApiService.Service;

// Background printing for KOTs and bills.
//
// Windows printing is slow and blocking, and under IIS it can hang outright (printer not visible to the
// app pool account, or a printer waiting for a dialog nobody can see). So requests never
// print themselves: they queue the ticket and wait at most PrinterSettings:WaitSeconds for the result.
// Each printer has one worker that prints its tickets in order; different printers print in parallel.
// A job that does not finish within PrinterSettings:JobTimeoutSeconds is reported as failed and the
// worker moves on, so one stuck printer never blocks the others or the application.
public class PrintQueue
{
    private sealed record Job(string? Printer, Action<Graphics> Draw, TaskCompletionSource<string?> Result);

    private readonly ConcurrentDictionary<string, Channel<Job>> _queues = new(StringComparer.OrdinalIgnoreCase);
    private readonly ILogger<PrintQueue> _logger;
    private readonly TimeSpan _jobTimeout;

    public PrintQueue(IConfiguration configuration, ILogger<PrintQueue> logger)
    {
        _logger = logger;
        _jobTimeout = TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue("PrinterSettings:JobTimeoutSeconds", 30)));
        WaitTime = TimeSpan.FromSeconds(Math.Clamp(configuration.GetValue("PrinterSettings:WaitSeconds", 4), 0, 30));
    }

    // How long a request waits for its tickets before answering (the rest keep printing in the background).
    public TimeSpan WaitTime { get; }

    // Queues a ticket. The task completes with null when printed, or the error message.
    public Task<string?> Enqueue(string? printerName, Action<Graphics> draw)
    {
        var job = new Job(string.IsNullOrWhiteSpace(printerName) ? null : printerName.Trim(), draw,
            new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously));

        // A printer that is not installed fails at once (same message as before) instead of waiting in the queue.
        string? problem = job.Printer == null ? null : CheckPrinter(job.Printer);
        if (problem != null)
            return Task.FromResult<string?>(problem);
        var queue = _queues.GetOrAdd(job.Printer ?? "", key =>
        {
            var channel = Channel.CreateUnbounded<Job>(new UnboundedChannelOptions { SingleReader = true });
            _ = Task.Run(() => Worker(key, channel.Reader));
            return channel;
        });
        queue.Writer.TryWrite(job);
        return job.Result.Task;
    }

    // Waits up to WaitTime for the jobs. Returns, per job: null = printed, text = error, "" = still printing.
    public async Task<string?[]> WaitAsync(IReadOnlyList<Task<string?>> jobs)
    {
        if (jobs.Count == 0)
            return Array.Empty<string?>();
        await Task.WhenAny(Task.WhenAll(jobs), Task.Delay(WaitTime));
        return jobs.Select(j => j.IsCompleted ? j.Result : "").ToArray();
    }

    // Installed printers, re-read at most every few seconds (asking Windows each time is slow).
    private HashSet<string> _installed = new(StringComparer.OrdinalIgnoreCase);
    private DateTime _installedAt = DateTime.MinValue;
    private readonly object _installedLock = new();

    private string? CheckPrinter(string printer)
    {
        lock (_installedLock)
        {
            // Re-read a stale list, or a fresh-enough one that lacks the printer (it may just have been installed).
            var age = DateTime.UtcNow - _installedAt;
            if (age > TimeSpan.FromMinutes(1) || (!_installed.Contains(printer) && age > TimeSpan.FromSeconds(10)))
            {
                try
                {
                    _installed = new HashSet<string>(PrinterSettings.InstalledPrinters.Cast<string>(), StringComparer.OrdinalIgnoreCase);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not read the installed printers");
                    return null; // let the worker try the printer itself
                }
                _installedAt = DateTime.UtcNow;
            }
            return _installed.Contains(printer) ? null : $"Printer '{printer}' not found on the API computer.";
        }
    }

    private async Task Worker(string key, ChannelReader<Job> reader)
    {
        await foreach (var job in reader.ReadAllAsync())
        {
            try
            {
                // Printing runs on its own thread so a hung print can be abandoned after the timeout.
                var print = Task.Factory.StartNew(() => Print(job.Printer, job.Draw), CancellationToken.None,
                    TaskCreationOptions.LongRunning, TaskScheduler.Default);
                if (await Task.WhenAny(print, Task.Delay(_jobTimeout)) == print)
                {
                    await print;
                    job.Result.TrySetResult(null);
                }
                else
                {
                    string message = $"Printer '{job.Printer ?? "default"}' is not responding.";
                    _logger.LogWarning("{Message} Job abandoned after {Seconds}s.", message, _jobTimeout.TotalSeconds);
                    job.Result.TrySetResult(message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Printing on '{Printer}' failed", job.Printer ?? "default");
                job.Result.TrySetResult(ex.Message);
            }
        }
    }

    private static void Print(string? printerName, Action<Graphics> draw)
    {
        using var printDocument = new PrintDocument();
        printDocument.DefaultPageSettings.PaperSize = new PaperSize("ThermalRoll", 283, 600);
        printDocument.PrintController = new StandardPrintController(); // no "Printing..." progress window
        printDocument.PrintPage += (sender, e) => draw(e.Graphics!);

        // No printer name = the Windows default printer (as before).
        if (!string.IsNullOrWhiteSpace(printerName))
        {
            printDocument.PrinterSettings.PrinterName = printerName;
            if (!printDocument.PrinterSettings.IsValid)
                throw new Exception($"Printer '{printerName}' not found on the API computer.");
        }

        printDocument.Print();
    }
}
