import React, { useState } from "react";
import apiClient from "./apiClient";
import AiVoicePlayer from "./AiVoicePlayer";

const FileUploadAnalyzer = ({ handleLogout, setAnalysisText, cleanAnalysisText }) => {
  const [files, setFiles] = useState([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [analyzeResults, setAnalyzeResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const [fileUrls, setFileUrls] = useState([]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setUploadSuccess(false);
    setAnalyzeResults([]);
    cleanAnalysisText();
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setMessage("");
    cleanAnalysisText();

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      // Also append first file as 'file' for backward compatibility
      formData.append("file", files[0]);

      const res = await apiClient.post("/OpenAIAws/AwsFileUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.status === 200) {
        const urls = res.data.fileUrls || (res.data.fileUrl ? [res.data.fileUrl] : []);
        setFileUrls(urls);
        setUploadSuccess(true);
        setMessage(`${urls.length} file${urls.length > 1 ? "s" : ""} uploaded successfully to S3 ✅`);
      }
    } catch (err) {
      console.error(err);
      setMessage("Upload failed ❌");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!fileUrls || fileUrls.length === 0) return;
    setAnalyzing(true);
    setMessage("");
    try {
      const res = await apiClient.post("/OpenAIAws/GeminiSummary", {
        fileUrls: fileUrls,
        fileUrl: fileUrls[0],
      });

      if (res.status === 200) {
        const results = Array.isArray(res.data) ? res.data : [res.data];
        setAnalyzeResults(results);
        setMessage("Parallel AI analysis complete ✅");
        if (results.length > 0) {
          setAnalysisText(results[0]);
        }
      }
    } catch (err) {
      console.error(err);
      setMessage("Analysis failed ❌");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-xl">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 text-center">AI Multi-File Analyzer</h1>
      <p className="text-xs text-gray-500 mb-4 text-center">Select one or multiple files for concurrent AWS S3 upload and parallel Gemini analysis</p>

      <input
        type="file"
        multiple
        onChange={handleFileChange}
        className="mb-3 block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {files.length > 0 && (
        <p className="text-xs text-gray-600 mb-3 font-medium bg-gray-50 p-2 rounded">
          {files.length} file{files.length > 1 ? "s" : ""} selected: {files.map((f) => f.name).join(", ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || loading}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            files.length === 0 || loading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow"
          }`}
        >
          {loading ? "Uploading..." : `Upload ${files.length > 1 ? `(${files.length})` : ""}`}
        </button>

        <button
          onClick={handleAnalyze}
          disabled={!uploadSuccess || analyzing}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            !uploadSuccess || analyzing
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white shadow"
          }`}
        >
          {analyzing ? "Analyzing in Parallel..." : `Analyze ${fileUrls.length > 1 ? `(${fileUrls.length})` : ""}`}
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-2 px-4 rounded-lg mb-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition text-sm"
      >
        Logout
      </button>

      {message && <p className="mt-2 text-center text-sm font-medium text-gray-700">{message}</p>}

      {analyzeResults.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg border-b pb-2">
            Analysis Results ({analyzeResults.length})
          </h2>
          {analyzeResults.map((result, idx) => {
            const presignedLink = fileUrls[idx];
            let parsed = null;
            if (typeof result === "object" && result !== null) {
              parsed = result;
            } else if (typeof result === "string") {
              try {
                parsed = JSON.parse(result);
              } catch (e) {
                parsed = null;
              }
            }

            return (
              <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    File #{idx + 1} {files[idx]?.name ? `(${files[idx].name})` : ""}
                  </span>
                  {presignedLink && (
                    <a
                      href={presignedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      View on S3 ↗
                    </a>
                  )}
                </div>

                <div className="mb-3">
                  {parsed ? (
                    <div className="text-sm text-gray-800 space-y-1">
                      {parsed.caption && (
                        <p>
                          <span className="font-semibold text-gray-600">Caption:</span> {parsed.caption}
                        </p>
                      )}
                      {parsed.summary && (
                        <p>
                          <span className="font-semibold text-gray-600">Summary:</span> {parsed.summary}
                        </p>
                      )}
                      {parsed.region_guess && (
                        <p>
                          <span className="font-semibold text-gray-600">Region Guess:</span> {parsed.region_guess}
                        </p>
                      )}
                      {parsed.tags && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Array.isArray(parsed.tags) &&
                            parsed.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      )}
                      {!parsed.caption && !parsed.summary && !parsed.region_guess && (
                        <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded border border-gray-100">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {typeof result === "string" ? result : JSON.stringify(result)}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <AiVoicePlayer analysisText={result} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileUploadAnalyzer;
