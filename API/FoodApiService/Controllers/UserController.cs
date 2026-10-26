using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// SuperAdmin (outlet owner): users of every branch in their outlet.
// Admin (branch head): users of their own branch; cannot grant the SuperAdmin role.
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
public class UserController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public UserController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var tenant = await _tenant.GetAsync();
        var list = await ManageableUsers(tenant).Select(u => new
        {
            Userid = u.Userid,
            Username = u.Username,
            Password = u.Password,
            Status = u.Status,
            Branchid = u.Branchid,
            RoleId = _context.Userroles.Where(x => x.Userid == u.Userid).Select(x => x.Roleid).FirstOrDefault(),
            Role = _context.Roles.Where(r => r.Roleid == _context.Userroles.Where(x => x.Userid == u.Userid).Select(x => x.Roleid).FirstOrDefault()).Select(r => r.Rolename).FirstOrDefault(),
            BranchName = _context.Branches.Where(b => b.Branchid == u.Branchid).Select(b => b.Branchname).FirstOrDefault(),
            Outletid = u.Outletid
        }).ToListAsync();

        if (!list.Any())
            return Ok(new { status = "Success", message = "No users found", data = (object)null });

        return Ok(new { status = "Success", message = "Users fetched", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        var tenant = await _tenant.GetAsync();
        var user = await ManageableUsers(tenant).FirstOrDefaultAsync(u => u.Userid == id);
        if (user == null)
            return NotFound(new { status = "Error", message = "User not found", data = (object)null });

        return Ok(new { status = "Success", message = "User fetched", data = user });
    }

    [HttpPost]
    public async Task<IActionResult> PostUser([FromBody] User user)
    {
        var tenant = await _tenant.GetAsync();
        if (string.IsNullOrWhiteSpace(user.Username))
            return BadRequest(new { status = "Error", message = "Username is required", data = (object)null });

        user.Username = user.Username.Trim();
        if (await UsernameTaken(user.Username, 0))
            return BadRequest(new { status = "Error", message = "Username already exists", data = (object)null });

        user.StampBranch(tenant, user.Branchid);
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "User created", data = user });
    }

    [HttpPost("UpdateUser")]
    public async Task<IActionResult> UpdateUser([FromBody] User user)
    {
        if (user.Userid == 0)
            return BadRequest(new { status = "Error", message = "Invalid user ID", data = (object)null });

        var tenant = await _tenant.GetAsync();
        var existing = await ManageableUsers(tenant).AsNoTracking().FirstOrDefaultAsync(u => u.Userid == user.Userid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "User not found", data = (object)null });

        if (string.IsNullOrWhiteSpace(user.Username))
            return BadRequest(new { status = "Error", message = "Username is required", data = (object)null });
        user.Username = user.Username.Trim();
        if (await UsernameTaken(user.Username, user.Userid))
            return BadRequest(new { status = "Error", message = "Username already exists", data = (object)null });

        // An owner may move a user between branches of their outlet; a branch head cannot.
        user.Branchid = tenant.IsOutletOwner ? tenant.ResolveBranch(user.Branchid ?? existing.Branchid) : existing.Branchid;
        user.Outletid = existing.Outletid ?? tenant.OutletId;
        _context.Entry(user).State = EntityState.Modified;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return NotFound(new { status = "Error", message = "User not found", data = (object)null });
        }
        return Ok(new { status = "Success", message = "User updated", data = user });
    }

    [HttpPost("DeleteUser/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var tenant = await _tenant.GetAsync();
        var user = await ManageableUsers(tenant).FirstOrDefaultAsync(u => u.Userid == id);
        if (user == null)
            return NotFound(new { status = "Error", message = "User not found", data = (object)null });

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "User deleted", data = user });
    }

    [HttpPost("AssignRole")]
    public async Task<IActionResult> AssignRoleToUser([FromBody] Userrole userRole)
    {
        var tenant = await _tenant.GetAsync();
        var user = await ManageableUsers(tenant).AsNoTracking().FirstOrDefaultAsync(u => u.Userid == userRole.Userid);
        if (user == null)
            return NotFound(new { status = "Error", message = "User not found" });

        var role = await _context.Roles.AsNoTracking().ForOutlet(tenant).FirstOrDefaultAsync(r => r.Roleid == userRole.Roleid);
        if (role == null)
            return NotFound(new { status = "Error", message = "Role not found" });
        if (role.Rolename == AppRoles.SuperAdmin && !tenant.IsOutletOwner)
            return StatusCode(StatusCodes.Status403Forbidden, new { status = "Error", message = "Only an outlet owner can assign the SuperAdmin role" });

        var existing = await _context.Userroles.Where(ur => ur.Userid == userRole.Userid).FirstOrDefaultAsync();
        if (existing != null)
        {
            existing.Roleid = userRole.Roleid;
            existing.KeepScopeOf(user);
        }
        else
        {
            userRole.KeepScopeOf(user);
            _context.Userroles.Add(userRole);
        }
        await _context.SaveChangesAsync();

        return Ok(new { status = "Success", message = $"Role '{role.Rolename}' assigned to user" });
    }

    [HttpPost("DeleteAssingedRole/{id}")]
    public async Task<IActionResult> DeleteAssingedRole(int id)
    {
        var tenant = await _tenant.GetAsync();
        var userIds = ManageableUsers(tenant).Select(u => u.Userid);
        var userrole = await _context.Userroles.Where(p => p.Userroleid == id && userIds.Contains(p.Userid)).FirstOrDefaultAsync();
        if (userrole != null)
        {
            _context.Userroles.Remove(userrole);
            await _context.SaveChangesAsync();
            return Ok(new { status = "Susccess", message = "Deleted successfully" });
        }
        return NotFound(new { status = "Error", message = "User not found" });
    }

    [HttpGet("GetAssignedRoles/{userId}")]
    public async Task<IActionResult> GetAssignedRoles(int userId)
    {
        var tenant = await _tenant.GetAsync();
        if (!await ManageableUsers(tenant).AnyAsync(u => u.Userid == userId))
            return NotFound(new { status = "Error", message = "No roles assigned to this user", data = (object)null });

        var list = await _context.Userroles.Where(ur => ur.Userid == userId).Select(ur => new
        {
            Userroleid = ur.Userroleid,
            Userid = ur.Userid,
            RoleId = ur.Roleid,
            RoleName = _context.Roles.Where(r => r.Roleid == ur.Roleid).Select(r => r.Rolename).FirstOrDefault()
        }).ToListAsync();

        if (list == null || !list.Any())
            return NotFound(new { status = "Error", message = "No roles assigned to this user", data = (object)null });

        return Ok(new { status = "Success", message = "Fetched Successfully", data = list });
    }

    // Users the caller may see and manage. Branch heads never see outlet owners' accounts,
    // even when the owner's home branch is theirs.
    private IQueryable<User> ManageableUsers(TenantInfo tenant)
    {
        var users = _context.Users.ForBranch(tenant);
        if (tenant.IsOutletOwner)
            return users;

        var ownerIds = from ur in _context.Userroles
                       join r in _context.Roles on ur.Roleid equals r.Roleid
                       where r.Rolename == AppRoles.SuperAdmin
                       select ur.Userid;
        return users.Where(u => !ownerIds.Contains(u.Userid));
    }

    // Usernames are unique across every outlet and branch, ignoring case, because login is username + password only.
    private Task<bool> UsernameTaken(string username, int exceptUserId)
    {
        string lower = username.ToLower();
        return _context.Users.AnyAsync(u => u.Username.ToLower() == lower && u.Userid != exceptUserId);
    }
}
