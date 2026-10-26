using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class CategoriesController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public CategoriesController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    [HttpGet]
    public async Task<IActionResult> GetCategories([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Categories.ForList(tenant, allBranches).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No categories found", data = (object)null });

        return Ok(new { status = "Success", message = "Categories fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCategory(int id)
    {
        var tenant = await _tenant.GetAsync();
        var category = await _context.Categories.ForBranch(tenant).FirstOrDefaultAsync(c => c.Categoryid == id);
        if (category == null)
            return NotFound(new { status = "Error", message = "Category not found", data = (object)null });

        return Ok(new { status = "Success", message = "Category fetched successfully", data = category });
    }

    [HttpPost]
    public async Task<IActionResult> PostCategory([FromBody] Category category)
    {
        var tenant = await _tenant.GetAsync();
        var cat = new Category
        {
            Categoryname = category.Categoryname,
            Flag = false
        };
        cat.StampBranch(tenant, category.Branchid);
        await _context.Categories.AddAsync(cat);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Category created successfully", data = cat });
    }

    [HttpPost("UpdateCategory")]
    public async Task<IActionResult> UpdateCategory([FromBody] Category category)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Categories.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(c => c.Categoryid == category.Categoryid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Category not found", data = (object)null });

        category.KeepScopeOf(existing);
        _context.Entry(category).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Category not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Category updated successfully", data = category });
    }

    [HttpPost("DeleteCategory/{id}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var tenant = await _tenant.GetAsync();
        var category = await _context.Categories.ForBranch(tenant).FirstOrDefaultAsync(c => c.Categoryid == id);
        if (category == null)
            return NotFound(new { status = "Error", message = "Category not found", data = (object)null });

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Category deleted successfully", data = category });
    }
}
