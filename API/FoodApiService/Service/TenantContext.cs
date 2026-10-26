using System.Security.Claims;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

public static class AppRoles
{
    // Outlet owner: sees and manages every branch of their own outlet.
    public const string SuperAdmin = "SuperAdmin";

    // Branch head: sees and manages their own branch only.
    public const string Admin = "Admin";
}

public static class TenantClaims
{
    public const string UserId = "userid";
    public const string BranchId = "branchid";
    public const string OutletId = "outletid";
}

// The caller's scope, resolved from the login token (never from request bodies).
public sealed class TenantInfo
{
    public int UserId { get; init; }

    public string? Username { get; init; }

    public string? Role { get; init; }

    // The user's own branch: where their orders, bills and work periods are created.
    public int BranchId { get; init; }

    public int OutletId { get; init; }

    // Every branch the caller may see: all branches of the outlet for SuperAdmin, else just BranchId.
    public IReadOnlyList<int> BranchIds { get; init; } = Array.Empty<int>();

    public bool IsOutletOwner => Role == AppRoles.SuperAdmin;

    public bool CanSeeBranch(int? branchId) => branchId.HasValue && BranchIds.Contains(branchId.Value);

    // Branch to write a new branch-level row to: an owner may pick any branch of their outlet,
    // everyone else always writes to their own branch.
    public int ResolveBranch(int? requested) =>
        IsOutletOwner && requested.HasValue && CanSeeBranch(requested) ? requested.Value : BranchId;

    // Branches to report on: all visible ones, or one of them when a filter is given.
    public IReadOnlyList<int> BranchesFor(int? branchFilter) =>
        branchFilter is > 0 ? BranchIds.Where(b => b == branchFilter.Value).ToList() : BranchIds;

    // Used when an authenticated caller cannot be resolved: sees nothing.
    public static readonly TenantInfo None = new() { OutletId = -1, BranchId = -1 };
}

public interface ITenantContext
{
    // Null when the request has no valid token.
    Task<TenantInfo?> TryGetAsync();

    // For [Authorize] endpoints: an unresolvable caller gets TenantInfo.None (no data).
    Task<TenantInfo> GetAsync();
}

public class TenantContext : ITenantContext
{
    private readonly IHttpContextAccessor _http;
    private readonly HotelContext _context;
    private TenantInfo? _cached;
    private bool _resolved;

    public TenantContext(IHttpContextAccessor http, HotelContext context)
    {
        _http = http;
        _context = context;
    }

    public async Task<TenantInfo?> TryGetAsync()
    {
        if (!_resolved)
        {
            _cached = await ResolveAsync(_http.HttpContext?.User, _context);
            _resolved = true;
        }
        return _cached;
    }

    public async Task<TenantInfo> GetAsync() => await TryGetAsync() ?? TenantInfo.None;

    public static async Task<TenantInfo?> ResolveAsync(ClaimsPrincipal? principal, HotelContext context)
    {
        if (principal?.Identity?.IsAuthenticated != true)
            return null;

        string? username = principal.Identity.Name;
        string? role = principal.FindFirst(ClaimTypes.Role)?.Value;
        int userId = ReadInt(principal, TenantClaims.UserId);
        int branchId = ReadInt(principal, TenantClaims.BranchId);
        int outletId = ReadInt(principal, TenantClaims.OutletId);

        // Tokens issued before branch/outlet claims existed: look the user up once.
        if (userId == 0 || branchId == 0)
        {
            var user = await context.Users.AsNoTracking()
                .Where(u => u.Username == username)
                .Select(u => new { u.Userid, u.Branchid, u.Outletid })
                .FirstOrDefaultAsync();
            if (user == null)
                return null;

            userId = user.Userid;
            branchId = user.Branchid.GetValueOrDefault();
            outletId = user.Outletid.GetValueOrDefault();
        }

        if (outletId == 0 && branchId > 0)
        {
            outletId = (await context.Branches.AsNoTracking()
                .Where(b => b.Branchid == branchId)
                .Select(b => b.Outletid)
                .FirstOrDefaultAsync()).GetValueOrDefault();
        }

        IReadOnlyList<int> branchIds;
        if (role == AppRoles.SuperAdmin && outletId > 0)
        {
            branchIds = await context.Branches.AsNoTracking()
                .Where(b => b.Outletid == outletId)
                .Select(b => b.Branchid)
                .ToListAsync();
        }
        else
        {
            branchIds = branchId > 0 ? new[] { branchId } : Array.Empty<int>();
        }

        return new TenantInfo
        {
            UserId = userId,
            Username = username,
            Role = role,
            BranchId = branchId,
            OutletId = outletId,
            BranchIds = branchIds
        };
    }

    private static int ReadInt(ClaimsPrincipal principal, string type) =>
        int.TryParse(principal.FindFirst(type)?.Value, out int value) ? value : 0;
}

public static class TenantQueryExtensions
{
    // Outlet-level read: rows of the caller's outlet plus global rows (Outletid NULL).
    public static IQueryable<T> ForOutlet<T>(this IQueryable<T> query, TenantInfo tenant) where T : class, IOutletScoped
    {
        int outletId = tenant.OutletId;
        return query.Where(x => x.Outletid == null || x.Outletid == outletId);
    }

    // Outlet-level write: only rows the caller's outlet owns (global rows are read-only).
    public static IQueryable<T> OwnedByOutlet<T>(this IQueryable<T> query, TenantInfo tenant) where T : class, IOutletScoped
    {
        int outletId = tenant.OutletId;
        return query.Where(x => x.Outletid == outletId);
    }

    // Branch-level read/write: rows of the branches the caller may see.
    public static IQueryable<T> ForBranch<T>(this IQueryable<T> query, TenantInfo tenant, int? branchFilter = null) where T : class, IBranchScoped
    {
        var branchIds = tenant.BranchesFor(branchFilter);
        return query.Where(x => x.Branchid != null && branchIds.Contains(x.Branchid.Value));
    }

    // Master lists (menu, tax, discounts, ...): the caller's own branch by default, which is what the
    // order screen needs. An owner's master screens pass allBranches=true to see every outlet branch.
    public static IQueryable<T> ForList<T>(this IQueryable<T> query, TenantInfo tenant, bool allBranches) where T : class, IBranchScoped
        => query.ForBranch(tenant, allBranches ? null : tenant.BranchId);

    public static void StampOutlet(this IOutletScoped entity, TenantInfo tenant)
    {
        entity.Outletid = tenant.OutletId;
        entity.Branchid = tenant.BranchId;
    }

    // New branch-level row: the caller's branch, or (for an outlet owner) the requested branch of their outlet.
    public static void StampBranch(this IBranchScoped entity, TenantInfo tenant, int? requestedBranch = null)
    {
        entity.Branchid = tenant.ResolveBranch(requestedBranch);
        entity.Outletid = tenant.OutletId;
    }

    // Keeps the stored scope on update so a client cannot move a row to another outlet/branch.
    public static void KeepScopeOf(this ITenantScoped incoming, ITenantScoped existing)
    {
        incoming.Outletid = existing.Outletid;
        incoming.Branchid = existing.Branchid;
    }
}
