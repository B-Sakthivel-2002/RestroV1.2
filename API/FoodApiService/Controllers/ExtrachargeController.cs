using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// No [Authorize] (kept as before): callers with a token are scoped to their outlet,
// anonymous callers keep the old unscoped behaviour.
[Route("api/[controller]")]
public class ExtrachargeController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public ExtrachargeController(HotelContext context, ITenantContext tenant) { _context = context; _tenant = tenant; }

    // Own branch only unless allBranches (an owner's master screen); anonymous callers: unscoped, as before.
    private async Task<IQueryable<Extracharge>> Visible(bool allBranches = true)
    {
        var tenant = await _tenant.TryGetAsync();
        return tenant == null ? _context.Extracharges : _context.Extracharges.ForList(tenant, allBranches);
    }

    private async Task<IQueryable<Extracharge>> Writable()
    {
        var tenant = await _tenant.TryGetAsync();
        return tenant == null ? _context.Extracharges : _context.Extracharges.ForBranch(tenant);
    }

    [HttpGet]
    public async Task<IActionResult> GetExtracharges([FromQuery] bool allBranches = false)
    {
        var list = await (from e in await Visible(allBranches)
            join ot in _context.Ordertypes on e.Ordertypeid equals ot.Ordertypeid into orderTypes
            from ot in orderTypes.DefaultIfEmpty()
            select new
            {
                e.Extrachargeid, e.Extrachargename, e.Extrachargetype,
                e.Extrachargerate, e.Extrachargefrom, e.Extrachargeto,
                e.Extrachargestatus, e.Ordertypeid,
                Ordertypename = ot != null ? ot.Ordertypename : null,
                e.Outletid, e.Branchid
            }).ToListAsync();

        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No extracharges found", data = (object)null });
        return Ok(new { status = "Success", message = "Extracharges fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetExtracharge(int id)
    {
        var extracharge = await (await Visible()).FirstOrDefaultAsync(e => e.Extrachargeid == id);
        if (extracharge == null)
            return NotFound(new { status = "Error", message = "Extracharges not found", data = (object)null });
        return Ok(new { status = "Success", message = "Extracharges fetched successfully", data = extracharge });
    }

    [HttpPost]
    public async Task<IActionResult> PostExtracharge([FromBody] Extracharge extracharge)
    {
        var tenant = await _tenant.TryGetAsync();
        if (tenant != null)
            extracharge.StampBranch(tenant, extracharge.Branchid);
        _context.Extracharges.Add(extracharge);
        await _context.SaveChangesAsync();
        return CreatedAtAction("GetExtracharge", new { id = extracharge.Extrachargeid }, new { status = "Success", message = "Extracharges created successfully", data = extracharge });
    }

    [HttpPost("UpdateExtracharge")]
    public async Task<IActionResult> UpdateExtracharge([FromBody] Extracharge extracharge)
    {
        var existing = await (await Writable()).AsNoTracking().FirstOrDefaultAsync(e => e.Extrachargeid == extracharge.Extrachargeid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Extracharge not found", data = (object)null });

        if (await _tenant.TryGetAsync() != null)
            extracharge.KeepScopeOf(existing);
        _context.Entry(extracharge).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Extracharge updated successfully", data = extracharge });
    }

    [HttpPost("DeleteExtracharges/{id}")]
    public async Task<IActionResult> DeleteExtracharges(int id)
    {
        var extracharge = await (await Writable()).FirstOrDefaultAsync(e => e.Extrachargeid == id);
        if (extracharge == null)
            return NotFound(new { status = "Error", message = "Extracharge not found", data = (object)null });
        _context.Extracharges.Remove(extracharge);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Extracharge deleted successfully" });
    }
}
