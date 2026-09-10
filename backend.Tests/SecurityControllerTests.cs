using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenAiChat.Controllers;
using OpenAiChat.Dto;
using OpenAiChat.Models;
using OpenAiChat.Repository;
using OpenAiChat.Security.Jwt;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;

namespace OpenAiChat.Tests
{
    public class SecurityControllerTests
    {
        private readonly Mock<ITokenService> _mockTokenService;
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly Mock<IGenericRepository<UserLoginModel>> _mockUserRepo;
        private readonly SecurityController _controller;

        public SecurityControllerTests()
        {
            _mockTokenService = new Mock<ITokenService>();
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _mockUserRepo = new Mock<IGenericRepository<UserLoginModel>>();

            _mockUnitOfWork.Setup(u => u.UserLogin).Returns(_mockUserRepo.Object);

            _controller = new SecurityController(_mockTokenService.Object, _mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Login_WithEmptyCredentials_ReturnsBadRequest()
        {
            var result = await _controller.CreateJwtToken(new RegisterDto { UserName = "", Password = "" });

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Empty login or pwd!", badRequest.Value);
        }

        [Fact]
        public async Task Login_WithNonExistentUser_ReturnsBadRequest()
        {
            _mockUserRepo.Setup(r => r.GetAllAsync()).ReturnsAsync(new List<UserLoginModel>());

            var result = await _controller.CreateJwtToken(new RegisterDto { UserName = "unknown", Password = "password" });

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Invalid login!", badRequest.Value);
        }

        [Fact]
        public async Task Login_WithValidCredentials_ReturnsOkWithTokens()
        {
            var hashed = BCrypt.Net.BCrypt.HashPassword("validPassword123!");
            var users = new List<UserLoginModel>
            {
                new UserLoginModel { Id = 1, Username = "validUser", Password = hashed }
            };

            _mockUserRepo.Setup(r => r.GetAllAsync()).ReturnsAsync(users);
            IEnumerable<Claim>? capturedClaims = null;
            _mockTokenService.Setup(t => t.GenerateAccessToken(It.IsAny<IEnumerable<Claim>>()))
                .Callback<IEnumerable<Claim>>(claims => capturedClaims = claims.ToArray())
                .Returns("mock-access-token");
            _mockTokenService.Setup(t => t.GenerateRefreshToken()).Returns("mock-refresh-token");

            var result = await _controller.CreateJwtToken(new RegisterDto { UserName = "validUser", Password = "validPassword123!" });

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
            Assert.Contains(capturedClaims!, claim => claim.Type == "name" && claim.Value == "validUser");
            Assert.Contains(capturedClaims!, claim => claim.Type == "role" && claim.Value == "User");
        }

        [Fact]
        public async Task Register_WithExistingUsername_ReturnsBadRequest()
        {
            var users = new List<UserLoginModel>
            {
                new UserLoginModel { Id = 1, Username = "existingUser", Password = "hash" }
            };

            _mockUserRepo.Setup(r => r.GetAllAsync()).ReturnsAsync(users);

            var result = await _controller.Register(new RegisterDto { UserName = "existingUser", Password = "password" });

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("User exist!", badRequest.Value);
        }

        [Fact]
        public async Task Register_WithNewUser_SavesHashedPasswordAndReturnsOk()
        {
            _mockUserRepo.Setup(r => r.GetAllAsync()).ReturnsAsync(new List<UserLoginModel>());
            _mockUnitOfWork.Setup(u => u.CompleteAsync()).ReturnsAsync(1);

            UserLoginModel? capturedUser = null;
            _mockUserRepo.Setup(r => r.Add(It.IsAny<UserLoginModel>()))
                .Callback<UserLoginModel>(u => capturedUser = u);

            var result = await _controller.Register(new RegisterDto { UserName = "brandNewUser", Password = "secretPassword123" });

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
            Assert.NotNull(capturedUser);
            Assert.Equal("brandNewUser", capturedUser.Username);
            Assert.True(BCrypt.Net.BCrypt.Verify("secretPassword123", capturedUser.Password));
        }

        [Fact]
        public async Task GoogleLogin_WithEmptyIdToken_ReturnsBadRequest()
        {
            var result = await _controller.GoogleLogin(new GoogleLoginDto { IdToken = "" });

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Empty Google ID token!", badRequest.Value);
        }

        [Fact]
        public void GuestSession_IssuesShortLivedGuestTokenWithoutDatabaseWrite()
        {
            _mockTokenService
                .Setup(service => service.GenerateAccessToken(
                    It.Is<IEnumerable<Claim>>(claims => claims.Any(claim => claim.Type == "role" && claim.Value == "Guest")),
                    TimeSpan.FromMinutes(15)))
                .Returns("guest-access-token");

            var result = _controller.CreateGuestSession();

            var okResult = Assert.IsType<OkObjectResult>(result);
            var accessToken = okResult.Value?.GetType().GetProperty("accessToken")?.GetValue(okResult.Value);
            var isGuest = okResult.Value?.GetType().GetProperty("isGuest")?.GetValue(okResult.Value);
            Assert.Equal("guest-access-token", accessToken);
            Assert.Equal(true, isGuest);
            _mockUnitOfWork.Verify(unit => unit.CompleteAsync(), Times.Never);
        }

        [Fact]
        public void ClaimGuestUploads_WithEmptyUrls_ReturnsBadRequest()
        {
            var result = _controller.ClaimGuestUploads(new ClaimUploadsDto { FileUrls = new List<string>() });
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("No file URLs provided to claim.", badRequest.Value);
        }

        [Fact]
        public void ClaimGuestUploads_WithValidUrls_ReturnsOkWithCount()
        {
            var dto = new ClaimUploadsDto
            {
                FileUrls = new List<string> { "https://example.com/test-file.png" }
            };

            var result = _controller.ClaimGuestUploads(dto);
            var okResult = Assert.IsType<OkObjectResult>(result);
            var count = okResult.Value?.GetType().GetProperty("claimedCount")?.GetValue(okResult.Value);
            Assert.Equal(1, count);
        }
    }
}

