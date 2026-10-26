using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Kitchen Staff,Waiter,Cashier,Manager,Admin,SuperAdmin")]
public class WorkPeriodController : Controller
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public WorkPeriodController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    // Owners see the work periods of every branch in their outlet; everyone else their own branch.
    [HttpGet]
    public async Task<IActionResult> GetWorkPeriods()
    {
        var tenant = await _tenant.GetAsync();

        var source = _context.Workperiods.ForBranch(tenant)
            .OrderByDescending(w => w.Id)
            .Select(p => new { p.Id, p.Date, p.Openedat, p.Closedat, p.Status, p.Branchid, p.Openedby, p.Closedby });

        var list = await source.ToListAsync();
        if (!list.Any())
            return Ok(new { status = "Success", message = "No work periods found", data = (object)null });

        var periods = new List<WorkperiodDTO>();
        foreach (var item in list)
        {
            var dto = new WorkperiodDTO
            {
                Id = item.Id,
                Date = item.Date,
                Openedat = item.Openedat,
                Closedat = item.Closedat,
                Status = item.Status,
                Branchid = item.Branchid
            };
            dto.Openedby = await _context.Users.Where(u => u.Userid == item.Openedby).Select(u => u.Username).FirstOrDefaultAsync();
            dto.Closedby = await _context.Users.Where(u => u.Userid == item.Closedby).Select(u => u.Username).FirstOrDefaultAsync();
            dto.Branch = await _context.Branches.Where(b => b.Branchid == item.Branchid).Select(b => b.Branchname).FirstOrDefaultAsync();
            dto.PendingOrdersCount = await _context.Orders.CountAsync(o => o.Timedate >= item.Openedat && o.Timedate < (item.Closedat ?? DateTime.Now) && o.Status == "submitted" && o.Branchid == item.Branchid);
            dto.PrintedOrdersCount = await _context.Orders.CountAsync(o => o.Timedate >= item.Openedat && o.Timedate < (item.Closedat ?? DateTime.Now) && o.Status == "printed" && o.Branchid == item.Branchid);
            dto.CompletedOrdersCount = await _context.Orders.CountAsync(o => o.Timedate >= item.Openedat && o.Timedate < (item.Closedat ?? DateTime.Now) && o.Status == "approved" && o.Branchid == item.Branchid);
            periods.Add(dto);
        }

        return Ok(new { status = "Success", message = "Work periods fetched successfully", data = periods });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetWorkPeriod(int id)
    {
        var tenant = await _tenant.GetAsync();
        var workperiod = await _context.Workperiods.ForBranch(tenant).FirstOrDefaultAsync(w => w.Id == id);
        if (workperiod == null)
            return NotFound(new { status = "Error", message = "Work period not found", data = (object)null });

        return Ok(new { status = "Success", message = "Work period fetched successfully", data = workperiod });
    }

    // Opens the day for the caller's own branch (an owner may pass ?branchId= for another branch of their outlet).
    [HttpPost("Open")]
    public async Task<IActionResult> OpenWorkPeriod([FromQuery] int? branchId = null)
    {
        var tenant = await _tenant.GetAsync();
        int branchid = tenant.ResolveBranch(branchId);

        if (_context.Workperiods.Where(p => p.Branchid == branchid).Any(w => w.Status == "open"))
            return BadRequest(new { status = "Error", message = "A work period is already open", data = (object)null });

        var wp = new Workperiod
        {
            Date = DateOnly.FromDateTime(DateTime.Now),
            Openedat = DateTime.Now,
            Status = "open",
            Openedby = tenant.UserId,
            Branchid = branchid,
            Outletid = tenant.OutletId
        };
        await _context.Workperiods.AddAsync(wp);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Work period opened", data = wp });
    }

    [HttpPost("Close/{id}")]
    public async Task<IActionResult> CloseWorkperiods(int id)
    {
        var tenant = await _tenant.GetAsync();

        var wp = await _context.Workperiods.ForBranch(tenant).Where(p => p.Id == id).FirstOrDefaultAsync();
        if (wp == null)
            return NotFound(new { status = "Error", message = "Work period not found", data = (object)null });

        if (wp.Status == "closed")
            return BadRequest(new { status = "Error", message = "Work period already closed", data = (object)null });

        // Pending orders of this work period's branch only.
        if (await _context.Orders.CountAsync(o => o.Timedate >= wp.Openedat && o.Branchid == wp.Branchid && o.Status == "submitted") > 0)
            return BadRequest(new { status = "Error", message = "You can't close the period while an order is pending", data = (object)null });

        wp.Status = "closed";
        wp.Closedat = DateTime.Now;
        wp.Closedby = tenant.UserId;
        _context.Workperiods.Update(wp);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Work period closed successfully", data = wp });
    }
}
