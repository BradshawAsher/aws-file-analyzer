using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenAiChat.Configuration;
using OpenAiChat.Services;
using System.ClientModel;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Xunit;

namespace OpenAiChat.Tests;

public sealed class GeminiChatClientTests
{
    [Fact]
    public async Task CompleteChatAsync_FallsBackToNextModel_WhenRateLimited()
    {
        await using var server = new FakeGeminiServer((model, _) =>
            model == "primary-model"
                ? FakeResponse.Error(HttpStatusCode.TooManyRequests, "rate limited")
                : FakeResponse.Success(model, "fallback worked"));

        var client = CreateClient(server.Endpoint, ["primary-model", "fallback-model"]);

        var completion = await client.CompleteChatAsync("hello");

        Assert.Equal("fallback worked", completion.Content[0].Text);
        Assert.Equal(["primary-model", "fallback-model"], server.RequestedModels);
    }

    [Fact]
    public async Task CompleteChatAsync_DoesNotFallBack_WhenAuthenticationFails()
    {
        await using var server = new FakeGeminiServer((_, _) =>
            FakeResponse.Error(HttpStatusCode.Unauthorized, "invalid key"));

        var client = CreateClient(server.Endpoint, ["primary-model", "fallback-model"]);

        var exception = await Assert.ThrowsAsync<ClientResultException>(
            () => client.CompleteChatAsync("hello"));

        Assert.Equal(401, exception.Status);
        Assert.Single(server.RequestedModels);
        Assert.Equal("primary-model", server.RequestedModels[0]);
    }

    [Fact]
    public async Task CompleteChatAsync_RetriesCurrentModel_WhenServiceIsUnavailable()
    {
        await using var server = new FakeGeminiServer((model, requestNumber) =>
            requestNumber == 1
                ? FakeResponse.Error(HttpStatusCode.ServiceUnavailable, "temporarily unavailable")
                : FakeResponse.Success(model, "retry worked"));

        var client = CreateClient(
            server.Endpoint,
            ["primary-model", "fallback-model"],
            maxRetriesPerModel: 1);

        var completion = await client.CompleteChatAsync("hello");

        Assert.Equal("retry worked", completion.Content[0].Text);
        Assert.Equal(["primary-model", "primary-model"], server.RequestedModels);
    }

    [Fact]
    public async Task CompleteChatAsync_DoesNotRetryMalformedRequests()
    {
        await using var server = new FakeGeminiServer((_, _) =>
            FakeResponse.Error(HttpStatusCode.BadRequest, "malformed request"));

        var client = CreateClient(server.Endpoint, ["primary-model", "fallback-model"]);

        var exception = await Assert.ThrowsAsync<ClientResultException>(
            () => client.CompleteChatAsync("hello"));

        Assert.Equal(400, exception.Status);
        Assert.Single(server.RequestedModels);
    }

    [Fact]
    public async Task CompleteChatAsync_FallsBackImmediately_WhenModelIsUnavailable()
    {
        await using var server = new FakeGeminiServer((model, _) =>
            model == "unavailable-model"
                ? FakeResponse.Error(HttpStatusCode.NotFound, "model not found")
                : FakeResponse.Success(model, "available model worked"));

        var client = CreateClient(
            server.Endpoint,
            ["unavailable-model", "available-model"],
            maxRetriesPerModel: 1);

        var completion = await client.CompleteChatAsync("hello");

        Assert.Equal("available model worked", completion.Content[0].Text);
        Assert.Equal(["unavailable-model", "available-model"], server.RequestedModels);
    }

    private static GeminiChatClient CreateClient(
        Uri endpoint,
        string[] models,
        int maxRetriesPerModel = 0)
    {
        var options = Options.Create(new GeminiOptions
        {
            ApiKey = "test-key",
            Endpoint = endpoint.ToString(),
            Models = models,
            MaxRetriesPerModel = maxRetriesPerModel,
            InitialRetryDelayMilliseconds = 100
        });

        return new GeminiChatClient(options, NullLogger<GeminiChatClient>.Instance);
    }

    private sealed class FakeGeminiServer : IAsyncDisposable
    {
        private readonly HttpListener _listener = new();
        private readonly Func<string, int, FakeResponse> _responseFactory;
        private readonly CancellationTokenSource _shutdown = new();
        private readonly Task _serverTask;
        private int _requestNumber;

        public FakeGeminiServer(Func<string, int, FakeResponse> responseFactory)
        {
            _responseFactory = responseFactory;
            var port = GetAvailablePort();
            Endpoint = new Uri($"http://127.0.0.1:{port}/v1beta/openai/");
            _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
            _listener.Start();
            _serverTask = RunAsync();
        }

        public Uri Endpoint { get; }

        public List<string> RequestedModels { get; } = [];

        public async ValueTask DisposeAsync()
        {
            _shutdown.Cancel();
            _listener.Stop();

            try
            {
                await _serverTask.ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
            }

            _listener.Close();
            _shutdown.Dispose();
        }

        private async Task RunAsync()
        {
            while (!_shutdown.IsCancellationRequested)
            {
                HttpListenerContext context;

                try
                {
                    context = await _listener.GetContextAsync().ConfigureAwait(false);
                }
                catch (HttpListenerException) when (_shutdown.IsCancellationRequested)
                {
                    break;
                }
                catch (ObjectDisposedException) when (_shutdown.IsCancellationRequested)
                {
                    // Linux can surface listener shutdown as ObjectDisposedException,
                    // while Windows commonly reports HttpListenerException.
                    break;
                }

                using var document = await JsonDocument.ParseAsync(
                    context.Request.InputStream,
                    cancellationToken: _shutdown.Token).ConfigureAwait(false);
                var model = document.RootElement.GetProperty("model").GetString() ?? string.Empty;
                RequestedModels.Add(model);

                var response = _responseFactory(model, Interlocked.Increment(ref _requestNumber));
                var bytes = Encoding.UTF8.GetBytes(response.Body);
                context.Response.StatusCode = (int)response.StatusCode;
                context.Response.ContentType = "application/json";
                context.Response.ContentLength64 = bytes.Length;
                await context.Response.OutputStream
                    .WriteAsync(bytes, _shutdown.Token)
                    .ConfigureAwait(false);
                context.Response.Close();
            }
        }

        private static int GetAvailablePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }
    }

    private sealed record FakeResponse(HttpStatusCode StatusCode, string Body)
    {
        public static FakeResponse Error(HttpStatusCode statusCode, string message) =>
            new(statusCode, JsonSerializer.Serialize(new
            {
                error = new
                {
                    message,
                    type = "api_error",
                    code = "test_error"
                }
            }));

        public static FakeResponse Success(string model, string content) =>
            new(HttpStatusCode.OK, JsonSerializer.Serialize(new
            {
                id = "chatcmpl-test",
                @object = "chat.completion",
                created = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                model,
                choices = new[]
                {
                    new
                    {
                        index = 0,
                        message = new { role = "assistant", content },
                        finish_reason = "stop"
                    }
                },
                usage = new
                {
                    prompt_tokens = 1,
                    completion_tokens = 1,
                    total_tokens = 2
                }
            }));
    }
}
