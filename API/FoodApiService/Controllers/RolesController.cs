using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Roles with Outletid NULL are the built-in roles used by [Authorize]; they are shared by every
// outlet and read-only here. Only an outlet owner (SuperAdmin) sees or assigns the SuperAdmin role.
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
public class RolesController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public RolesController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    private IQueryable<Role> Visible(TenantInfo tenant)
    {
        var query = _context.Roles.ForOutlet(tenant);
        return tenant.IsOutletOwner ? query : query.Where(r => r.Rolename != AppRoles.SuperAdmin);
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var list = await Visible(await _tenant.GetAsync()).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No roles found", data = (object)null });

        return Ok(new { status = "Success", message = "Roles fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRole(int id)
    {
        var role = await Visible(await _tenant.GetAsync()).FirstOrDefaultAsync(r => r.Roleid == id);
        if (role == null)
            return NotFound(new { status = "Error", message = "No role found", data = (object)null });

        return Ok(new { status = "Success", message = "Role fetched successfully", data = role });
    }

    [HttpPost]
    public async Task<IActionResult> PostRole([FromBody] Role role)
    {
        var tenant = await _tenant.GetAsync();
        role.StampOutlet(tenant);
        _context.Roles.Add(role);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Role created successfully", data = role });
    }

    [HttpPost("UpdateRole")]
    public async Task<IActionResult> UpdateRole([FromBody] Role role)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await Visible(tenant).AsNoTracking().FirstOrDefaultAsync(r => r.Roleid == role.Roleid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Role not found", data = (object)null });
        if (existing.Outletid == null)
            return BadRequest(new { status = "Error", message = "Built-in roles are shared by all outlets and cannot be changed", data = (object)null });

        role.KeepScopeOf(existing);
        _context.Entry(role).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Role not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Role updated successfully", data = role });
    }

    [HttpPost("DeleteRole/{id}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var role = await Visible(await _tenant.GetAsync()).FirstOrDefaultAsync(r => r.Roleid == id);
        if (role == null)
            return NotFound(new { status = "Error", message = "No role found", data = (object)null });
        if (role.Outletid == null)
            return BadRequest(new { status = "Error", message = "Built-in roles are shared by all outlets and cannot be deleted", data = (object)null });

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Role deleted successfully", data = role });
    }
}
