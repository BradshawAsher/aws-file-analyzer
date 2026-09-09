using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;
using OpenAiChat.Configuration;
using System.ClientModel;
using System.ClientModel.Primitives;

namespace OpenAiChat.Services
{
    public sealed class GeminiChatClient : IGeminiChatClient
    {
        private static readonly int[] RetryableStatusCodes =
            [408, 429, 500, 502, 503, 504];

        private readonly IReadOnlyList<(string Model, ChatClient Client)> _clients;
        private readonly ILogger<GeminiChatClient> _logger;
        private readonly int _maxRetriesPerModel;
        private readonly TimeSpan _initialRetryDelay;

        public GeminiChatClient(
            IOptions<GeminiOptions> options,
            ILogger<GeminiChatClient> logger)
        {
            var settings = options.Value;

            if (string.IsNullOrWhiteSpace(settings.ApiKey))
            {
                throw new InvalidOperationException(
                    "Gemini:ApiKey is not configured. Use .NET User Secrets locally or an environment variable in deployment.");
            }

            if (!Uri.TryCreate(settings.Endpoint, UriKind.Absolute, out var endpoint))
            {
                throw new InvalidOperationException("Gemini:Endpoint must be a valid absolute URL.");
            }

            var models = settings.Models
                .Where(model => !string.IsNullOrWhiteSpace(model))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (models.Length == 0)
            {
                throw new InvalidOperationException("Configure at least one model in Gemini:Models.");
            }

            var clientOptions = new OpenAIClientOptions
            {
                Endpoint = endpoint,
                RetryPolicy = new ClientRetryPolicy(0)
            };
            var credential = new ApiKeyCredential(settings.ApiKey);

            _clients = models
                .Select(model => (
                    Model: model,
                    Client: new ChatClient(model, credential, clientOptions)))
                .ToArray();

            _logger = logger;
            _maxRetriesPerModel = Math.Clamp(settings.MaxRetriesPerModel, 0, 3);
            _initialRetryDelay = TimeSpan.FromMilliseconds(
                Math.Clamp(settings.InitialRetryDelayMilliseconds, 100, 10_000));
        }

        public Task<ChatCompletion> CompleteChatAsync(
            IEnumerable<ChatMessage> messages,
            ChatCompletionOptions? options = null,
            CancellationToken cancellationToken = default)
        {
            var messageList = messages.ToArray();

            return CompleteWithFallbackAsync(
                async (client, token) =>
                {
                    var result = await client
                        .CompleteChatAsync(messageList, options, token)
                        .ConfigureAwait(false);
                    return result.Value;
                },
                cancellationToken);
        }

        public Task<ChatCompletion> CompleteChatAsync(
            string prompt,
            CancellationToken cancellationToken = default)
        {
            ChatMessage[] messages = [new UserChatMessage(prompt)];
            return CompleteChatAsync(messages, cancellationToken: cancellationToken);
        }

        private async Task<ChatCompletion> CompleteWithFallbackAsync(
            Func<ChatClient, CancellationToken, Task<ChatCompletion>> operation,
            CancellationToken cancellationToken)
        {
            Exception? lastException = null;

            for (var modelIndex = 0; modelIndex < _clients.Count; modelIndex++)
            {
                var (model, client) = _clients[modelIndex];

                for (var attempt = 0; attempt <= _maxRetriesPerModel; attempt++)
                {
                    try
                    {
                        var completion = await operation(client, cancellationToken).ConfigureAwait(false);

                        if (modelIndex > 0 || attempt > 0)
                        {
                            _logger.LogInformation(
                                "Gemini request succeeded with model {Model} on attempt {Attempt}.",
                                model,
                                attempt + 1);
                        }

                        return completion;
                    }
                    catch (ClientResultException exception) when (ShouldRetry(exception.Status))
                    {
                        lastException = exception;

                        var hasRetryOnCurrentModel =
                            exception.Status is not (404 or 429) && attempt < _maxRetriesPerModel;
                        var hasFallbackModel = modelIndex < _clients.Count - 1;

                        if (!hasRetryOnCurrentModel && !hasFallbackModel)
                        {
                            throw;
                        }

                        var nextAction = hasRetryOnCurrentModel
                            ? $"retry model {model}"
                            : $"fall back to {_clients[modelIndex + 1].Model}";

                        _logger.LogWarning(
                            "Gemini model {Model} returned HTTP {Status}. Will {NextAction}.",
                            model,
                            exception.Status,
                            nextAction);

                        await DelayWithJitterAsync(attempt, cancellationToken).ConfigureAwait(false);

                        if (!hasRetryOnCurrentModel)
                        {
                            break;
                        }
                    }
                    catch (HttpRequestException exception)
                    {
                        lastException = exception;
                        var hasRetryOnCurrentModel = attempt < _maxRetriesPerModel;
                        var hasFallbackModel = modelIndex < _clients.Count - 1;

                        if (!hasRetryOnCurrentModel && !hasFallbackModel)
                        {
                            throw;
                        }

                        _logger.LogWarning(
                            exception,
                            "Network failure calling Gemini model {Model}; retrying or falling back.",
                            model);

                        await DelayWithJitterAsync(attempt, cancellationToken).ConfigureAwait(false);

                        if (!hasRetryOnCurrentModel)
                        {
                            break;
                        }
                    }
                    catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
                    {
                        lastException = exception;
                        var hasRetryOnCurrentModel = attempt < _maxRetriesPerModel;
                        var hasFallbackModel = modelIndex < _clients.Count - 1;

                        if (!hasRetryOnCurrentModel && !hasFallbackModel)
                        {
                            throw;
                        }

                        _logger.LogWarning(
                            "Gemini model {Model} timed out; retrying or falling back.",
                            model);

                        await DelayWithJitterAsync(attempt, cancellationToken).ConfigureAwait(false);

                        if (!hasRetryOnCurrentModel)
                        {
                            break;
                        }
                    }
                }
            }

            throw new InvalidOperationException(
                "All configured Gemini models failed with transient errors.",
                lastException);
        }

        private static bool ShouldRetry(int status) =>
            RetryableStatusCodes.Contains(status) || status == 404;

        private async Task DelayWithJitterAsync(
            int attempt,
            CancellationToken cancellationToken)
        {
            var exponentialDelay = _initialRetryDelay.TotalMilliseconds * Math.Pow(2, attempt);
            var jitter = Random.Shared.Next(50, 251);
            var delay = TimeSpan.FromMilliseconds(
                Math.Min(exponentialDelay + jitter, 10_000));

            await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
        }
    }
}
