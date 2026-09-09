using OpenAiChat.Utils;
using Xunit;

namespace OpenAiChat.Tests;

public sealed class FileUtilsTests
{
    [Fact]
    public void IsAllowedS3Url_AcceptsConfiguredRegionalBucket()
    {
        var result = FileUtils.IsAllowedS3Url(
            "https://aws-file-analyzer-bd3b69e5.s3.us-east-2.amazonaws.com/file.pdf?X-Amz-Signature=test",
            "aws-file-analyzer-bd3b69e5",
            "us-east-2");

        Assert.True(result);
    }

    [Theory]
    [InlineData("http://aws-file-analyzer-bd3b69e5.s3.us-east-2.amazonaws.com/file.pdf")]
    [InlineData("https://127.0.0.1/internal")]
    [InlineData("https://aws-file-analyzer-bd3b69e5.s3.us-east-2.amazonaws.com.evil.example/file.pdf")]
    [InlineData("https://other-bucket.s3.us-east-2.amazonaws.com/file.pdf")]
    public void IsAllowedS3Url_RejectsUntrustedDestinations(string url)
    {
        var result = FileUtils.IsAllowedS3Url(
            url,
            "aws-file-analyzer-bd3b69e5",
            "us-east-2");

        Assert.False(result);
    }
}
