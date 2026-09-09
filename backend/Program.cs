using Amazon.S3;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OpenAiChat.Configuration;
using OpenAiChat.CustomExceptions;
using OpenAiChat.Data;
using OpenAiChat.Repository;
using OpenAiChat.Security.Jwt;
using OpenAiChat.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

// Add services to the container.
builder.Services.Configure<GeminiOptions>(
    builder.Configuration.GetSection(GeminiOptions.SectionName));
builder.Services.AddSingleton<IGeminiChatClient, GeminiChatClient>();

builder.Services.AddHttpClient();

builder.Services.AddControllers();

// Azure EF Core
builder.Services.AddDbContext<FileUploadEfDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
    sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,                // how many times to retry
                maxRetryDelay: TimeSpan.FromSeconds(10), // wait between retries
                errorNumbersToAdd: null          // retry all transient errors
            );
    }));

// The UnitOfWork will manage the lifecycle of the DbContext instance
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// Configure AWS services from appsettings.json
builder.Services.AddAWSService<IAmazonS3>();

builder.Services.AddSingleton<ITextService, TextService>();
builder.Services.AddSingleton<IImageService, ImageService>();
builder.Services.AddSingleton<IPdfService, PdfService>();

// Scoped because IUnitOfWork and DbContext
builder.Services.AddScoped<IFileUploadService, FileUploadService>();
builder.Services.AddScoped<IFileAnalysisService, FileAnalysisService>();

// JWT authentication
// preserve JWT claim names (don't map "sub" -> ClaimTypes.NameIdentifier automatically)
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"];

if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be configured with a secret containing at least 32 characters.");
}

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ValidateIssuer = true,
        ValidIssuer = jwtSection["Issuer"] ?? "MyApi",
        ValidateAudience = true,
        ValidAudience = jwtSection["Audience"] ?? "MyApiClients",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(900), // default 15 min - reduce for stricter checks
        RoleClaimType = "role", // if you issue "role" claim in JWT
        NameClaimType = "name"   // optional
    };

    // optional hooks for logging or extra validation
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            // log context.Exception
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            // e.g. check user still exists, not revoked
            return Task.CompletedTask;
        },
        OnMessageReceived = context =>
        {
            // e.g. support token in query string for SignalR: ?access_token=
            var accessToken = context.Request.Query["access_token"].FirstOrDefault();
            if (!string.IsNullOrEmpty(accessToken) && context.Request.Path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("ai", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

// Add Swagger UI with Bearer auth so you can test easily
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Find the XML file path
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";

    // Instruct Swashbuckle to include XML comments
    c.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));

    // Keep legacy route aliases working without listing every endpoint three times.
    c.DocInclusionPredicate((_, api) =>
        api.RelativePath is null ||
        (!api.RelativePath.StartsWith("OpenAIAws/", StringComparison.OrdinalIgnoreCase) &&
         !api.RelativePath.StartsWith("GeminiAws/", StringComparison.OrdinalIgnoreCase)));

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// register a token service (below) for creation / refresh
builder.Services.AddSingleton<ITokenService, TokenService>();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins);
        }

        policy.AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// 1. Add services to the container
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails(); // Adds standard problem details support

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "AWS File Analyzer API v1");
    c.RoutePrefix = "swagger";
});

app.UseExceptionHandler();

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .AllowAnonymous();
app.MapControllers();

app.Run();
