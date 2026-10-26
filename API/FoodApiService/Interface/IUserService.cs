namespace FoodApiService.Interface;

public interface IUserService
{
    Task<int?> GetUserIdByUsername(string username);

    Task<int?> GetBranchIdByUser(string username);
}
