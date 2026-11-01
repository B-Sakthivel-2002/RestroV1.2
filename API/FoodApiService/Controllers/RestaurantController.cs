using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// Anonymous access kept as before. With a token the menu is the caller's own branch menu and the
// hotel is the caller's branch; without one it falls back to the old behaviour (first branch, all categories).
[Route("api/[controller]")]
public class RestaurantController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public RestaurantController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    [HttpGet("GetMenu")]
    public async Task<IActionResult> GetMenu()
    {
        var tenant = await _tenant.TryGetAsync();

        var branches = _context.Branches.AsQueryable();
        var categories = _context.Categories.AsQueryable();
        if (tenant != null)
        {
            int branchid = tenant.BranchId;
            branches = branches.Where(b => b.Branchid == branchid);
            categories = categories.Where(c => c.Branchid == branchid);
        }

        var hotel = await branches.OrderBy(b => b.Branchid).Select(b => new Hotel
        {
            Id = b.Branchid,
            Name = b.Branchname,
            Location = b.City,
            BranchId = b.Branchid,
            OutletId = b.Outletid
        }).FirstOrDefaultAsync();

        if (hotel == null)
            return NotFound("Hotel not found");

        var menu = await categories.Include(mc => mc.Items)
            .Where(x => x.Flag == true)
            .Select(mc => new MenuCategory
            {
                Id = mc.Categoryid,
                Name = mc.Categoryname,
                Flag = false,
                ExpressStall = mc.Expressstall,
                OrderDetail = mc.Items.Where(x => x.Active == true).Select(od => new OrderDetail
                {
                    ItemID = od.Itemid,
                    Name = od.Itemname,
                    Code = od.Code,
                    Qty = od.Qty ?? 0,
                    Price = od.Defaultprice ?? 0m
                }).ToList()
            }).ToListAsync();

        var value = new Restaurant
        {
            Hotel = new Hotel { Id = hotel.Id, Name = hotel.Name, Location = hotel.Location },
            Menu = menu,
            BranchId = hotel.BranchId,
            OutletId = hotel.OutletId
        };

        return Ok(value);
    }
}
