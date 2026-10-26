using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class TimeSlotController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public TimeSlotController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    [HttpGet]
    public async Task<IActionResult> GetTimeSlots()
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Timeslots.ForBranch(tenant).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No timeslots found", data = (object)null });
        return Ok(new { status = "Success", message = "Time slots fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTimeSlot(int id)
    {
        var tenant = await _tenant.GetAsync();
        var timeslot = await _context.Timeslots.ForBranch(tenant).FirstOrDefaultAsync(t => t.Timeslotid == id);
        if (timeslot == null)
            return NotFound(new { status = "Error", message = "Time slot not found", data = (object)null });
        return Ok(new { status = "Success", message = "Time slot fetched successfully", data = timeslot });
    }

    [HttpPost]
    public async Task<IActionResult> PostTimeSlot([FromBody] Timeslot timeslot)
    {
        var tenant = await _tenant.GetAsync();
        timeslot.StampBranch(tenant, timeslot.Branchid);
        _context.Timeslots.Add(timeslot);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetTimeSlot", new { id = timeslot.Timeslotid }, new { status = "Success", message = "Time slot created successfully", data = timeslot });
    }

    [HttpPost("UpdateTimeSlot")]
    public async Task<IActionResult> UpdateTimeSlot([FromBody] Timeslot timeslot)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Timeslots.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(t => t.Timeslotid == timeslot.Timeslotid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Time slot not found", data = (object)null });

        timeslot.KeepScopeOf(existing);
        _context.Entry(timeslot).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Time slot updated successfully", data = timeslot });
    }

    [HttpPost("DeleteTimeSlot/{id}")]
    public async Task<IActionResult> DeleteTimeSlot(int id)
    {
        var tenant = await _tenant.GetAsync();
        var timeslot = await _context.Timeslots.ForBranch(tenant).FirstOrDefaultAsync(t => t.Timeslotid == id);
        if (timeslot == null)
            return NotFound(new { status = "Error", message = "Time slot not found", data = (object)null });
        _context.Timeslots.Remove(timeslot);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Time slot deleted successfully", data = timeslot });
    }
}
