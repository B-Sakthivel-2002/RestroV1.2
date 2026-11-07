using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FoodApiService.Controllers;

// Check the WhatsApp settings: what is switched on, and send one test message.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class WhatsAppController : ControllerBase
{
    private readonly WhatsAppService _whatsApp;

    public WhatsAppController(WhatsAppService whatsApp) => _whatsApp = whatsApp;

    public class TestRequest
    {
        public string? Phone { get; set; }
        // Empty = the TestTemplate (hello_world). Free text only reaches numbers that messaged you in the last 24 h.
        public string? Text { get; set; }
    }

    [HttpGet("Status")]
    public IActionResult Status()
    {
        var s = _whatsApp.Settings;
        return Ok(new
        {
            status = "Success",
            data = new
            {
                s.Enabled, s.Provider, configured = _whatsApp.IsConfigured, s.UseTemplates, s.LanguageCode,
                phoneNumberIdSet = !string.IsNullOrWhiteSpace(s.PhoneNumberId),
                accessTokenSet = !string.IsNullOrWhiteSpace(s.AccessToken),
                events = new
                {
                    orderPlaced = new { s.OrderPlaced.Enabled, s.OrderPlaced.Template },
                    paymentReceived = new { s.PaymentReceived.Enabled, s.PaymentReceived.Template },
                    tokenBooked = new { s.TokenBooked.Enabled, s.TokenBooked.Template },
                    tableReady = new { s.TableReady.Enabled, s.TableReady.Template }
                }
            }
        });
    }

    [HttpPost("Test")]
    public async Task<IActionResult> Test([FromBody] TestRequest request, CancellationToken ct)
    {
        if (!_whatsApp.Settings.Enabled)
            return BadRequest(new { status = "Error", message = "WhatsApp is disabled (WhatsAppSettings:Enabled = false)" });
        var result = await _whatsApp.SendTestAsync(request.Phone ?? "", request.Text, ct);
        return Ok(new { status = result.Ok ? "Success" : "Error", message = result.Detail });
    }
}
