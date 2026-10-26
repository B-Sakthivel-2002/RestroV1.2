using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager,Captain")]
public class TaxController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public TaxController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    // The order screen applies every tax returned here, so by default only the caller's own branch taxes
    // are returned. The tax master screen passes allBranches=true (an owner then sees every outlet branch).
    [HttpGet]
    public async Task<IActionResult> GetTaxes([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Taxes.ForList(tenant, allBranches).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No taxes found", data = (object)null });
        return Ok(new { status = "Success", message = "Taxes fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTax(int id)
    {
        var tenant = await _tenant.GetAsync();
        var tax = await _context.Taxes.ForBranch(tenant).FirstOrDefaultAsync(t => t.Taxid == id);
        if (tax == null)
            return NotFound(new { status = "Error", message = "Tax not found", data = (object)null });
        return Ok(new { status = "Success", message = "Tax fetched successfully", data = tax });
    }

    [HttpPost]
    public async Task<IActionResult> PostTax([FromBody] Tax tax)
    {
        var tenant = await _tenant.GetAsync();
        tax.StampBranch(tenant, tax.Branchid);
        _context.Taxes.Add(tax);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetTax", new { id = tax.Taxid }, new { status = "Success", message = "Tax created successfully", data = tax });
    }

    [HttpPost("UpdateTax")]
    public async Task<IActionResult> UpdateTax([FromBody] Tax tax)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Taxes.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(t => t.Taxid == tax.Taxid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Tax not found", data = (object)null });

        tax.KeepScopeOf(existing);
        _context.Entry(tax).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Tax updated successfully", data = tax });
    }

    [HttpPost("DeleteTax/{id}")]
    public async Task<IActionResult> DeleteTax(int id)
    {
        var tenant = await _tenant.GetAsync();
        var tax = await _context.Taxes.ForBranch(tenant).FirstOrDefaultAsync(t => t.Taxid == id);
        if (tax == null)
            return NotFound(new { status = "Error", message = "Tax not found", data = (object)null });
        _context.Taxes.Remove(tax);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Tax deleted successfully" });
    }
}
