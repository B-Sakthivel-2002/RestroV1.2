namespace FoodApiService.Interface;

public interface IUserRoleService
{
    Task<int?> GetRoleIdByUserId(int userId);
}
