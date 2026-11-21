using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace FoodApiService.Controllers;

// Settings > Profile "Log out all devices": branch heads and outlet owners only.
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
public class SessionsController : ControllerBase
{
    private readonly ITenantContext _tenant;
    private readonly SessionRevocation _sessions;
    private readonly IHubContext<KOTNotificationHub> _hub;

    public SessionsController(ITenantContext tenant, SessionRevocation sessions, IHubContext<KOTNotificationHub> hub)
    {
        _tenant = tenant;
        _sessions = sessions;
        _hub = hub;
    }

    public class LogoutAllRequest
    {
        // Outlet owners may name a branch of their outlet; everyone else always gets their own branch.
        public int? BranchId { get; set; }
    }

    // Logs out every device of the branch (the caller's too): web and mobile alike.
    [HttpPost("LogoutAll")]
    public async Task<IActionResult> LogoutAll([FromBody] LogoutAllRequest? request)
    {
        var tenant = await _tenant.GetAsync();
        int branchId = tenant.ResolveBranch(request?.BranchId);
        if (branchId <= 0)
            return BadRequest(new { status = "Error", message = "No branch to log out" });

        await _sessions.RevokeAsync(branchId, tenant.UserId);

        // Screens that are open right now leave at once; the rest are refused at their next call.
        await _hub.Clients.Group(KOTNotificationHub.BranchGroup(branchId))
            .SendAsync(SessionRevocation.ForceLogoutEvent, new { branchId, by = tenant.Username, at = DateTime.Now });

        return Ok(new { status = "Success", message = "All devices of this branch have been logged out" });
    }
}
