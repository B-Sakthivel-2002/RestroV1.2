using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace FoodApiService.Service;

// appsettings "WhatsAppSettings". Off until Enabled = true and the API details are filled in.
public class WhatsAppSettings
{
    public bool Enabled { get; set; }

    // "Meta"  = WhatsApp Business Cloud API (graph.facebook.com), needs PhoneNumberId + AccessToken.
    // "Log"   = no API call, the message is only written to the API log (to try the flow without a key).
    public string Provider { get; set; } = "Meta";

    public string ApiUrl { get; set; } = "https://graph.facebook.com/v21.0";
    public string? PhoneNumberId { get; set; }
    public string? AccessToken { get; set; }

    // Added in front of 10-digit local numbers ("9876543210" -> "919876543210").
    public string DefaultCountryCode { get; set; } = "91";

    // Meta only delivers free text inside 24 h of the customer's last message; business-initiated
    // messages need approved templates. true = send the event's Template, false = plain text.
    public bool UseTemplates { get; set; } = true;
    public string LanguageCode { get; set; } = "en";

    // Template for POST api/WhatsApp/Test. "hello_world" (en_US) exists on every Meta test number.
    public string TestTemplate { get; set; } = "hello_world";
    public string TestLanguageCode { get; set; } = "en_US";

    public int TimeoutSeconds { get; set; } = 15;

    public WhatsAppEvent OrderPlaced { get; set; } = new() { Template = "order_placed" };
    public WhatsAppEvent PaymentReceived { get; set; } = new() { Template = "payment_received" };
    public WhatsAppEvent TokenBooked { get; set; } = new() { Template = "token_booked" };
    public WhatsAppEvent TableReady { get; set; } = new() { Template = "table_ready" };

    // Sales report sent to the owner from the Sales Report page.
    public OwnerReportSettings OwnerReport { get; set; } = new();
}

public class OwnerReportSettings
{
    public bool Enabled { get; set; } = true;
    // Variables: 1 branch, 2 period, 3 bills, 4 total sales, 5 paid / unpaid / complimentary,
    // 6 tax / discount, 7 payment modes, 8 top items.
    public string? Template { get; set; } = "owner_sales_report";
    // Owner mobile numbers (10 digits get DefaultCountryCode).
    public string[] OwnerNumbers { get; set; } = Array.Empty<string>();
    // Items listed in the template's item variable (plain text lists all items).
    public int MaxItemsInTemplate { get; set; } = 10;
}

public class WhatsAppEvent
{
    public bool Enabled { get; set; } = true;
    // Approved template name on the WhatsApp Business account; its body variables {{1}}, {{2}}...
    // are filled in the order documented on each Send method below.
    public string? Template { get; set; }
}

public record WhatsAppMessage(string Event, string To, string? Template, string? Language, IReadOnlyList<string> Parameters, string Text);

public record WhatsAppResult(bool Ok, string Detail);

