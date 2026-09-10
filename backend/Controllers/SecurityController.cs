using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using OpenAiChat.Dto;
using OpenAiChat.Models;
using OpenAiChat.Repository;
using OpenAiChat.Security.Jwt;
using OpenAiChat.Utils;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace OpenAiChat.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SecurityController : ControllerBase
    {
        private readonly ITokenService _tokenService;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration? _configuration;

        public SecurityController(ITokenService tokenService, IUnitOfWork uow, IConfiguration? configuration = null)
        {
            _tokenService = tokenService;
            _unitOfWork = uow;
            _configuration = configuration;
        }
        /// <summary>
        ///  Create access token
        /// </summary>
        /// <param name="userNamePasswd">username and password</param>
        /// <returns>status code</returns>
        /// [ProducesResponseType(StatusCodes.Status200OK)] // Access token created
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: wrong username or password
        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> CreateJwtToken([FromBody] RegisterDto userNamePasswd)
        {
            if (userNamePasswd == null ||
                string.IsNullOrEmpty(userNamePasswd.UserName) ||
                string.IsNullOrEmpty(userNamePasswd.Password))
            {
                return BadRequest("Empty login or pwd!");
            }

            var user = userNamePasswd.UserName;
            var pwd = userNamePasswd.Password;

            var existingLogins = await _unitOfWork.UserLogin
                    .GetAllAsync()
                    .ConfigureAwait(false);


            var existingLogin = existingLogins.FirstOrDefault(
                login => login.Username.Equals(user) &&
                BCrypt.Net.BCrypt.Verify(pwd, login.Password));

            if (existingLogin == null)
            {
                return BadRequest("Invalid login!");
            }

            var claims = new[]
            {
                new Claim("name", user),
                new Claim("role", "User"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var accessToken = _tokenService.GenerateAccessToken(claims);
            var refreshToken = _tokenService.GenerateRefreshToken();

            return Ok(new { accessToken = accessToken, refreshToken = refreshToken });
        }

        /// <summary>
        ///  Register username and password for login
        /// </summary>
        /// <param name="userNamePasswd"></param>
        /// <returns>status code</returns>
        /// [ProducesResponseType(StatusCodes.Status200OK)] // Access token created
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: empty username or password
        /// [ProducesResponseType(StatusCodes.Status500InternalServerError)] // 500: internal server error
        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Register([FromBody] RegisterDto userNamePasswd)
        {
            if (string.IsNullOrEmpty(userNamePasswd.UserName) || string.IsNullOrEmpty(userNamePasswd.Password))
            {
                return BadRequest("Empty username or password!");
            }
            string userName = userNamePasswd.UserName;
            string pwd = userNamePasswd.Password;

            var existingLogins = await _unitOfWork.UserLogin
                    .GetAllAsync()
                    .ConfigureAwait(false);

            var duplicateUser = existingLogins.FirstOrDefault(user => user.Username.Equals(userName));

            if (duplicateUser != null)
            {
                return BadRequest("User exist!");
            }

            string encryptedPwd = BCrypt.Net.BCrypt.HashPassword(pwd);

            // Save username and password
            var login = new UserLoginModel
            {
                Username = userName,
                Password = encryptedPwd
            };
            _unitOfWork.UserLogin.Add(login);

            try
            {
                await _unitOfWork.CompleteAsync().ConfigureAwait(false);

                var claims = new[]
                {
                    new Claim("name", userName),
                    new Claim("role", "User"),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
                };

                var accessToken = _tokenService.GenerateAccessToken(claims);
                var refreshToken = _tokenService.GenerateRefreshToken();

                return Ok(new { accessToken = accessToken, refreshToken = refreshToken });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }

        }

        /// <summary>
        ///  Authenticate via Google OAuth 2.0 ID Token
        /// </summary>
        /// <param name="dto">Google ID Token payload</param>
        /// <returns>JWT Access and Refresh tokens</returns>
        [HttpPost("google-login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.IdToken))
            {
                return BadRequest("Empty Google ID token!");
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                var settings = new GoogleJsonWebSignature.ValidationSettings();
                var googleClientId = _configuration?["Authentication:Google:ClientId"]
                    ?? _configuration?["Google:ClientId"];

                if (!string.IsNullOrWhiteSpace(googleClientId))
                {
                    settings.Audience = new[] { googleClientId.Trim() };
                }

                payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, settings);
            }
            catch (InvalidJwtException ex)
            {
                return BadRequest($"Invalid Google token: {ex.Message}");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Google validation error: {ex.Message}");
            }

            var email = payload.Email;
            var name = !string.IsNullOrWhiteSpace(payload.Name) ? payload.Name : email;
            var username = $"google_{payload.Subject}";

            var existingLogins = await _unitOfWork.UserLogin
                .GetAllAsync()
                .ConfigureAwait(false);

            var existingUser = existingLogins.FirstOrDefault(u =>
                u.Username.Equals(username, StringComparison.OrdinalIgnoreCase) ||
                (!string.IsNullOrEmpty(email) && u.Username.Equals(email, StringComparison.OrdinalIgnoreCase)));

            if (existingUser == null)
            {
                existingUser = new UserLoginModel
                {
                    Username = !string.IsNullOrEmpty(email) ? email : username,
                    Password = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"))
                };
                _unitOfWork.UserLogin.Add(existingUser);
                await _unitOfWork.CompleteAsync().ConfigureAwait(false);
            }

            var claims = new[]
            {
                new Claim("name", name ?? "Google User"),
                new Claim("email", email ?? string.Empty),
                new Claim("role", "User"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var accessToken = _tokenService.GenerateAccessToken(claims);
            var refreshToken = _tokenService.GenerateRefreshToken();

            return Ok(new { accessToken = accessToken, refreshToken = refreshToken });
        }

        /// <summary>
        /// Create a short-lived, non-persistent guest session for the live demo.
        /// </summary>
        [HttpPost("guest-session")]
        [EnableRateLimiting("guest-session")]
        public IActionResult CreateGuestSession()
        {
            var lifetime = TimeSpan.FromMinutes(15);
            var claims = new[]
            {
                new Claim("name", $"Guest-{Guid.NewGuid():N}"[..14]),
                new Claim("role", "Guest"),
                new Claim("session_type", "guest"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var accessToken = _tokenService.GenerateAccessToken(claims, lifetime);

            return Ok(new
            {
                accessToken,
                expiresInSeconds = (int)lifetime.TotalSeconds,
                isGuest = true
            });
        }

        /// <summary>
        /// Claim uploads created during a guest demo session into an authenticated user's account.
        /// </summary>
        [HttpPost("claim-guest-uploads")]
        [Authorize(Roles = "User,Admin")]
        [EnableRateLimiting("auth")]
        public IActionResult ClaimGuestUploads([FromBody] ClaimUploadsDto? dto)
        {
            if (dto?.FileUrls == null || dto.FileUrls.Count == 0)
            {
                return BadRequest("No file URLs provided to claim.");
            }

            var bucketName = _configuration?["AWS:S3BucketName"];
            var region = _configuration?["AWS:Region"];

            var validUrls = dto.FileUrls
                .Where(url => !string.IsNullOrWhiteSpace(url) &&
                              FileUtils.IsFileUrlValid(url) &&
                              (string.IsNullOrEmpty(bucketName) || FileUtils.IsAllowedS3Url(url, bucketName, region ?? string.Empty)))
                .ToList();

            if (validUrls.Count == 0)
            {
                return BadRequest("No valid S3 file URLs matched this bucket.");
            }

            var username = User?.Identity?.Name ?? "Authenticated User";

            return Ok(new
            {
                claimedCount = validUrls.Count,
                claimedBy = username,
                fileUrls = validUrls,
                message = $"Successfully claimed {validUrls.Count} guest upload{(validUrls.Count > 1 ? "s" : "")} for {username}."
            });
        }
    }
}

