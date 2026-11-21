using System.Collections.Concurrent;
using System.Security.Claims;
using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// "Log out all devices" per branch. Every login token carries when it was issued (iat); a token of a
// branch issued before that branch's last "log out all" is refused (401), so each device lands on the
// login screen at its next call. Open screens are told at once over the hub ("ForceLogout").
// The times are cached here (one API per branch server), so checking a request costs no DB call.
public class SessionRevocation
{
    public const string ForceLogoutEvent = "ForceLogout";

    private const string CreateTableSql = @"
CREATE TABLE IF NOT EXISTS branch_session (
    branchid  integer PRIMARY KEY,
    revokedat timestamp without time zone NOT NULL,
    revokedby integer
);";

    private readonly IServiceScopeFactory _scopes;
    private readonly ConcurrentDictionary<int, DateTime> _revokedAt = new();
    private volatile bool _loaded;
    private readonly SemaphoreSlim _loadLock = new(1, 1);

    public SessionRevocation(IServiceScopeFactory scopes)
    {
        _scopes = scopes;
    }

    // Creates the table on an older database (same SQL as the Database/*.sql scripts).
    public static Task EnsureTableAsync(HotelContext context) => context.Database.ExecuteSqlRawAsync(CreateTableSql);

    // True when the token belongs to a branch whose devices were logged out after the token was issued.
    public async Task<bool> IsRevokedAsync(ClaimsPrincipal? principal)
    {
        if (principal == null || !int.TryParse(principal.FindFirst(TenantClaims.BranchId)?.Value, out int branchId))
            return false;

        await EnsureLoadedAsync();
        if (!_revokedAt.TryGetValue(branchId, out DateTime revokedAt))
            return false;

        // Tokens from before this feature carry no issue time: they are older than any revoke.
        if (!long.TryParse(principal.FindFirst("iat")?.Value, out long iat))
            return true;
        DateTime issuedAt = DateTimeOffset.FromUnixTimeSeconds(iat).UtcDateTime;
        return issuedAt < TruncateToSeconds(revokedAt);
    }

    // Ends every login of the branch made before now.
    public async Task RevokeAsync(int branchId, int userId)
    {
        DateTime now = DateTime.SpecifyKind(TruncateToSeconds(DateTime.UtcNow), DateTimeKind.Unspecified);
        using (var scope = _scopes.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<HotelContext>();
            var row = await context.BranchSessions.FirstOrDefaultAsync(s => s.Branchid == branchId);
            if (row == null)
                context.BranchSessions.Add(new BranchSession { Branchid = branchId, Revokedat = now, Revokedby = userId });
            else
            {
                row.Revokedat = now;
                row.Revokedby = userId;
            }
            await context.SaveChangesAsync();
        }
        _revokedAt[branchId] = now;
    }

    private async Task EnsureLoadedAsync()
    {
        if (_loaded) return;
        await _loadLock.WaitAsync();
        try
        {
            if (_loaded) return;
            using var scope = _scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<HotelContext>();
            foreach (var row in await context.BranchSessions.AsNoTracking().ToListAsync())
                _revokedAt[row.Branchid] = row.Revokedat;
            _loaded = true;
        }
        finally
        {
            _loadLock.Release();
        }
    }

    // A login made in the same second right after the revoke must still work.
    private static DateTime TruncateToSeconds(DateTime value) => value.AddTicks(-(value.Ticks % TimeSpan.TicksPerSecond));
}
