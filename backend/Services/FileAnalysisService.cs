using Microsoft.EntityFrameworkCore;
using OpenAiChat.Models;
using OpenAiChat.Repository;
using OpenAiChat.Utils;

namespace OpenAiChat.Services
{
    public class FileAnalysisService : IFileAnalysisService
    {
        private static readonly SemaphoreSlim _dbLock = new SemaphoreSlim(1, 1);
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<FileAnalysisService> _logger;
        private readonly IImageService _imageService;
        private readonly ITextService _textService;
        private readonly IPdfService _pdfService;
        private readonly IUnitOfWork _unitOfWork;

        public FileAnalysisService(
            IHttpClientFactory httpClientFactory,
            ILogger<FileAnalysisService> logger,
            IImageService imageService,
            ITextService textService,
            IPdfService pdfService,
            IUnitOfWork unitOfWork)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _imageService = imageService;
            _textService = textService;
            _pdfService = pdfService;
            _unitOfWork = unitOfWork;
        }

        public async Task<List<string>> AnalyzeFilesAsync(List<string> fileUrls)
        {
            if (fileUrls == null || fileUrls.Count == 0)
            {
                return new List<string>();
            }

            var tasks = fileUrls.Select(url => AnalyzeFileAsync(url));
            var results = await Task.WhenAll(tasks);

            return results.ToList();
        }

        public async Task<string> AnalyzeFileAsync(string fileUrl)
        {
            if (!FileUtils.IsFileUrlValid(fileUrl))
            {
                throw new InvalidDataException("Invalid/unsupported url entered!");
            }

            // 1. Download HTML
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");

            // Check file type
            var typeRequest = new HttpRequestMessage(HttpMethod.Get, fileUrl);
            var headerResponse = await httpClient.SendAsync(typeRequest);

            if (headerResponse == null || !headerResponse.IsSuccessStatusCode)
            {
                throw new InvalidDataException("Unable to fetch header!");
            }

            string contentType = headerResponse.Content.Headers.ContentType.MediaType;

            if (string.IsNullOrEmpty(contentType))
            {
                throw new InvalidDataException("Content formet of {textUrl} NOT supported!");
            }

            await _dbLock.WaitAsync().ConfigureAwait(false);
            bool isConnectionStringGood = false;
            try
            {
                isConnectionStringGood = await _unitOfWork.IsDbConnectionStringGood().ConfigureAwait(false);
                if (isConnectionStringGood)
                {
                    //Check if analysis already exists
                    var existingAnalysis = await _unitOfWork.FileAnalysisResult
                        .Find(f => f.PresignedUrl == fileUrl).FirstOrDefaultAsync();

                    if (existingAnalysis != null)
                    {
                        return existingAnalysis.AnalysisText;
                    }
                }
            }
            finally
            {
                _dbLock.Release();
            }

            // Find image info
            if (FileUtils.IsImage(contentType))
            {
                try
                {
                    var geoInfo = await _imageService.AnalyzeImageAsync(fileUrl).ConfigureAwait(false);

                    if (isConnectionStringGood)
                    {
                        var analysisResult = new FileAnalysisResultModel()
                        {
                            PresignedUrl = fileUrl,
                            AnalysisText = geoInfo,
                        };

                        await _dbLock.WaitAsync().ConfigureAwait(false);
                        try
                        {
                            _unitOfWork.FileAnalysisResult.Add(analysisResult);
                            await _unitOfWork.CompleteAsync().ConfigureAwait(false);
                        }
                        finally
                        {
                            _dbLock.Release();
                        }
                    }

                    return geoInfo;
                }
                catch (Exception ex)
                {
                    // something wrong with server
                    throw new Exception(ex.Message);
                }

            }
            // Summarize text
            else if (FileUtils.IsPlainText(contentType))
            {
                try
                {
                    // Ask the service to summarize
                    var summary = await _textService.SummarizeTextAsync(fileUrl).ConfigureAwait(false);

                    if (isConnectionStringGood)
                    {
                        var analysisResult = new FileAnalysisResultModel()
                        {
                            PresignedUrl = fileUrl,
                            AnalysisText = summary,
                        };

                        await _dbLock.WaitAsync().ConfigureAwait(false);
                        try
                        {
                            _unitOfWork.FileAnalysisResult.Add(analysisResult);
                            await _unitOfWork.CompleteAsync().ConfigureAwait(false);
                        }
                        finally
                        {
                            _dbLock.Release();
                        }
                    }

                    return summary;
                }
                catch (Exception ex)
                {
                    // TODO: custom TooManyRequestsException
                    throw new InvalidOperationException(ex.Message);
                }
            }
            else if (FileUtils.IsPdfFile(contentType))
            {
                try
                {
                    // Ask the service to summarize
                    var summary = await _pdfService.SummarizePdfAsync(fileUrl).ConfigureAwait(false);

                    if (isConnectionStringGood)
                    {
                        var analysisResult = new FileAnalysisResultModel()
                        {
                            PresignedUrl = fileUrl,
                            AnalysisText = summary,
                        };

                        await _dbLock.WaitAsync().ConfigureAwait(false);
                        try
                        {
                            _unitOfWork.FileAnalysisResult.Add(analysisResult);
                            await _unitOfWork.CompleteAsync().ConfigureAwait(false);
                        }
                        finally
                        {
                            _dbLock.Release();
                        }
                    }

                    return summary;
                }
                catch (Exception ex)
                {
                    // TODO: custom TooManyRequestsException
                    throw new InvalidOperationException(ex.Message);
                }
            }
            else
            {
                throw new InvalidDataException("Unsupported link content");
            }
        }
    }
}
