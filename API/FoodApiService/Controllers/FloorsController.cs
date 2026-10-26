using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager,Captain")]
public class FloorsController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public FloorsController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    // Floor master: every branch the caller may see (all outlet branches for an owner).
    [HttpGet]
    public async Task<IActionResult> GetFloors()
    {
        var tenant = await _tenant.GetAsync();
        var branchIds = tenant.BranchIds;

        var list = await _context.Floors.Where(f => branchIds.Contains(f.Branchid)).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No floors found", data = (object)null });

        return Ok(new { status = "Success", message = "Floors fetched successfully", data = list });
    }

    // Dine-in screen: only the caller's own branch, where their orders are taken.
    [HttpGet("GetActiveFloors")]
    public async Task<IActionResult> GetActiveFloors()
    {
        var tenant = await _tenant.GetAsync();
        int branchid = tenant.BranchId;

        var list = await _context.Floors.Where(x => x.Status == true && x.Branchid == branchid).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No floors found", data = (object)null });

        return Ok(new { status = "Success", message = "Floors fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetFloor(int id)
    {
        var tenant = await _tenant.GetAsync();
        var branchIds = tenant.BranchIds;
        var floor = await _context.Floors.FirstOrDefaultAsync(f => f.Floorid == id && branchIds.Contains(f.Branchid));
        if (floor == null)
            return NotFound(new { status = "Error", message = "Floor not found", data = (object)null });

        return Ok(new { status = "Success", message = "Floor fetched successfully", data = floor });
    }

    [HttpPost]
    public async Task<IActionResult> PostFloor([FromBody] Floor floor)
    {
        try
        {
            var tenant = await _tenant.GetAsync();
            floor.Branchid = tenant.ResolveBranch(floor.Branchid);
            floor.Outletid = tenant.OutletId;
            _context.Floors.Add(floor);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                status = "Success",
                message = "Floor created successfully",
                data = floor
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                status = "Error",
                message = ex.Message,
                innerException = ex.InnerException?.Message,
                stackTrace = ex.StackTrace
            });
        }
    }

    [HttpPost("UpdateFloor")]
    public async Task<IActionResult> UpdateFloor([FromBody] Floor floor)
    {
        var tenant = await _tenant.GetAsync();
        var branchIds = tenant.BranchIds;
        var existing = await _context.Floors.AsNoTracking().FirstOrDefaultAsync(f => f.Floorid == floor.Floorid && branchIds.Contains(f.Branchid));
        if (existing == null)
            return NotFound(new { status = "Error", message = "Floor not found", data = (object)null });

        floor.Branchid = existing.Branchid;
        floor.Outletid = existing.Outletid;
        _context.Entry(floor).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Floor not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Floor updated successfully", data = floor });
    }

    [HttpPost("DeleteFloor/{id}")]
    public async Task<IActionResult> DeleteFloor(int id)
    {
        var tenant = await _tenant.GetAsync();
        var branchIds = tenant.BranchIds;
        var floor = await _context.Floors.FirstOrDefaultAsync(f => f.Floorid == id && branchIds.Contains(f.Branchid));
        if (floor == null)
            return NotFound(new { status = "Error", message = "Floor not found", data = (object)null });

        _context.Floors.Remove(floor);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Floor deleted successfully", data = floor });
    }
}
