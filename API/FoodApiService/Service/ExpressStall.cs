namespace FoodApiService.Service;

// Express Stall is switched on per branch (branch.expressstall). Its orders use the order type with this name.
public static class ExpressStall
{
    public const string OrderTypeName = "express stall";

    public static bool IsOrderType(string? name) => name?.Trim().ToLower() == OrderTypeName;
}
