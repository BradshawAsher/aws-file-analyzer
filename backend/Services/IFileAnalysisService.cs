
namespace OpenAiChat.Services
{
    public interface IFileAnalysisService
    {
        Task<string> AnalyzeFileAsync(string fileUrl);
        Task<List<string>> AnalyzeFilesAsync(List<string> fileUrls);
    }
}