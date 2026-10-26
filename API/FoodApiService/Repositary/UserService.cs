using FoodApiService.Interface;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Repositary;

public class UserService : IUserService
{
    private readonly HotelContext _context;

    public UserService(HotelContext context)
    {
        _context = context;
    }

    public async Task<int?> GetUserIdByUsername(string username)
    {
        return await _context.Users
            .Where(u => u.Username == username)
            .Select(u => u.Userid)
            .FirstOrDefaultAsync();
    }

    public async Task<int?> GetBranchIdByUser(string username)
    {
        return await _context.Users
            .Where(u => u.Username == username)
            .Select(u => u.Branchid)
            .FirstOrDefaultAsync();
    }
}
