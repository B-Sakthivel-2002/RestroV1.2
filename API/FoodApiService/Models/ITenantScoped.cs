namespace FoodApiService.Models;

public interface ITenantScoped
{
    int? Branchid { get; set; }

    int? Outletid { get; set; }
}

// Shared by every branch of one outlet (menu, tax, discounts, ...). Outletid NULL = global row.
public interface IOutletScoped : ITenantScoped
{
}

// Belongs to exactly one branch (orders, bills, tables, users, ...).
public interface IBranchScoped : ITenantScoped
{
}
