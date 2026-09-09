namespace OpenAiChat.Configuration
{
    public sealed class GeminiOptions
    {
        public const string SectionName = "Gemini";

        public string ApiKey { get; set; } = string.Empty;

        public string Endpoint { get; set; } =
            "https://generativelanguage.googleapis.com/v1beta/openai/";

        public string[] Models { get; set; } = [];

        public int MaxRetriesPerModel { get; set; } = 1;

        public int InitialRetryDelayMilliseconds { get; set; } = 500;
    }
}
