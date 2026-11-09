using FoodApiService.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// One-way password storage: ASP.NET Core's PasswordHasher (PBKDF2 with a random salt per password).
// The stored value starts with Prefix, which is how a hash is told apart from an old plain-text value.
public static class PasswordSecurity
{
    private const string Prefix = "$pbkdf2$";

    private static readonly PasswordHasher<User> Hasher = new();

    // Checked when the username is unknown, so a login takes the same time either way.
    private static readonly string UnknownUserHash = Hash(Guid.NewGuid().ToString());

    public static string Hash(string password) => Prefix + Hasher.HashPassword(null!, password);

    // storedHash null = no such user: does the same work and returns false.
    public static bool Verify(string? storedHash, string? password)
    {
        string hash = storedHash ?? UnknownUserHash;
        if (string.IsNullOrEmpty(password) || !hash.StartsWith(Prefix, StringComparison.Ordinal))
            return false;
        try
        {
            return Hasher.VerifyHashedPassword(null!, hash[Prefix.Length..], password) != PasswordVerificationResult.Failed
                && storedHash != null;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    // Runs at API start: hashes every password still in plain text. Rows already hashed are skipped.
    public static async Task HashStoredPasswordsAsync(HotelContext context, ILogger logger)
    {
        try
        {
            var users = await context.Users.Where(u => !u.Password.StartsWith(Prefix)).ToListAsync();
            foreach (var user in users)
                user.Password = Hash(user.Password);
            if (users.Count > 0)
            {
                await context.SaveChangesAsync();
                logger.LogInformation("Hashed {Count} password(s) that were stored in plain text", users.Count);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not hash stored passwords; those users cannot log in until the API restarts successfully");
        }
    }
}
