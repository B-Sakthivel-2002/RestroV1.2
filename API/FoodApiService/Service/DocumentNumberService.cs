using FoodApiService.Models;
using Microsoft.EntityFrameworkCore;

namespace FoodApiService.Service;

// Generates order/bill numbers like ORD-A2BCHN-20260927-001, unique per branch and business day.
// The counter row is incremented with a single upsert, so concurrent requests never get the same value.
public class DocumentNumberService
{
    public const string Order = "ORD";
    public const string Bill = "BILL";
    public const string Token = "TOKEN";

    private readonly HotelContext _context;

    public DocumentNumberService(HotelContext context)
    {
        _context = context;
    }

    public async Task<string> NextAsync(string docType, int branchId, DateTime businessDate)
    {
        var bizdate = DateOnly.FromDateTime(businessDate);
        int value = await NextValueAsync(docType, branchId, bizdate);

        string? code = await _context.Branches.AsNoTracking()
            .Where(b => b.Branchid == branchId)
            .Select(b => b.Code)
            .FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(code))
            code = "B" + branchId;

        return $"{docType}-{code.ToUpperInvariant()}-{bizdate:yyyyMMdd}-{value:D3}";
    }

    // The next counter value (1, 2, ...) for the branch, document type and business day.
    public async Task<int> NextValueAsync(string docType, int branchId, DateOnly bizdate)
    {
        // Not composable (INSERT ... RETURNING), so materialise with ToListAsync rather than First/Single.
        var values = await _context.Database.SqlQuery<int>($@"
            INSERT INTO doc_sequence (branchid, doctype, bizdate, lastvalue)
            VALUES ({branchId}, {docType}, {bizdate}, 1)
            ON CONFLICT (branchid, doctype, bizdate)
            DO UPDATE SET lastvalue = doc_sequence.lastvalue + 1
            RETURNING lastvalue AS ""Value""").ToListAsync();
        return values[0];
    }
}
