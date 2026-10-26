using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class ItemsController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public ItemsController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    [HttpGet]
    public async Task<IActionResult> GetItems([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Items.ForList(tenant, allBranches).Include(i => i.Category).Select(i => new
        {
            Itemid = i.Itemid,
            Categoryid = i.Categoryid,
            Categoryname = i.Category != null ? i.Category.Categoryname : null,
            Itemname = i.Itemname,
            Description = i.Description,
            Defaultprice = i.Defaultprice,
            Qty = i.Qty,
            Code = i.Code,
            Outletid = i.Outletid,
            Branchid = i.Branchid,
            Active = i.Active,
            Kitchenid = i.Kitchenid,
            Kitchenname = _context.Kitchens.Where(k => k.Kitchenid == i.Kitchenid).Select(k => k.Kitchenname).FirstOrDefault()
        }).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No items found", data = (object)null });

        return Ok(new { status = "Success", message = "Items fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetItem(int id)
    {
        var tenant = await _tenant.GetAsync();
        var item = await _context.Items.ForBranch(tenant).FirstOrDefaultAsync(i => i.Itemid == id);
        if (item == null)
            return NotFound(new { status = "Error", message = "Item not found", data = (object)null });

        return Ok(new { status = "Success", message = "Item fetched successfully", data = item });
    }

    [HttpPost]
    public async Task<IActionResult> PostItem([FromBody] Item item)
    {
        var tenant = await _tenant.GetAsync();
        int branchId = tenant.ResolveBranch(item.Branchid);
        if (!await _context.Categories.AnyAsync(c => c.Categoryid == item.Categoryid && c.Branchid == branchId))
            return BadRequest(new { status = "Error", message = "Category not found", data = (object)null });
        string? kitchenError = await KitchenProblem(item.Kitchenid, branchId);
        if (kitchenError != null)
            return BadRequest(new { status = "Error", message = kitchenError, data = (object)null });

        var data = new Item
        {
            Itemname = item.Itemname,
            Categoryid = item.Categoryid,
            Description = item.Description,
            Code = item.Code,
            Qty = item.Qty,
            Defaultprice = item.Defaultprice,
            Kitchenid = item.Kitchenid
        };
        data.StampBranch(tenant, item.Branchid);
        await _context.Items.AddAsync(data);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetItem", new { id = data.Itemid }, new { status = "Success", message = "Item created successfully", data });
    }

    [HttpPost("UpdateItem")]
    public async Task<IActionResult> UpdateItem([FromBody] Item item)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Items.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(i => i.Itemid == item.Itemid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Item not found", data = (object)null });
        if (!await _context.Categories.AnyAsync(c => c.Categoryid == item.Categoryid && c.Branchid == existing.Branchid))
            return BadRequest(new { status = "Error", message = "Category not found", data = (object)null });
        string? kitchenError = await KitchenProblem(item.Kitchenid, existing.Branchid.GetValueOrDefault());
        if (kitchenError != null)
            return BadRequest(new { status = "Error", message = kitchenError, data = (object)null });

        item.KeepScopeOf(existing);
        _context.Entry(item).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Item not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Item updated successfully", data = item });
    }

    [HttpPost("DeleteItem/{id}")]
    public async Task<IActionResult> DeleteItem(int id)
    {
        var tenant = await _tenant.GetAsync();
        var item = await _context.Items.ForBranch(tenant).FirstOrDefaultAsync(i => i.Itemid == id);
        if (item == null)
            return NotFound(new { status = "Error", message = "Item not found", data = (object)null });

        _context.Items.Remove(item);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Item deleted successfully", data = item });
    }

    // Every saved item must name an active kitchen of its own branch (its KOT prints there).
    private async Task<string?> KitchenProblem(int? kitchenId, int branchId)
    {
        if (kitchenId is not > 0)
            return "Kitchen is required";
        var kitchen = await _context.Kitchens.AsNoTracking().FirstOrDefaultAsync(k => k.Kitchenid == kitchenId && k.Branchid == branchId);
        if (kitchen == null)
            return "Kitchen not found in this branch";
        if (!kitchen.Status)
            return $"Kitchen '{kitchen.Kitchenname}' is inactive";
        return null;
    }
}
