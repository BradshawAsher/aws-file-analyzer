# Technical Interview Preparation & Project Defense Guide
## Project: AWS File Analyzer

This guide contains the exact talking points, architectural explanations, edge cases, and technical Q&A you need to ace software engineering interviews when discussing this project.

---

## 🎯 1. The 30-Second Elevator Pitch

> *"AWS File Analyzer is an end-to-end cloud platform built with ASP.NET Core 8 and React that automates file ingestion, multimodal AI analysis, and audio synthesis. When a user uploads documents or photos, the backend streams them to private AWS S3 buckets, generates secure Pre-Signed URLs, and routes them through specialized analysis engines. For images, we use Google Gemini multimodal vision to detect landmarks, weather, and geolocation with confidence scores. For PDFs, we use PdfPig and a 4KB chunking algorithm to extract structured summaries. To optimize performance and eliminate redundant LLM token costs, we implemented an Azure SQL caching layer and integrated browser-native Web Speech API for interactive audio playback."*

---

## 💡 2. Core Architecture & System Design Questions

### Q1: Can you walk me through the end-to-end lifecycle of a file upload?
**Answer**:
1. **Client Action**: The user selects a file in the React frontend. The client sends a `multipart/form-data` request with an `Authorization: Bearer <JWT>` header to `POST /OpenAIAws/AwsFileUpload`.
2. **Backend Processing**: `FileUploadService` receives the `IFormFile`, initiates an upload to Amazon S3 via `AmazonS3Client.PutObjectAsync`, and generates a Pre-Signed URL with a 60-minute TTL (`GetPreSignedUrlRequest`).
3. **Metadata Logging**: File metadata (name, extension, size, load time, presigned URL) is saved to the `FileUploadHistory` table via Entity Framework Core using the Unit of Work pattern.
4. **Analysis Dispatch**: The client triggers `POST /OpenAIAws/GeminiSummary` (or legacy `/OpenAISummary`) passing the `fileUrl`.
5. **MIME Routing & Cache Check**: `FileAnalysisService` first queries the `FileAnalysisResult` table in Azure SQL. If a record exists (Cache Hit), it returns the cached JSON immediately. If not (Cache Miss), it inspects the HTTP `Content-Type` header and delegates to `ImageService`, `PdfService`, or `TextService`.
6. **AI Analysis**: For images, Google Gemini (`gemini-3.1-flash-lite`) processes the image data URI. For PDFs, `PdfPig` extracts the text stream and chunks it before calling Gemini.
7. **Persistence & Playback**: The JSON analysis is saved to Azure SQL and returned to the React frontend, which feeds the summary/caption to `AiVoicePlayer` via the Web Speech API (`SpeechSynthesisUtterance`).

---

