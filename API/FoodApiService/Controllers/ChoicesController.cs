using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class ChoicesController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public ChoicesController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    [HttpGet]
    public async Task<IActionResult> GetChoices([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Choices.ForList(tenant, allBranches).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No choices found", data = (object)null });
        return Ok(new { status = "Success", message = "Choices fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetChoice(int id)
    {
        var tenant = await _tenant.GetAsync();
        var choice = await _context.Choices.ForBranch(tenant).FirstOrDefaultAsync(c => c.Choiceid == id);
        if (choice == null)
            return NotFound(new { status = "Error", message = "Choice not found", data = (object)null });
        return Ok(new { status = "Success", message = "Choice fetched successfully", data = choice });
    }

    [HttpPost]
    public async Task<IActionResult> PostChoice([FromBody] Choice choice)
    {
        var tenant = await _tenant.GetAsync();
        choice.StampBranch(tenant, choice.Branchid);
        _context.Choices.Add(choice);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Choice created successfully", data = choice });
    }

    [HttpPost("UpdateChoice")]
    public async Task<IActionResult> UpdateChoice([FromBody] Choice choice)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Choices.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(c => c.Choiceid == choice.Choiceid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Choice not found", data = (object)null });

        choice.KeepScopeOf(existing);
        _context.Entry(choice).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Choice not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Choice updated successfully", data = choice });
    }

    [HttpPost("DeleteChoice/{id}")]
    public async Task<IActionResult> DeleteChoice(int id)
    {
        var tenant = await _tenant.GetAsync();
        var choice = await _context.Choices.ForBranch(tenant).FirstOrDefaultAsync(c => c.Choiceid == id);
        if (choice == null)
            return NotFound(new { status = "Error", message = "Choice not found", data = (object)null });
        _context.Choices.Remove(choice);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Choice deleted successfully", data = choice });
    }
}
