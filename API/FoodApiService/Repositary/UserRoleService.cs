using FoodApiService.Interface;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Repositary;

public class UserRoleService : IUserRoleService
{
    private readonly HotelContext _context;

    public UserRoleService(HotelContext context)
    {
        _context = context;
    }

    public async Task<int?> GetRoleIdByUserId(int userId)
    {
        return await _context.Userroles
            .Where(ur => ur.Userid == userId)
            .Select(ur => ur.Roleid)
            .FirstOrDefaultAsync();
    }
}
