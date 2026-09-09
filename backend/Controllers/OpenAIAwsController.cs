using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OpenAI.Chat;
using OpenAiChat.Dto;
using OpenAiChat.Repository;
using OpenAiChat.Services;

namespace OpenAiChat.Controllers
{
    [ApiController]
    [Route("[controller]")]
    [Route("GeminiAws")]
    [Route("api/ai")]
    [Authorize]
    [EnableRateLimiting("ai")]
    public class OpenAIAwsController : ControllerBase
    {
        private const int MaxFileCount = 5;
        private const long MaxFileSizeBytes = 5 * 1024 * 1024;
        private static readonly HashSet<string> AllowedUploadTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/png",
            "image/jpeg",
            "image/gif",
            "text/plain",
            "text/html",
            "application/pdf"
        };

        private readonly ILogger<OpenAIAwsController> _logger;
        private readonly IGeminiChatClient _chatClient;
        private readonly IAmazonS3 _s3Client;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration _configuration;
        private readonly IFileAnalysisService _fileAnalysisService;
        private readonly IFileUploadService _fileUploadService;

        public OpenAIAwsController(
            IAmazonS3 s3Client,
            IGeminiChatClient chatClient,
            ILogger<OpenAIAwsController> logger,
            IUnitOfWork unitOfWork,
            IConfiguration configuration,
            IFileAnalysisService fileAnalysisService,
            IFileUploadService fileUploadService)
        {
            _s3Client = s3Client;
            _chatClient = chatClient;
            _logger = logger;
            _unitOfWork = unitOfWork;
            _configuration = configuration;
            _fileAnalysisService = fileAnalysisService;
            _fileUploadService = fileUploadService;
        }

        /// <summary>
        ///  List file name and presigned url under s3 bucket name
        /// </summary>
        /// <returns></returns>
        /// [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(string))] // Success response map (fileName/presigned url)
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: wrong bucket
        /// [ProducesResponseType(StatusCodes.Status500InternalServerError)] // 500: internal server error
        [HttpGet("ListS3Files")]
        public async Task<IActionResult> GetS3FilesUrls()
        {
            string bucketName = _configuration["AWS:S3BucketName"];

            if (string.IsNullOrWhiteSpace(bucketName))
            {
                return BadRequest("Empty bucket name");
            }

            var files = new Dictionary<string, string>();
            var request = new ListObjectsV2Request
            {
                BucketName = bucketName
            };

            ListObjectsV2Response response;
            do
            {
                response = await _s3Client.ListObjectsV2Async(request);
                if (response != null)
                {
                    if (response.S3Objects != null)
                    {
                        foreach (var s3Object in response.S3Objects)
                        {
                            var preSignedUrl = await GeneratePreSignedUrl(s3Object.Key, 60, bucketName);

                            files[s3Object.Key] = preSignedUrl;
                        }
                    }

                    request.ContinuationToken = response.NextContinuationToken;
                }
                    
            } while (response != null && response.IsTruncated != null ? (bool)(response.IsTruncated) : false);

            return Ok(files);
        }

        /// <summary>
        ///  List file loaded last few days
        /// </summary>
        /// <param name="days">how many days ahead</param>
        /// <param name="filesLimit">how many files to display</param>
        /// <returns>Status code of each file load record</returns>
        /// [ProducesResponseType(StatusCodes.Status200OK // Success response file list
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: invalid input or wrong connection string
        /// [ProducesResponseType(StatusCodes.Status404NotFound)] // 404: no files loaded
        /// [ProducesResponseType(StatusCodes.Status500InternalServerError)] // 500: internal server error
        [HttpGet("ListLoadHistory")]
        public async Task<IActionResult> GetLoadHistory([FromQuery]int days=1, [FromQuery]int filesLimit=30)
        {
            if (days <= 0 || filesLimit <= 0)
            {
                return BadRequest($"Invalid input!");
            }

            var now = DateTimeOffset.UtcNow;
            var fromDate = now.AddDays(-days);
            
            // Test connection string
            bool isConnectionStringGood = await _unitOfWork.IsDbConnectionStringGood().ConfigureAwait(false);

            if (!isConnectionStringGood)
            {
                return BadRequest($"Connection string is wrong!");
            }

            // Only take several files
            var result = await _unitOfWork.FileUploadHistory
                .Find(f => f.LoadTime >= fromDate && f.LoadTime <= now)
                .Take(filesLimit)
                .ToListAsync()
                .ConfigureAwait(false);

            if (result != null && result.Any())
            {
                return Ok(result);
            }

            return NotFound($"No files loaded last {days}");
        }