### Q2: Why and how did you migrate from OpenAI to Google Gemini?
**Answer**:
* **Why**: OpenAI API keys and older models periodically deprecate or expire, creating operational overhead and higher token costs. Google Gemini (`gemini-3.1-flash-lite`, `gemini-3.6-flash`) provides superior multimodal reasoning, ultra-fast latency, lower pricing, and an expanded context window.
* **How (Zero-Downtime Migration Pattern)**:
  1. **OpenAI Compatibility Layer**: Google Gemini provides an OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`). Rather than refactoring every single service call, we re-pointed the .NET `OpenAIClientOptions.Endpoint` to Gemini's gateway.
  2. **Image Inlining Optimization**: While OpenAI accepted remote image URLs, Gemini strictly requires inline base64 Data URIs for remote assets for security. We enhanced `ImageService` to download the S3 pre-signed image stream and pass `ChatMessageContentPart.CreateImagePart(BinaryData, mediaType)`, which serializes seamlessly to Data URIs.
  3. **Backward Compatibility**: We kept existing controller route endpoints (`/OpenAISummary`, `/OpenAIChat`) while adding clean aliases (`/GeminiSummary`, `/GeminiChat`), preventing client-side breakage.
  4. **Credential Security**: Credentials were moved into ASP.NET Core User Secrets (`Gemini:ApiKey`), ensuring no secret keys are checked into source control.

---

### Q3: Why did you use S3 Pre-Signed URLs instead of streaming binary files directly through your API?
**Answer**:
* **Memory & Throughput**: Streaming large images or multi-page PDFs through backend web servers consumes significant server RAM and thread pool capacity. Pre-signed URLs offload file hosting and download bandwidth directly to AWS S3.
* **Security**: The S3 bucket remains completely private (no public access). Pre-signed URLs are cryptographically signed with temporary expiration windows (60 minutes), enforcing least privilege.
* **Separation of Concerns**: The API server acts as an orchestrator rather than a heavy binary proxy.

---

### Q4: How did you implement caching, and what problem does it solve?
**Answer**:
* **Problem**: Invoking multimodal LLM endpoints repeatedly for the same uploaded assets introduces latency (1–3 seconds per request) and racks up expensive API token fees.
* **Solution**: In `FileAnalysisService`, before sending any request to the AI model, we query the `FileAnalysisResult` table joined on the unique file URL.
* **Result**: Repeat analysis requests return in under 10ms with zero AI inference cost.

---

### Q5: How do you handle large PDF documents that exceed LLM context windows?
**Answer**:
* We implemented a **two-tier chunking strategy** in `PdfService.cs`:
  1. We extract text streams using `UglyToad.PdfPig`.
  2. If the text length is under `12,000` characters, we send it in a single prompt.
  3. If it exceeds `12,000` characters, we partition the text into `4,000`-byte chunks using `.Chunk(4000)`.
  4. Each chunk is summarized individually by the LLM into key points.
  5. Finally, we concatenate the partial summaries and run an aggregation prompt that synthesizes a cohesive JSON response with overall caption, summary, keywords, and sentiment.

---

## 🔒 3. Security, Authentication & Data Access Questions

### Q6: How is authentication and user authorization handled?
**Answer**:
* **Password Hashing**: We use `BCrypt.Net-Next` with automatic salt generation to hash user passwords during registration. BCrypt's adaptive hashing algorithm prevents rainbow table and brute-force attacks.
* **JWT Tokens**: Upon valid credential verification, `SecurityController` issues a signed JWT containing claims (`name`, `role`, `jti`, expiration).
* **Authorization Middleware**: Secured endpoints are annotated with `[Authorize]`. The ASP.NET Core JWT bearer authentication middleware validates the signature on every incoming request.
* **Client Handling**: The React app stores the token in `localStorage` and configures an Axios interceptor / default header to attach `Bearer <token>` to all API calls.

---

### Q7: Why did you choose the Repository and Unit of Work patterns over using `DbContext` directly in controllers?
**Answer**:
* **Separation of Concerns**: Controllers only interact with high-level service contracts (`IFileUploadService`, `IFileAnalysisService`) without worrying about database queries.
* **Transaction Integrity**: The `IUnitOfWork` ensures that multiple repository operations (e.g. saving upload metadata and saving analysis results) can be committed within a single database transaction (`CompleteAsync()`).
* **Testability**: It allows us to easily mock `IUnitOfWork` and `IGenericRepository` in unit tests without spinning up a real SQL database.

---

## ⚡ 4. Edge Cases, Failure Modes & Engineering Trade-offs

### Q8: What happens if an unsupported or corrupted file is uploaded?
**Answer**:
* `FileUtils.IsFileUrlValid` validates the URL structure.
* In `FileAnalysisService`, we perform a lightweight `HEAD` / `GET` header request to inspect `Content-Type`. If the MIME type is unrecognized or unsupported, the service throws an `InvalidDataException` with a descriptive message.
* Global exception handling middleware catches the exception and returns a structured `400 Bad Request` or `500 Internal Server Error` response instead of crashing the process or leaking stack traces.

---

### Q9: What are the bottlenecks in this architecture, and how would you scale it?
**Answer**:
* **Current Bottleneck**: Synchronous HTTP calls to external LLMs can take 1–3 seconds during peak traffic. If 1,000 users upload simultaneously, HTTP request threads could get exhausted.
* **Scaling Solution (Event-Driven Architecture)**:
  1. **Asynchronous Ingestion**: When a file hits S3, trigger an **S3 Event Notification** to an **AWS SQS** queue.
  2. **Worker Processing**: An **AWS Lambda** function or background worker consumes the queue, processes the analysis asynchronously, and writes results to Azure SQL / DynamoDB.
  3. **Real-time Push**: Use **SignalR** or **WebSockets** to notify the React frontend when analysis completes.

---

## 🗣️ 5. Behavioral & Ownership Questions

### Q10: *"How did you work on this project and what was your role?"*
**Answer**:
> *"This project started as a collaborative initiative where my dad and I explored AWS cloud architectures together. As the project grew, I took full ownership of the codebase: I modernized the .NET 8 backend architecture, implemented the Repository and Unit of Work pattern, integrated JWT authentication with BCrypt hashing, engineered the PDF text extraction and chunking pipeline with PdfPig, migrated the AI analysis provider from OpenAI to Google Gemini, built the React frontend with Tailwind CSS, and added the client-side audio narration engine."*

---

### Q11: *"If you had another two weeks to work on this, what would you build?"*
**Answer**:
1. **Interactive Geolocation Map**: Plot image landmark coordinates directly onto an interactive Mapbox/Leaflet UI to create an automated travel photo timeline.
2. **Vector Embeddings & Semantic Search**: Index parsed PDF and text summaries using Gemini Embeddings (`models/gemini-embedding-2`) and store them in a vector database (e.g. pgvector or Azure AI Search) for natural language semantic search across all uploaded files.
3. **Automated CI/CD**: Add GitHub Actions pipelines for automated linting, security scanning, and unit testing with `xUnit` and LocalStack.
