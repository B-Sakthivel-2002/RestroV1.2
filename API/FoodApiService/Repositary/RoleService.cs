using FoodApiService.Interface;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Repositary;

public class RoleService : IRoleService
{
    private readonly HotelContext _context;

    public RoleService(HotelContext context)
    {
        _context = context;
    }

    public async Task<string?> GetRoleNameByRoleId(int role)
    {
        return await _context.Roles
            .Where(r => r.Roleid == role)
            .Select(r => r.Rolename)
            .FirstOrDefaultAsync();
    }
}
