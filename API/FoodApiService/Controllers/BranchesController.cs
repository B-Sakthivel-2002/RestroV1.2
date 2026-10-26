using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// SuperAdmin (outlet owner): all branches of their outlet, may create/delete branches.
// Admin (branch head): only their own branch, may view and edit it.
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
public class BranchesController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public BranchesController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    private async Task<IQueryable<Branch>> Visible()
    {
        var branchIds = (await _tenant.GetAsync()).BranchIds;
        return _context.Branches.Where(b => branchIds.Contains(b.Branchid));
    }

    [HttpGet]
    public async Task<IActionResult> GetBranches()
    {
        return Ok(new { status = "Success", message = "Branches fetched successfully", data = await (await Visible()).OrderBy(b => b.Branchid).ToListAsync() });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBranch(int id)
    {
        var branch = await (await Visible()).FirstOrDefaultAsync(b => b.Branchid == id);
        if (branch == null)
            return NotFound(new { status = "Error", message = "No branch found", data = (object)null });

        return Ok(new { status = "Success", message = "Branch fetched successfully", data = branch });
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<IActionResult> PostBranch([FromBody] Branch branch)
    {
        var tenant = await _tenant.GetAsync();
        branch.Outletid = tenant.OutletId;
        if (await CodeTaken(branch.Code, 0))
            return BadRequest(new { status = "Error", message = "Branch code already exists", data = (object)null });

        _context.Branches.Add(branch);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Branch created successfully", data = branch });
    }

    [HttpPost("UpdateBranch")]
    public async Task<IActionResult> UpdateBranch([FromBody] Branch branch)
    {
        var existing = await (await Visible()).AsNoTracking().FirstOrDefaultAsync(b => b.Branchid == branch.Branchid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Branch not found", data = (object)null });
        if (await CodeTaken(branch.Code, branch.Branchid))
            return BadRequest(new { status = "Error", message = "Branch code already exists", data = (object)null });

        branch.Outletid = existing.Outletid;
        _context.Entry(branch).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Branch not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Branch updated successfully", data = branch });
    }

    [HttpPost("DeleteBranch/{id}")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<IActionResult> DeleteBranch(int id)
    {
        var branch = await (await Visible()).FirstOrDefaultAsync(b => b.Branchid == id);
        if (branch == null)
            return NotFound(new { status = "Error", message = "No branch found", data = (object)null });

        _context.Branches.Remove(branch);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Branch deleted successfully", data = branch });
    }

    private async Task<bool> CodeTaken(string? code, int exceptBranchId)
    {
        if (string.IsNullOrWhiteSpace(code))
            return false;
        string upper = code.Trim().ToUpper();
        return await _context.Branches.AnyAsync(b => b.Code != null && b.Code.ToUpper() == upper && b.Branchid != exceptBranchId);
    }
}
