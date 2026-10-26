using System.Net;
using System.Net.Mail;
using FoodApiService.Models;

namespace FoodApiService.Service;

public class EmailSettings
{
    // Nothing is sent until this is true and Host / FromAddress are filled in.
    public bool Enabled { get; set; }

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public bool EnableSsl { get; set; } = true;

    public string? Username { get; set; }

    // For Gmail use an App Password (Google account > Security > App passwords).
    public string? Password { get; set; }

    public string? FromAddress { get; set; }

    public string? FromName { get; set; }
}

// Customer notifications for the waitlist. Sending runs in the background: a slow or failing
// mail server never delays or fails the captain's request, it is only logged.
public class EmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _settings = configuration.GetSection("EmailSettings").Get<EmailSettings>() ?? new EmailSettings();
        _logger = logger;
    }

    public bool IsConfigured =>
        _settings.Enabled && !string.IsNullOrWhiteSpace(_settings.Host) && !string.IsNullOrWhiteSpace(_settings.FromAddress);

    public void SendTokenCreated(WaitlistToken token, string branchName, int partiesAhead, int estimatedMinutes)
    {
        string wait = partiesAhead == 0
            ? "You are next in line."
            : $"{partiesAhead} part{(partiesAhead == 1 ? "y is" : "ies are")} ahead of you (about {estimatedMinutes} minutes).";

        Send(token.Email, $"Your token {token.Tokencode} - {branchName}",
            $"Hello {token.Customername},\n\n" +
            $"Thank you for visiting {branchName}. Your token number is {token.Tokencode} for {token.Guests} guest(s).\n" +
            $"{wait}\n\nWe will email you again as soon as your table is ready.\n\n{branchName}");
    }

    public void SendTableReady(WaitlistToken token, Table table, string branchName)
    {
        Send(token.Email, $"Your table is ready - token {token.Tokencode}",
            $"Hello {token.Customername},\n\n" +
            $"Your table {table.Tablename} is ready. Please come to the entrance and show token {token.Tokencode} to our captain.\n\n" +
            $"{branchName}");
    }

    private void Send(string? to, string subject, string body)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(to))
            return;

        _ = Task.Run(async () =>
        {
            try
            {
                using var message = new MailMessage
                {
                    From = new MailAddress(_settings.FromAddress!, _settings.FromName ?? _settings.FromAddress),
                    Subject = subject,
                    Body = body
                };
                message.To.Add(to);

                using var client = new SmtpClient(_settings.Host, _settings.Port)
                {
                    EnableSsl = _settings.EnableSsl,
                    Credentials = string.IsNullOrEmpty(_settings.Username)
                        ? null
                        : new NetworkCredential(_settings.Username, _settings.Password)
                };
                await client.SendMailAsync(message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Waitlist email to {To} failed: {Subject}", to, subject);
            }
        });
    }
}
