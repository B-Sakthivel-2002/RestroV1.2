using System.Drawing.Printing;
using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Kitchen master: each kitchen of a branch has its own KOT printer.
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Manager")]
public class KitchensController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;
    private readonly KotPrintService _kotPrint;

    public KitchensController(HotelContext context, ITenantContext tenant, KotPrintService kotPrint)
    {
        _context = context;
        _tenant = tenant;
        _kotPrint = kotPrint;
    }

    [HttpGet]
    public async Task<IActionResult> GetKitchens([FromQuery] bool allBranches = false)
    {
        var tenant = await _tenant.GetAsync();
        var list = await _context.Kitchens.ForList(tenant, allBranches)
            .OrderBy(k => k.Branchid).ThenBy(k => k.Kitchenname)
            .Select(k => new
            {
                k.Kitchenid, k.Kitchenname, k.Printername, k.Status, k.Branchid, k.Outletid,
                Items = _context.Items.Count(i => i.Kitchenid == k.Kitchenid)
            })
            .ToListAsync();
        return Ok(new { status = "Success", message = list.Any() ? "Kitchens fetched successfully" : "No kitchens found", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetKitchen(int id)
    {
        var tenant = await _tenant.GetAsync();
        var kitchen = await _context.Kitchens.ForBranch(tenant).FirstOrDefaultAsync(k => k.Kitchenid == id);
        if (kitchen == null)
            return NotFound(new { status = "Error", message = "Kitchen not found", data = (object)null });
        return Ok(new { status = "Success", message = "Kitchen fetched successfully", data = kitchen });
    }

    // Printers installed on the API computer, to pick from on the kitchen screen.
    [HttpGet("Printers")]
    public IActionResult GetPrinters()
    {
        try
        {
            var printers = PrinterSettings.InstalledPrinters.Cast<string>().OrderBy(p => p).ToList();
            return Ok(new { status = "Success", message = "Printers fetched successfully", data = printers });
        }
        catch (Exception ex)
        {
            return Ok(new { status = "Success", message = "Could not read installed printers: " + ex.Message, data = new List<string>() });
        }
    }

    [HttpPost]
    public async Task<IActionResult> PostKitchen([FromBody] Kitchen kitchen)
    {
        var tenant = await _tenant.GetAsync();
        string? invalid = Validate(kitchen);
        if (invalid != null)
            return BadRequest(new { status = "Error", message = invalid, data = (object)null });

        kitchen.StampBranch(tenant, kitchen.Branchid);
        if (await NameTaken(kitchen.Kitchenname, kitchen.Branchid, 0))
            return BadRequest(new { status = "Error", message = "A kitchen with this name already exists in the branch", data = (object)null });

        _context.Kitchens.Add(kitchen);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetKitchen", new { id = kitchen.Kitchenid }, new { status = "Success", message = "Kitchen created successfully", data = kitchen });
    }

    [HttpPost("UpdateKitchen")]
    public async Task<IActionResult> UpdateKitchen([FromBody] Kitchen kitchen)
    {
        var tenant = await _tenant.GetAsync();
        var existing = await _context.Kitchens.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(k => k.Kitchenid == kitchen.Kitchenid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Kitchen not found", data = (object)null });
        string? invalid = Validate(kitchen);
        if (invalid != null)
            return BadRequest(new { status = "Error", message = invalid, data = (object)null });

        kitchen.KeepScopeOf(existing);
        if (await NameTaken(kitchen.Kitchenname, kitchen.Branchid, kitchen.Kitchenid))
            return BadRequest(new { status = "Error", message = "A kitchen with this name already exists in the branch", data = (object)null });

        _context.Entry(kitchen).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Kitchen updated successfully", data = kitchen });
    }

    [HttpPost("DeleteKitchen/{id}")]
    public async Task<IActionResult> DeleteKitchen(int id)
    {
        var tenant = await _tenant.GetAsync();
        var kitchen = await _context.Kitchens.ForBranch(tenant).FirstOrDefaultAsync(k => k.Kitchenid == id);
        if (kitchen == null)
            return NotFound(new { status = "Error", message = "Kitchen not found", data = (object)null });

        int items = await _context.Items.CountAsync(i => i.Kitchenid == id);
        if (items > 0)
            return BadRequest(new { status = "Error", message = $"{items} menu item(s) use this kitchen. Move them to another kitchen first.", data = (object)null });

        _context.Kitchens.Remove(kitchen);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Kitchen deleted successfully", data = kitchen });
    }

    // Prints a short test ticket on the kitchen's printer.
    [HttpPost("{id}/TestPrint")]
    public async Task<IActionResult> TestPrint(int id)
    {
        var tenant = await _tenant.GetAsync();
        var kitchen = await _context.Kitchens.AsNoTracking().ForBranch(tenant).FirstOrDefaultAsync(k => k.Kitchenid == id);
        if (kitchen == null)
            return NotFound(new { status = "Error", message = "Kitchen not found", data = (object)null });

        string? error = await _kotPrint.PrintTestAsync(kitchen);
        return error == null
            ? Ok(new { status = "Success", message = $"Test ticket sent to '{kitchen.Printername}'" })
            : BadRequest(new { status = "Error", message = error });
    }

    private static string? Validate(Kitchen kitchen)
    {
        kitchen.Kitchenname = kitchen.Kitchenname?.Trim() ?? "";
        kitchen.Printername = kitchen.Printername?.Trim();
        if (kitchen.Kitchenname.Length == 0 || kitchen.Kitchenname.Length > 100)
            return "Kitchen name is required (max 100 characters)";
        if (string.IsNullOrEmpty(kitchen.Printername) || kitchen.Printername.Length > 200)
            return "Printer name is required (max 200 characters)";
        return null;
    }

    private Task<bool> NameTaken(string name, int? branchId, int exceptId)
    {
        string lower = name.ToLower();
        return _context.Kitchens.AnyAsync(k => k.Branchid == branchId && k.Kitchenid != exceptId && k.Kitchenname.ToLower() == lower);
    }
}
