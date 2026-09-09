using Amazon.S3;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using OpenAiChat.Controllers;
using OpenAiChat.Dto;
using OpenAiChat.Repository;
using OpenAiChat.Services;
using System.Text;
using Xunit;

namespace OpenAiChat.Tests
{
    public class OpenAIAwsControllerTests
    {
        private readonly Mock<IAmazonS3> _mockS3;
        private readonly Mock<IGeminiChatClient> _mockChat;
        private readonly Mock<ILogger<OpenAIAwsController>> _mockLogger;
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly Mock<IConfiguration> _mockConfig;
        private readonly Mock<IFileAnalysisService> _mockAnalysisService;
        private readonly Mock<IFileUploadService> _mockUploadService;
        private readonly OpenAIAwsController _controller;

        public OpenAIAwsControllerTests()
        {
            _mockS3 = new Mock<IAmazonS3>();
            _mockChat = new Mock<IGeminiChatClient>();
            _mockLogger = new Mock<ILogger<OpenAIAwsController>>();
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _mockConfig = new Mock<IConfiguration>();
            _mockAnalysisService = new Mock<IFileAnalysisService>();
            _mockUploadService = new Mock<IFileUploadService>();

            _controller = new OpenAIAwsController(
                _mockS3.Object,
                _mockChat.Object,
                _mockLogger.Object,
                _mockUnitOfWork.Object,
                _mockConfig.Object,
                _mockAnalysisService.Object,
                _mockUploadService.Object
            );
        }

        [Fact]
        public async Task FileUpload_WithMultipleFiles_UploadsConcurrentlyAndReturnsAllUrls()
        {
            var file1 = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("file 1")), 0, 6, "files", "file1.txt")
            {
                Headers = new HeaderDictionary(),
                ContentType = "text/plain"
            };
            var file2 = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("file 2")), 0, 6, "files", "file2.txt")
            {
                Headers = new HeaderDictionary(),
                ContentType = "text/plain"
            };
            var files = new List<IFormFile> { file1, file2 };

            var expectedUrls = new List<string> { "https://s3.amazonaws.com/test/file1.txt", "https://s3.amazonaws.com/test/file2.txt" };
            _mockUploadService.Setup(s => s.UploadFilesAsync(files))
                .ReturnsAsync(expectedUrls);

            var result = await _controller.FileUpload(files);

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);

            var resType = okResult.Value.GetType();
            var countProp = resType.GetProperty("count")?.GetValue(okResult.Value);
            var fileUrlProp = resType.GetProperty("fileUrl")?.GetValue(okResult.Value);
            var fileUrlsProp = resType.GetProperty("fileUrls")?.GetValue(okResult.Value) as List<string>;

            Assert.Equal(2, countProp);
            Assert.Equal("https://s3.amazonaws.com/test/file1.txt", fileUrlProp);
            Assert.Equal(expectedUrls, fileUrlsProp);
        }

        [Fact]
        public async Task FileUpload_WithTooManyFiles_ReturnsBadRequestWithoutUploading()
        {
            var files = Enumerable.Range(1, 6)
                .Select(index => (IFormFile)new FormFile(
                    new MemoryStream(Encoding.UTF8.GetBytes($"file {index}")),
                    0,
                    6,
                    "files",
                    $"file{index}.txt")
                {
                    Headers = new HeaderDictionary(),
                    ContentType = "text/plain"
                })
                .ToList();

            var result = await _controller.FileUpload(files);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Upload at most 5 files at a time.", badRequest.Value);
            _mockUploadService.Verify(service => service.UploadFilesAsync(It.IsAny<List<IFormFile>>()), Times.Never);
        }

        [Fact]
        public async Task FileUpload_WithUnsupportedContentType_ReturnsBadRequestWithoutUploading()
        {
            var file = new FormFile(new MemoryStream([1, 2, 3]), 0, 3, "files", "archive.zip")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/zip"
            };

            var result = await _controller.FileUpload([file]);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Only PNG, JPEG, GIF, plain text, HTML, and PDF files are supported.", badRequest.Value);
            _mockUploadService.Verify(service => service.UploadFilesAsync(It.IsAny<List<IFormFile>>()), Times.Never);
        }

        [Fact]
        public async Task SummarizeFile_WithBatchUrls_AnalyzesConcurrentlyAndReturnsResults()
        {
            var urls = new List<string> { "https://s3.amazonaws.com/test/img1.jpg", "https://s3.amazonaws.com/test/doc1.txt" };
            var expectedAnalyses = new List<string> { "{\"caption\":\"Beach\"}", "{\"summary\":\"Document text\"}" };

            _mockAnalysisService.Setup(s => s.AnalyzeFilesAsync(urls))
                .ReturnsAsync(expectedAnalyses);

            var request = new OpenAISummaryRequest { fileUrls = urls };
            var result = await _controller.SummarizeFile(request);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var actualList = Assert.IsType<List<string>>(okResult.Value);
            Assert.Equal(2, actualList.Count);
            Assert.Equal("{\"caption\":\"Beach\"}", actualList[0]);
            Assert.Equal("{\"summary\":\"Document text\"}", actualList[1]);
        }

        [Fact]
        public async Task SummarizeFile_WithSingleUrl_ReturnsSingleResultString()
        {
            var singleUrl = "https://s3.amazonaws.com/test/doc1.txt";
            var expectedAnalysis = "{\"summary\":\"Single document summary\"}";

            _mockAnalysisService.Setup(s => s.AnalyzeFileAsync(singleUrl))
                .ReturnsAsync(expectedAnalysis);

            var request = new OpenAISummaryRequest { fileUrl = singleUrl };
            var result = await _controller.SummarizeFile(request);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var actualResult = Assert.IsType<string>(okResult.Value);
            Assert.Equal(expectedAnalysis, actualResult);
        }
    }
}
