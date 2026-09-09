namespace OpenAiChat.Dto
{
    public class OpenAISummaryRequest
    {
        // Backward-compatible single file URL
        public string? fileUrl { get; set; }

        // Multi-file URLs for concurrent analysis
        public List<string>? fileUrls { get; set; }
    }

    public class FileSummaryRequest : OpenAISummaryRequest
    {
    }
}
