using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FoodApiService.Models;
using FoodApiService.Service;
using FoodApiService.Service.Sync;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FoodApiService.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SyncController : ControllerBase
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly SyncSettings _settings;

    public SyncController(SyncSettings settings) => _settings = settings;

    // What this server is (Standalone / Branch / Cloud). The UI uses it to show only the reports online.
    [HttpGet("Mode")]
    [AllowAnonymous]
    public IActionResult Mode() =>
        Ok(new { status = "Success", data = new { mode = _settings.ModeName, readOnly = _settings.IsCloud } });

    // Online server: one batch from a branch server (see SyncUploader). Authenticated by the branch's key.
    [HttpPost("Ingest")]
    [AllowAnonymous]
    [RequestSizeLimit(64 * 1024 * 1024)]
    public async Task<IActionResult> Ingest([FromServices] SyncIngest ingest, CancellationToken ct)
    {
        if (!_settings.IsCloud)
            return NotFound(new { status = "Error", message = "This server is not the online server (Sync:Mode is not Cloud)" });

        if (!int.TryParse(Request.Headers[SyncHeaders.Branch], out int branch) || !KeyMatches(branch, Request.Headers[SyncHeaders.Key]))
            return Unauthorized(new { status = "Error", message = "Unknown branch or upload key" });

        SyncBatch? batch;
        try
        {
            Stream body = Request.Body;
            if (Request.Headers.ContentEncoding.ToString().Contains("gzip", StringComparison.OrdinalIgnoreCase))
                body = new GZipStream(body, CompressionMode.Decompress);
            batch = await JsonSerializer.DeserializeAsync<SyncBatch>(body, Json, ct);
        }
        catch (Exception ex) when (ex is JsonException or InvalidDataException)
        {
            return BadRequest(new { status = "Error", message = "Could not read the upload: " + ex.Message });
        }
        if (batch == null || batch.Branch != branch)
            return BadRequest(new { status = "Error", message = "The upload belongs to another branch" });

        var (accepted, skipped) = await ingest.ApplyAsync(branch, batch.Items ?? [], ct);
        return Ok(new { status = "Success", accepted, skipped });
    }

    // Branch server: how the upload is doing. Online server: when each branch last uploaded.
    [HttpGet("Status")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Status([FromServices] ITenantContext tenantContext, [FromServices] HotelContext context, CancellationToken ct)
    {
        if (!_settings.IsBranch && !_settings.IsCloud)
            return Ok(new { status = "Success", data = new { mode = _settings.ModeName } });

        await using var conn = new NpgsqlConnection(_settings.ConnectionString);
        await conn.OpenAsync(ct);

        if (_settings.IsBranch)
        {
            await using var cmd = new NpgsqlCommand("SELECT lastattemptat, lastsentat, lasterror, sentrows FROM sync_state WHERE id = 1", conn);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            object? state = null;
            if (await r.ReadAsync(ct))
                state = new
                {
                    lastAttemptAt = r.IsDBNull(0) ? (DateTime?)null : r.GetDateTime(0),
                    lastSentAt = r.IsDBNull(1) ? (DateTime?)null : r.GetDateTime(1),
                    lastError = r.IsDBNull(2) ? null : r.GetString(2),
                    sentRows = r.GetInt64(3)
                };
            return Ok(new
            {
                status = "Success",
                data = new
                {
                    mode = _settings.ModeName,
                    branchId = _settings.BranchId,
                    serverUrl = _settings.ServerUrl,
                    configured = !string.IsNullOrWhiteSpace(_settings.ServerUrl) && !string.IsNullOrWhiteSpace(_settings.Key),
                    state
                }
            });
        }

        var tenant = await tenantContext.GetAsync();
        var ids = tenant.BranchIds.ToArray();
        var branches = await context.Branches.AsNoTracking()
            .Where(b => ids.Contains(b.Branchid))
            .OrderBy(b => b.Branchname)
            .Select(b => new { b.Branchid, b.Branchname })
            .ToListAsync(ct);

        var uploads = new Dictionary<int, (DateTime? At, long Rows)>();
        await using (var cmd = new NpgsqlCommand("SELECT branchid, lastuploadat, totalrows FROM sync_branch_status WHERE branchid = ANY(@ids)", conn))
        {
            cmd.Parameters.AddWithValue("ids", ids);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
                uploads[r.GetInt32(0)] = (r.IsDBNull(1) ? null : r.GetDateTime(1), r.GetInt64(2));
        }

        return Ok(new
        {
            status = "Success",
            data = new
            {
                mode = _settings.ModeName,
                serverTime = DateTime.UtcNow,
                branches = branches.Select(b => new
                {
                    branchId = b.Branchid,
                    branchName = b.Branchname,
                    lastUploadAt = uploads.TryGetValue(b.Branchid, out var u) ? u.At : null,
                    totalRows = uploads.TryGetValue(b.Branchid, out var v) ? v.Rows : 0
                })
            }
        });
    }

    private bool KeyMatches(int branch, string? key)
    {
        if (string.IsNullOrEmpty(key) || !_settings.BranchKeys.TryGetValue(branch.ToString(), out var expected) || string.IsNullOrEmpty(expected))
            return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(expected));
    }
}
