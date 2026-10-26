using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class MealTypeController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public MealTypeController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    [HttpGet]
    public async Task<IActionResult> GetMealTypes([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Mealtypes.ForList(tenant, allBranches).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No mealtypes found", data = (object)null });
        return Ok(new { status = "Success", message = "Meal types fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetMealType(int id)
    {
        var tenant = await _tenant.GetAsync();
        var mealtype = await _context.Mealtypes.ForBranch(tenant).FirstOrDefaultAsync(m => m.Mealtypeid == id);
        if (mealtype == null)
            return NotFound(new { status = "Error", message = "Meal type not found", data = (object)null });
        return Ok(new { status = "Success", message = "Meal type fetched successfully", data = mealtype });
    }

    [HttpPost]
    public async Task<IActionResult> PostMealType([FromBody] Mealtype mealtype)
    {
        var tenant = await _tenant.GetAsync();
        mealtype.StampBranch(tenant, mealtype.Branchid);
        _context.Mealtypes.Add(mealtype);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetMealType", new { id = mealtype.Mealtypeid }, new { status = "Success", message = "Meal type created successfully", data = mealtype });
    }

    [HttpPost("UpdateMealType")]
    public async Task<IActionResult> UpdateMealType([FromBody] Mealtype mealtype)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Mealtypes.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(m => m.Mealtypeid == mealtype.Mealtypeid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Meal type not found", data = (object)null });

        mealtype.KeepScopeOf(existing);
        _context.Entry(mealtype).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Meal type not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Meal type updated successfully", data = mealtype });
    }

    [HttpPost("DeleteMealType/{id}")]
    public async Task<IActionResult> DeleteMealType(int id)
    {
        var tenant = await _tenant.GetAsync();
        var mealtype = await _context.Mealtypes.ForBranch(tenant).FirstOrDefaultAsync(m => m.Mealtypeid == id);
        if (mealtype == null)
            return NotFound(new { status = "Error", message = "Meal type not found", data = (object)null });
        _context.Mealtypes.Remove(mealtype);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Meal type deleted successfully", data = mealtype });
    }
}
