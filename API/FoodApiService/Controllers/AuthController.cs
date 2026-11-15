using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FoodApiService.Models;
using FoodApiService.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace FoodApiService.Controllers;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly HotelContext _context;
    private readonly LoginEncryption _encryption;

    public AuthController(IConfiguration config, HotelContext context, LoginEncryption encryption)
    {
        _config = config;
        _context = context;
        _encryption = encryption;
    }

    // What the browser needs to encrypt the password for one login attempt.
    [HttpGet("login-key")]
    public IActionResult LoginKey()
    {
        return Ok(new { status = "Success", data = new { publicKey = _encryption.PublicKeyPem, nonce = _encryption.NewNonce() } });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginModel model)
    {
        // On the online server several branches may have the same username; their copies carry no password
        // (only logins made online have one), so the one with a password is tried.
        var user = await _context.Users.AsNoTracking()
            .Where(u => u.Username == model.username && u.Status == true)
            .OrderByDescending(u => u.Password != null)
            .FirstOrDefaultAsync();
        if (!PasswordSecurity.Verify(user?.Password, _encryption.Decrypt(model.password)))
        {
            return Ok(new { status = "Error", message = "Invalid credentials", data = (object)null });
        }

        int roleid = await _context.Userroles.Where(r => r.Userid == user.Userid).Select(p => p.Roleid).FirstOrDefaultAsync();
        string rolename = await _context.Roles.Where(p => p.Roleid == roleid).Select(p => p.Rolename).FirstOrDefaultAsync();

        if (rolename == null)
        {
            return Ok(new { status = "Error", message = "Role not assigned", data = (object)null });
        }

        var branch = await _context.Branches
            .Where(b => b.Branchid == user.Branchid)
            .Select(b => new { b.Branchid, b.Branchname, b.Outletid })
            .FirstOrDefaultAsync();
        int branchid = user.Branchid.GetValueOrDefault();
        int outletid = user.Outletid ?? branch?.Outletid ?? 0;
        string? outletname = await _context.Outlets.Where(o => o.Outletid == outletid).Select(o => o.Outletname).FirstOrDefaultAsync();

        string token = GenerateJwtToken(user, rolename, branchid, outletid);
        return Ok(new
        {
            status = "Success",
            message = "Login successful",
            data = new
            {
                Token = token,
                Role = rolename,
                Id = user.Userid,
                Name = user.Username,
                Branchid = branchid,
                Branchname = branch?.Branchname,
                Outletid = outletid,
                Outletname = outletname
            }
        });
    }

    private string GenerateJwtToken(User user, string role, int branchid, int outletid)
    {
        var jwtSettings = _config.GetSection("JwtSettings");
        var key = Encoding.UTF8.GetBytes(jwtSettings["Key"]!);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, role ?? "User"),
            new Claim(TenantClaims.UserId, user.Userid.ToString()),
            new Claim(TenantClaims.BranchId, branchid.ToString()),
            new Claim(TenantClaims.OutletId, outletid.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(Convert.ToDouble(jwtSettings["ExpirationInDays"])),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
