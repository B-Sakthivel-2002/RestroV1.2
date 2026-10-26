using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class WaiterController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public WaiterController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    [HttpGet]
    public async Task<IActionResult> GetWaiters()
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Waiters.ForBranch(tenant).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No waiters found", data = (object)null });

        return Ok(new { status = "Success", message = "Waiters fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetWaiter(int id)
    {
        var tenant = await _tenant.GetAsync();
        var waiter = await _context.Waiters.ForBranch(tenant).FirstOrDefaultAsync(w => w.Waiterid == id);
        if (waiter == null)
            return NotFound(new { status = "Error", message = "Waiter not found", data = (object)null });

        return Ok(new { status = "Success", message = "Waiter fetched successfully", data = waiter });
    }

    [HttpPost]
    public async Task<IActionResult> PostWaiter([FromBody] Waiter waiter)
    {
        var tenant = await _tenant.GetAsync();
        var data = new Waiter
        {
            Waitername = waiter.Waitername,
            Contactnumber = waiter.Contactnumber,
            Shift = waiter.Shift,
            Datejoined = waiter.Datejoined,
            Status = waiter.Status
        };
        data.StampBranch(tenant, waiter.Branchid);
        await _context.Waiters.AddAsync(data);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetWaiter", new { id = data.Waiterid }, new { status = "Success", message = "Waiter created successfully", data });
    }

    [HttpPost("UpdateWaiter")]
    public async Task<IActionResult> UpdateWaiter([FromBody] Waiter waiter)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Waiters.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(w => w.Waiterid == waiter.Waiterid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Waiter not found", data = (object)null });

        waiter.KeepScopeOf(existing);
        _context.Entry(waiter).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Waiter updated successfully", data = waiter });
    }

    [HttpPost("DeleteWaiter/{id}")]
    public async Task<IActionResult> DeleteWaiter(int id)
    {
        var tenant = await _tenant.GetAsync();
        var waiter = await _context.Waiters.ForBranch(tenant).FirstOrDefaultAsync(w => w.Waiterid == id);
        if (waiter == null)
            return NotFound(new { status = "Error", message = "Waiter not found", data = (object)null });

        _context.Waiters.Remove(waiter);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Waiter deleted successfully", data = waiter });
    }
}
