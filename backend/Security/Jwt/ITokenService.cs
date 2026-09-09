using System.Security.Claims;

namespace OpenAiChat.Security.Jwt
{
    public interface ITokenService
    {
        string GenerateAccessToken(IEnumerable<Claim> claims);
        string GenerateAccessToken(IEnumerable<Claim> claims, TimeSpan lifetime);
        string GenerateRefreshToken();
        ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
    }
}
