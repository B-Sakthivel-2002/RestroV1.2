namespace FoodApiService.Interface;

public interface IRoleService
{
    Task<string?> GetRoleNameByRoleId(int roleId);
}
