using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace FoodApiService.Service;

// Keeps the password out of the login request: the browser encrypts "nonce:password" with this RSA public
// key. The private key exists only in this process (a new pair at every API start). Each nonce works once
// and only for a short time, so a captured login request cannot be sent again.
public sealed class LoginEncryption : IDisposable
{
    private const int MaxPending = 10000;
    private static readonly TimeSpan NonceLifetime = TimeSpan.FromMinutes(2);

    private readonly RSA _rsa = RSA.Create(2048);
    private readonly ConcurrentDictionary<string, DateTime> _nonces = new();

    public string PublicKeyPem => _rsa.ExportSubjectPublicKeyInfoPem();

    public string NewNonce()
    {
        var now = DateTime.UtcNow;
        foreach (var pending in _nonces)
            if (pending.Value < now)
                _nonces.TryRemove(pending.Key, out _);
        if (_nonces.Count >= MaxPending)
            _nonces.Clear();

        string nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        _nonces[nonce] = now.Add(NonceLifetime);
        return nonce;
    }

    // The password from an encrypted login value; null when it is not valid (including plain text or a reused nonce).
    public string? Decrypt(string? encrypted)
    {
        if (string.IsNullOrEmpty(encrypted))
            return null;
        try
        {
            byte[] bytes = _rsa.Decrypt(Convert.FromBase64String(encrypted), RSAEncryptionPadding.OaepSHA256);
            string text = Encoding.UTF8.GetString(bytes);
            int separator = text.IndexOf(':');
            if (separator <= 0 || !_nonces.TryRemove(text[..separator], out DateTime expires) || expires < DateTime.UtcNow)
                return null;
            return text[(separator + 1)..];
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            return null;
        }
    }

    public void Dispose() => _rsa.Dispose();
}
