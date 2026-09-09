using OpenAI.Chat;

namespace OpenAiChat.Services
{
    public class ImageService : IImageService
    {
        private readonly ChatClient _chatClient;
        private readonly HttpClient _httpClient;

        public ImageService(ChatClient chatClient, IHttpClientFactory httpClientFactory)
        {
            _chatClient = chatClient;
            _httpClient = httpClientFactory.CreateClient();
        }

        public async Task<string> AnalyzeImageAsync(string imageUrl)
        {
            var userPrompt = @"
You are an image analysis assistant. 
Analyze the uploaded image and respond ONLY in valid JSON format, with the following schema:

{
  ""city"": string | null,
  ""region"": string | null,
  ""country"": string | null,
  ""landmark"": string | null,
  ""weather"": string | null,
  ""category"": string,   // e.g. 'architecture', 'nature', 'food', 'people'
  ""caption"": string | null, // a brief description of the image
  ""confidence"": float | null, // confidence score between 0 and 1
  ""justification"": string | null // brief explanation of your analysis
}

Rules:
- If you are at least 51% confident, include your best guess.
- For outdoors photo, always include your best-guess city/region/country even if uncertain.
- For indoors photo, include city/region/country if confidence over 0.50; otherwise, use null.
- For landmark, include the most likely famous building or place name if visible.
- For landmark, Use your best-guess name even if partially visible or you are only moderately sure.
- Return only JSON, no explanation.
- If a field completely unknown, use null.
";

            var systemPrompt = "You are an image analysis assistant.";

            ChatMessageContentPart imagePart;

            if (imageUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                imagePart = ChatMessageContentPart.CreateImagePart(new Uri(imageUrl));
            }
            else
            {
                using var response = await _httpClient.GetAsync(imageUrl).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();
                var imageBytes = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                string mediaType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                imagePart = ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(imageBytes), mediaType);
            }

            List<ChatMessage> messages =
            [
                new SystemChatMessage(ChatMessageContentPart.CreateTextPart(systemPrompt)),
                new UserChatMessage(
                    ChatMessageContentPart.CreateTextPart(userPrompt),
                    imagePart)
            ];

            var options = new ChatCompletionOptions
            {
                ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat(),
                Temperature = (float?)0.2
            };

            var completionResult = await _chatClient.CompleteChatAsync(messages, options).ConfigureAwait(false);
            var result = completionResult.Value.Content[0].Text;
            var metaData = System.Text.Json.JsonSerializer.Deserialize<MetaData.ImageMetaData>(result);

            return result;
        }
    }
}
