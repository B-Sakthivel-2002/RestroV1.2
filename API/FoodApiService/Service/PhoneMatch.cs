using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// One customer = one phone number. Numbers are compared on their digits only, so
// "+91 98765-43210" and "9876543210" match (last 10 digits when both have that many).
public static class PhoneMatch
{
    public const int MinDigits = 6;

    public static string Digits(string? phone) =>
        new string((phone ?? "").Where(char.IsDigit).ToArray());

    public static bool Same(string? a, string? b)
    {
        string x = Digits(a), y = Digits(b);
        if (x.Length < MinDigits || y.Length < MinDigits)
            return false;
        if (x.Length >= 10 && y.Length >= 10)
            return x[^10..] == y[^10..];
        return x == y;
    }

    // Customers of the given (already scoped) query whose number matches phone.
    public static async Task<List<Customer>> FindAsync(IQueryable<Customer> customers, string? phone)
    {
        if (Digits(phone).Length < MinDigits)
            return new List<Customer>();
        var withPhone = await customers.AsNoTracking()
            .Where(c => c.Contactnumber != null && c.Contactnumber != "")
            .ToListAsync();
        return withPhone.Where(c => Same(c.Contactnumber, phone)).OrderBy(c => c.Customerid).ToList();
    }
}
