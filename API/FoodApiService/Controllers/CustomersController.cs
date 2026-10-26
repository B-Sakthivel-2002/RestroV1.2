using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Controllers;

// No [Authorize] (kept as before): callers with a token are scoped to their outlet,
// anonymous callers keep the old unscoped behaviour.
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly HotelContext _context;
    private readonly ITenantContext _tenant;

    public CustomersController(HotelContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    // Own branch only unless allBranches (an owner's master screen); anonymous callers: unscoped, as before.
    private async Task<IQueryable<Customer>> Visible(bool allBranches = true)
    {
        var tenant = await _tenant.TryGetAsync();
        return tenant == null ? _context.Customers : _context.Customers.ForList(tenant, allBranches);
    }

    private async Task<IQueryable<Customer>> Writable()
    {
        var tenant = await _tenant.TryGetAsync();
        return tenant == null ? _context.Customers : _context.Customers.ForBranch(tenant);
    }

    [HttpGet]
    public async Task<IActionResult> GetCustomers([FromQuery] bool allBranches = false)
    {
        var list = await (await Visible(allBranches)).ToListAsync();
        if (list == null || !list.Any())
            return Ok(new { status = "Success", message = "No customers found", data = (object)null });

        return Ok(new { status = "Success", message = "Customers fetched successfully", data = list });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCustomer(int id)
    {
        var customer = await (await Visible()).FirstOrDefaultAsync(c => c.Customerid == id);
        if (customer == null)
            return NotFound(new { status = "Error", message = "Customer not found", data = (object)null });

        return Ok(new { status = "Success", message = "Customer fetched successfully", data = customer });
    }

    [HttpPost]
    public async Task<IActionResult> PostCustomer([FromBody] Customer customer)
    {
        var tenant = await _tenant.TryGetAsync();
        if (tenant != null)
            customer.StampBranch(tenant, customer.Branchid);
        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Customer created successfully", data = customer });
    }

    [HttpPost("UpdateCustomer")]
    public async Task<IActionResult> UpdateCustomer([FromBody] Customer customer)
    {
        var existing = await (await Writable()).AsNoTracking().FirstOrDefaultAsync(c => c.Customerid == customer.Customerid);
        if (existing == null)
            return NotFound(new { status = "Error", message = "Customer not found", data = (object)null });

        if (await _tenant.TryGetAsync() != null)
            customer.KeepScopeOf(existing);
        _context.Entry(customer).State = EntityState.Modified;
        try { await _context.SaveChangesAsync(); }
        catch { return NotFound(new { status = "Error", message = "Customer not found", data = (object)null }); }
        return Ok(new { status = "Success", message = "Customer updated successfully", data = customer });
    }

    [HttpPost("DeleteCustomer/{id}")]
    public async Task<IActionResult> DeleteCustomer(int id)
    {
        var customer = await (await Writable()).FirstOrDefaultAsync(c => c.Customerid == id);
        if (customer == null)
            return NotFound(new { status = "Error", message = "Customer not found", data = (object)null });

        _context.Customers.Remove(customer);
        await _context.SaveChangesAsync();
        return Ok(new { status = "Success", message = "Customer deleted successfully", data = customer });
    }
}