// Builds the customer messages and queues them; WhatsAppSender delivers them in the background,
// so a slow or failing WhatsApp API never delays an order or a bill.
public class WhatsAppService
{
    private readonly Channel<WhatsAppMessage> _queue = Channel.CreateBounded<WhatsAppMessage>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });
    private readonly IHttpClientFactory _http;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppSettings Settings { get; }

    public WhatsAppService(IConfiguration configuration, IHttpClientFactory http, ILogger<WhatsAppService> logger)
    {
        _http = http;
        _logger = logger;
        Settings = configuration.GetSection("WhatsAppSettings").Get<WhatsAppSettings>() ?? new WhatsAppSettings();
    }

    public bool IsLogOnly => string.Equals(Settings.Provider, "Log", StringComparison.OrdinalIgnoreCase);

    public bool IsConfigured => Settings.Enabled
        && (IsLogOnly || (!string.IsNullOrWhiteSpace(Settings.PhoneNumberId) && !string.IsNullOrWhiteSpace(Settings.AccessToken)));

    internal ChannelReader<WhatsAppMessage> Reader => _queue.Reader;

    // Order sent to the kitchen. Template variables: 1 name, 2 restaurant, 3 order no, 4 items, 5 table / order type.
    public void SendOrderPlaced(string? phone, string? name, string restaurant, string? orderNumber, string items, string place) =>
        Queue("OrderPlaced", Settings.OrderPlaced, phone,
            new[] { NameOrGuest(name), restaurant, orderNumber ?? "-", items, place },
            $"Hi {NameOrGuest(name)}, thank you for ordering at {restaurant}! We have received your order {orderNumber} ({place}): {items}.");

    // Bill settled. Variables: 1 name, 2 restaurant, 3 bill no, 4 amount paid, 5 payment mode.
    public void SendPaymentReceived(string? phone, string? name, string restaurant, string? billNumber, decimal amount, string? paymentMode) =>
        Queue("PaymentReceived", Settings.PaymentReceived, phone,
            new[] { NameOrGuest(name), restaurant, billNumber ?? "-", Money(amount), string.IsNullOrWhiteSpace(paymentMode) ? "-" : paymentMode! },
            $"Hi {NameOrGuest(name)}, we have received your payment of {Money(amount)} ({paymentMode}) for bill {billNumber} at {restaurant}. Thank you, visit again!");

    // Waitlist token issued. Variables: 1 name, 2 restaurant, 3 token, 4 parties ahead, 5 approx. minutes.
    public void SendTokenBooked(string? phone, string? name, string restaurant, string token, int partiesAhead, int minutes) =>
        Queue("TokenBooked", Settings.TokenBooked, phone,
            new[] { NameOrGuest(name), restaurant, token, partiesAhead.ToString(), minutes.ToString() },
            $"Hi {NameOrGuest(name)}, your token at {restaurant} is {token}. Parties ahead of you: {partiesAhead} (about {minutes} min). We will message you when your table is ready.");

    // Table held for the token. Variables: 1 name, 2 restaurant, 3 token, 4 table.
    public void SendTableReady(string? phone, string? name, string restaurant, string token, string? table) =>
        Queue("TableReady", Settings.TableReady, phone,
            new[] { NameOrGuest(name), restaurant, token, table ?? "-" },
            $"Hi {NameOrGuest(name)}, your table {table} at {restaurant} is ready. Please show token {token} to our captain.");

    // Owner sales report: sent now to every OwnerNumbers entry, result per number.
    public async Task<List<(string To, WhatsAppResult Result)>> SendOwnerReportAsync(string[] parameters, string text, CancellationToken ct)
    {
        var results = new List<(string, WhatsAppResult)>();
        var cfg = Settings.OwnerReport;
        bool template = Settings.UseTemplates && !string.IsNullOrWhiteSpace(cfg.Template);
        foreach (var number in cfg.OwnerNumbers.Where(n => !string.IsNullOrWhiteSpace(n)))
        {
            string? to = Normalize(number);
            if (to == null)
            {
                results.Add((number, new WhatsAppResult(false, "Not a valid mobile number")));
                continue;
            }
            var message = new WhatsAppMessage("OwnerReport", to, template ? cfg.Template : null, Settings.LanguageCode,
                parameters.Select(Clean).ToList(), text);
            results.Add((Mask(to), await DeliverAsync(message, ct)));
        }
        return results;
    }

    // Sends now (not queued) and returns the API's answer: for checking the settings.
    public async Task<WhatsAppResult> SendTestAsync(string phone, string? text, CancellationToken ct)
    {
        string? to = Normalize(phone);
        if (to == null)
            return new WhatsAppResult(false, "Enter a valid mobile number");
        var message = string.IsNullOrWhiteSpace(text)
            ? new WhatsAppMessage("Test", to, Settings.TestTemplate, Settings.TestLanguageCode, Array.Empty<string>(), "Test message")
            : new WhatsAppMessage("Test", to, null, null, Array.Empty<string>(), text!.Trim());
        return await DeliverAsync(message, ct);
    }

    private void Queue(string evt, WhatsAppEvent config, string? phone, string[] parameters, string text)
    {
        if (!IsConfigured || !config.Enabled)
            return;
        string? to = Normalize(phone);
        if (to == null)
            return;
        bool template = Settings.UseTemplates && !string.IsNullOrWhiteSpace(config.Template);
        var message = new WhatsAppMessage(evt, to, template ? config.Template : null, Settings.LanguageCode,
            parameters.Select(Clean).ToList(), text);
        if (!_queue.Writer.TryWrite(message))
            _logger.LogWarning("WhatsApp {Event} to {To} dropped: queue full", evt, Mask(to));
    }

    internal async Task<WhatsAppResult> DeliverAsync(WhatsAppMessage message, CancellationToken ct)
    {
        if (IsLogOnly)
        {
            _logger.LogInformation("WhatsApp [Log] {Event} to {To}: {Body}", message.Event, Mask(message.To),
                message.Template != null ? $"template {message.Template} ({string.Join(" | ", message.Parameters)})" : message.Text);
            return new WhatsAppResult(true, "Logged only (Provider = Log)");
        }
        if (string.IsNullOrWhiteSpace(Settings.PhoneNumberId) || string.IsNullOrWhiteSpace(Settings.AccessToken))
            return new WhatsAppResult(false, "PhoneNumberId and AccessToken are required in WhatsAppSettings");

        object body = message.Template != null
            ? new
            {
                messaging_product = "whatsapp",
                to = message.To,
                type = "template",
                template = new
                {
                    name = message.Template,
                    language = new { code = message.Language ?? Settings.LanguageCode },
                    components = message.Parameters.Count == 0
                        ? Array.Empty<object>()
                        : new object[] { new { type = "body", parameters = message.Parameters.Select(p => new { type = "text", text = p }).ToArray() } }
                }
            }
            : new { messaging_product = "whatsapp", to = message.To, type = "text", text = new { preview_url = false, body = message.Text } };

        try
        {
            var client = _http.CreateClient(nameof(WhatsAppService));
            client.Timeout = TimeSpan.FromSeconds(Math.Max(5, Settings.TimeoutSeconds));
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{Settings.ApiUrl.TrimEnd('/')}/{Settings.PhoneNumberId}/messages")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Settings.AccessToken);
            using var response = await client.SendAsync(request, ct);
            string answer = await response.Content.ReadAsStringAsync(ct);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("WhatsApp {Event} sent to {To}", message.Event, Mask(message.To));
                return new WhatsAppResult(true, answer);
            }
            _logger.LogWarning("WhatsApp {Event} to {To} failed: {Status} {Answer}", message.Event, Mask(message.To), (int)response.StatusCode, answer);
            return new WhatsAppResult(false, $"{(int)response.StatusCode}: {answer}");
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "WhatsApp {Event} to {To} failed", message.Event, Mask(message.To));
            return new WhatsAppResult(false, ex.Message);
        }
    }

    // Digits only, country code added to local numbers. null = not a usable number.
    public string? Normalize(string? phone)
    {
        string digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        if (digits.StartsWith("00"))
            digits = digits[2..];
        if (digits.Length == 11 && digits.StartsWith("0"))
            digits = digits[1..];
        if (digits.Length == 10 && !string.IsNullOrWhiteSpace(Settings.DefaultCountryCode))
            digits = Settings.DefaultCountryCode.Trim().TrimStart('+') + digits;
        return digits.Length is >= 11 and <= 15 ? digits : null;
    }

    private static string NameOrGuest(string? name) => string.IsNullOrWhiteSpace(name) ? "Guest" : name.Trim();

    private static string Money(decimal amount) => "Rs. " + amount.ToString("0.00");

    // Template variables may not contain new lines, tabs or more than 4 spaces in a row.
    private static string Clean(string value)
    {
        string v = (value ?? "").Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
        while (v.Contains("     ")) v = v.Replace("     ", "    ");
        v = v.Trim();
        return v.Length == 0 ? "-" : v.Length > 900 ? v[..900] : v;
    }

    private static string Mask(string to) => to.Length <= 4 ? to : new string('*', to.Length - 4) + to[^4..];
}

// Sends the queued messages one by one.
public class WhatsAppSender : BackgroundService
{
    private readonly WhatsAppService _whatsApp;

    public WhatsAppSender(WhatsAppService whatsApp) => _whatsApp = whatsApp;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var message in _whatsApp.Reader.ReadAllAsync(stoppingToken))
                await _whatsApp.DeliverAsync(message, stoppingToken);
        }
        catch (OperationCanceledException) { }
    }
}
