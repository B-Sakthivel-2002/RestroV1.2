using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FoodApiService.Controllers;

// "Mobile App Connect" page: the API address a phone on the same network can use. The browser often
// talks to the API as localhost, which a phone cannot reach, so the server lists its own network
// (IPv4) addresses and builds the API URL from them with the port and path this request came in on.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class ServerInfoController : ControllerBase
{
    [HttpGet("Connect")]
    public IActionResult Connect()
    {
        string scheme = Request.Scheme;
        int port = HttpContext.Connection.LocalPort;
        string basePath = Request.PathBase.HasValue ? Request.PathBase.Value!.TrimEnd('/') : "";

        var addresses = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up
                        && n.NetworkInterfaceType != NetworkInterfaceType.Loopback
                        && n.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
            .SelectMany(n =>
            {
                var props = n.GetIPProperties();
                // An adapter with a gateway is the real LAN / Wi-Fi one (virtual adapters usually have none).
                bool hasGateway = props.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork
                                                                 && !g.Address.Equals(IPAddress.Any));
                return props.UnicastAddresses
                    .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork
                                && !IPAddress.IsLoopback(a.Address)
                                && !a.Address.ToString().StartsWith("169.254."))
                    .Select(a => new
                    {
                        ip = a.Address.ToString(),
                        adapter = n.Name,
                        kind = n.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? "Wi-Fi"
                             : n.NetworkInterfaceType == NetworkInterfaceType.Ethernet ? "Ethernet" : n.NetworkInterfaceType.ToString(),
                        preferred = hasGateway,
                        apiUrl = $"{scheme}://{a.Address}:{port}{basePath}/api/"
                    });
            })
            .OrderByDescending(a => a.preferred)
            .ThenBy(a => a.kind == "Wi-Fi" ? 0 : a.kind == "Ethernet" ? 1 : 2)
            .ToList();

        return Ok(new
        {
            status = "Success",
            machineName = Environment.MachineName,
            port,
            scheme,
            basePath,
            addresses
        });
    }
}
