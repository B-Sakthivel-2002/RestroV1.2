using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Order types with Outletid NULL (1 Dine-in, 2 Takeaway, 3 Homedelivery) are shared by every outlet
// and referenced by id in the UI, so they are read-only here. Outlets may add their own types.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager,Chef,Captain")]
public class OrderTypeController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public OrderTypeController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    [HttpGet]
    public async Task<IActionResult> GetOrderTypes()
    {
        var tenant = await _tenant.GetAsync();
        return Ok(new { status = "Success", message = "Order types fetched successfully", data = await _context.Ordertypes.ForOutlet(tenant).ToListAsync() });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrderType(int id)
    {
        var tenant = await _tenant.GetAsync();
        var ordertype = await _context.Ordertypes.ForOutlet(tenant).FirstOrDefaultAsync(o => o.Ordertypeid == id);
        if (ordertype == null)
            return NotFound(new { status = "Error", message = "Order type not found", data = (object)null });
        return Ok(new { status = "Success", message = "Order type fetched successfully", data = ordertype });
    }

    [HttpPost]
    public async Task<IActionResult> PostOrderType([FromBody] Ordertype ordertype)
    {
        var tenant = await _tenant.GetAsync();
        ordertype.StampOutlet(tenant);
        _context.Ordertypes.Add(ordertype);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetOrderType", new { id = ordertype.Ordertypeid }, new { status = "Success", message = "Order type created successfully", data = ordertype });
    }

    [HttpPost("UpdateOrderType")]
    public async Task<IActionResult> UpdateOrderType([FromBody] Ordertype ordertype)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Ordertypes.AsNoTracking().ForOutlet(tenant).FirstOrDefaultAsync(o => o.Ordertypeid == ordertype.Ordertypeid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Order type not found", data = (object)null });
        if (existing.Outletid == null)
            return BadRequest(new { status = "Error", message = "This order type is shared by all outlets and cannot be changed", data = (object)null });

        ordertype.KeepScopeOf(existing);
        _context.Entry(ordertype).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Order type not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Order type updated successfully", data = ordertype });
    }

    [HttpPost("DeleteOrderType/{id}")]
    public async Task<IActionResult> DeleteOrderType(int id)
    {
        var tenant = await _tenant.GetAsync();
        var ordertype = await _context.Ordertypes.ForOutlet(tenant).FirstOrDefaultAsync(o => o.Ordertypeid == id);
        if (ordertype == null)
            return NotFound(new { status = "Error", message = "Order type not found", data = (object)null });
        if (ordertype.Outletid == null)
            return BadRequest(new { status = "Error", message = "This order type is shared by all outlets and cannot be deleted", data = (object)null });

        _context.Ordertypes.Remove(ordertype);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Order type deleted successfully", data = ordertype });
    }
}
