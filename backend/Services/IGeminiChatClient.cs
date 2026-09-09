using OpenAI.Chat;

namespace OpenAiChat.Services
{
    public interface IGeminiChatClient
    {
        Task<ChatCompletion> CompleteChatAsync(
            IEnumerable<ChatMessage> messages,
            ChatCompletionOptions? options = null,
            CancellationToken cancellationToken = default);

        Task<ChatCompletion> CompleteChatAsync(
            string prompt,
            CancellationToken cancellationToken = default);
    }
}
