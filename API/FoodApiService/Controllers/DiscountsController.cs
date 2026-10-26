using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager,Captain")]
public class DiscountsController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public DiscountsController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    [HttpGet]
    public async Task<IActionResult> GetDiscounts([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Discounts.ForList(tenant, allBranches).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No discounts found", data = (object)null });
        return Ok(new { status = "Success", message = "Discounts fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDiscount(int id)
    {
        var tenant = await _tenant.GetAsync();
        var discount = await _context.Discounts.ForBranch(tenant).FirstOrDefaultAsync(d => d.Discountid == id);
        if (discount == null)
            return NotFound(new { status = "Error", message = "Discount not found", data = (object)null });
        return Ok(new { status = "Success", message = "Discount fetched successfully", data = discount });
    }

    [HttpPost]
    public async Task<IActionResult> PostDiscount([FromBody] Discount discount)
    {
        var tenant = await _tenant.GetAsync();
        discount.StampBranch(tenant, discount.Branchid);
        _context.Discounts.Add(discount);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Discount created successfully", data = discount });
    }

    [HttpPost("UpdateDiscount")]
    public async Task<IActionResult> UpdateDiscount([FromBody] Discount discount)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Discounts.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(d => d.Discountid == discount.Discountid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Discount not found", data = (object)null });

        discount.KeepScopeOf(existing);
        _context.Entry(discount).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Discount not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Discount updated successfully", data = discount });
    }

    [HttpPost("DeleteDiscount/{id}")]
    public async Task<IActionResult> DeleteDiscount(int id)
    {
        var tenant = await _tenant.GetAsync();
        var discount = await _context.Discounts.ForBranch(tenant).FirstOrDefaultAsync(d => d.Discountid == id);
        if (discount == null)
            return NotFound(new { status = "Error", message = "Discount not found", data = (object)null });
        _context.Discounts.Remove(discount);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Discount deleted successfully", data = discount });
    }
}