        /// <summary>
        ///  List all analyzed files
        /// </summary>
        /// <returns>Status code</returns>
        /// [ProducesResponseType(StatusCodes.Status200OK // Success response parsed files
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: wrong connection string
        /// [ProducesResponseType(StatusCodes.Status404NotFound)] // 404: no files loaded
        /// [ProducesResponseType(StatusCodes.Status500InternalServerError)] // 500: internal server error
        [HttpGet("ListAnalysisResults")]
        public async Task<IActionResult> GetAnalysisResults()
        {
            // Test connection string
            bool isConnectionStringGood = await _unitOfWork.IsDbConnectionStringGood().ConfigureAwait(false);

            if (!isConnectionStringGood)
            {
                return BadRequest($"Connection string is wrong!");
            }

            var query = from a in _unitOfWork.FileUploadHistory.GetDbSet()
                        join b in _unitOfWork.FileAnalysisResult.GetDbSet()
                        on a.PresignedUrl equals b.PresignedUrl
                        select new
                        {
                            a.LocalFileName,
                            a.FileExtension,
                            b.AnalysisText
                        };
            var results = await query.ToListAsync()
                .ConfigureAwait(false);

            if (results != null && results.Any())
            {
                return Ok(results);
            }

            return NotFound($"No files analyzed");
        }

        /// <summary>
        ///  Upload one or multiple files to AWS S3 concurrently
        /// </summary>
        /// <param name="files">One or more files to upload</param>
        /// <returns>Status code of upload status with presigned urls</returns>
        [HttpPost("AwsFileUpload")]
        [HttpPost("UploadFiles")]
        [HttpPost("UploadFile")]
        public async Task<IActionResult> FileUpload([FromForm] List<IFormFile> files)
        {
            if ((files == null || files.Count == 0) && Request.HasFormContentType && Request.Form.Files.Count > 0)
            {
                files = Request.Form.Files.ToList();
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest("File is empty or not provided.");
            }

            if (files.Count > MaxFileCount)
            {
                return BadRequest($"Upload at most {MaxFileCount} files at a time.");
            }

            if (files.Any(file => file.Length <= 0 || file.Length > MaxFileSizeBytes))
            {
                return BadRequest("Each file must be between 1 byte and 5 MB.");
            }

            if (files.Any(file => !AllowedUploadTypes.Contains(file.ContentType)))
            {
                return BadRequest("Only PNG, JPEG, GIF, plain text, HTML, and PDF files are supported.");
            }

            var presignedUrls = await _fileUploadService.UploadFilesAsync(files);
            var firstUrl = presignedUrls.FirstOrDefault() ?? string.Empty;

            return Ok(new
            {
                fileUrl = firstUrl,
                fileUrls = presignedUrls,
                count = presignedUrls.Count
            });
        }

        /// <summary>
        ///  Analyze image url geolocation information or text/pdf url summary (single or parallel batch)
        /// </summary>
        /// <param name="request">Request with fileUrl or fileUrls list</param>
        /// <returns>status code with analysis string or list of strings</returns>
        [HttpPost("OpenAISummary")]
        [HttpPost("GeminiSummary")]
        [HttpPost("AnalyzeSummary")]
        [HttpPost("AnalyzeFiles")]
        public async Task<IActionResult> SummarizeFile([FromBody] OpenAISummaryRequest request)
        {
            var urls = new List<string>();
            bool isBatchRequest = request?.fileUrls != null && request.fileUrls.Count > 0;

            if (isBatchRequest)
            {
                urls.AddRange(request!.fileUrls!.Where(u => !string.IsNullOrWhiteSpace(u)));
            }
            else if (!string.IsNullOrWhiteSpace(request?.fileUrl))
            {
                urls.Add(request.fileUrl);
            }

            if (urls.Count == 0)
            {
                return BadRequest("No request url entered!");
            }

            if (isBatchRequest)
            {
                var batchResults = await _fileAnalysisService.AnalyzeFilesAsync(urls);
                return Ok(batchResults);
            }

            var singleResult = await _fileAnalysisService.AnalyzeFileAsync(urls[0]);
            return Ok(singleResult);
        }

        /// <summary>
        ///  Complete prompt
        /// </summary>
        /// <param name="prompt"></param>
        /// <returns></returns>
        /// [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(string))] // Success reply string
        /// [ProducesResponseType(StatusCodes.Status400BadRequest)] // 400: empty prompt
        /// [ProducesResponseType(StatusCodes.Status429TooManyRequests)] // 429: too many requests
        [HttpPost("OpenAIChat")]
        [HttpPost("GeminiChat")]
        public async Task<IActionResult> CompleteChat([FromBody] string prompt)
        {
            if (string.IsNullOrWhiteSpace(prompt))
            {
                return BadRequest("No prompt entered!");
            }

            ChatCompletion completion = await _chatClient.CompleteChatAsync(prompt).ConfigureAwait(false);
            return Ok(completion.Content[0].Text);
        }

        private async Task<string> GeneratePreSignedUrl(string objectKey, double durationInMinutes, string bucketName)
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucketName,
                Key = objectKey,
                Expires = DateTime.UtcNow.AddMinutes(durationInMinutes),
                Verb = HttpVerb.GET // Use HttpVerb.PUT for uploads
            };

            string preSignedUrl = await _s3Client.GetPreSignedURLAsync(request);

            return preSignedUrl;
        }

    }
}

