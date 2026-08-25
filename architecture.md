# System Architecture & Technical Specification: AWS File Analyzer

## 1. System Overview

**AWS File Analyzer** is an end-to-end cloud-native document intelligence and multimodal media analysis platform. It enables users to ingest unstructured multi-format files (images, PDFs, text documents) into Amazon S3, routes content through specialized AI processing engines via OpenAI, persists metadata and cached intelligence in Azure SQL Database, and narrates extracted insights via browser-native speech synthesis.

---

## 2. End-to-End Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Frontend)"]
        UI["React 18 SPA (Tailwind CSS v3)"]
        AuthCtx["JWT Auth State (LocalStorage)"]
        TTS["Web Speech API (SpeechSynthesisUtterance)"]
    end

    subgraph ApiGateway [".NET 8 Web API Backend"]
        SecCtrl["SecurityController (BCrypt + JWT Generator)"]
        MainCtrl["OpenAIAwsController (REST Endpoints)"]
        
        subgraph Middleware ["Middleware & Pipeline"]
            JwtMiddleware["JWT Bearer Authentication Handler"]
            GlobalEx["Global Exception Filter"]
        end

        subgraph ServiceLayer ["Service Layer"]
            UploadSvc["FileUploadService"]
            AnalysisRouter["FileAnalysisService (MIME Router)"]
            
            subgraph Analyzers ["Specialized Analyzers"]
                ImgSvc["ImageService (GPT-4o Vision)"]
                PdfSvc["PdfService (PdfPig + 4KB Chunking Engine)"]
                TxtSvc["TextService (Text Summarizer)"]
            end
        end

        subgraph DataAccessLayer ["Data Access Layer"]
            UoW["Unit of Work Pattern (IUnitOfWork)"]
            GenRepo["Generic Repository Pattern (IGenericRepository)"]
            EFCore["Entity Framework Core 8"]
        end
    end

    subgraph ExternalCloud ["Cloud & External Services"]
        S3Bucket[("AWS S3 Bucket (Object Storage)")]
        AzureSqlDb[("Azure SQL Database (Relational Store & Cache)")]
        OpenAiApi["OpenAI API (GPT-4o Multimodal Vision & Chat)"]
    end

    %% Client Auth Flow
    UI -->|1. Register/Login Credentials| SecCtrl
    SecCtrl -->|Validate & Hash with BCrypt| UoW
    SecCtrl -->|Issue Access & Refresh Tokens| AuthCtx

    %% Upload Flow
    UI -->|2. Multipart IFormFile + Bearer Token| MainCtrl
    MainCtrl --> UploadSvc
    UploadSvc -->|3. PutObjectAsync| S3Bucket
    UploadSvc -->|4. Generate Pre-Signed URL (60-min TTL)| S3Bucket
    UploadSvc -->|5. Save FileUploadHistory Entity| UoW
    UoW -->|Commit Transaction| EFCore
    EFCore --> AzureSqlDb

    %% Analysis Flow
    UI -->|6. Trigger Analysis (fileUrl)| MainCtrl
    MainCtrl --> AnalysisRouter
    AnalysisRouter -->|7. Query Existing Analysis (Cache Check)| UoW
    UoW -.->|Cache Hit: Return Cached JSON| AzureSqlDb
    
    AnalysisRouter -->|8. Cache Miss: Inspect Content-Type Header| Analyzers
    ImgSvc -->|Pass Pre-Signed URL & Strict JSON Prompt| OpenAiApi
    PdfSvc -->|Stream Binary, Extract Text & Chunk| OpenAiApi
    TxtSvc -->|Fetch String & Summarize| OpenAiApi

    Analyzers -->|9. Save FileAnalysisResult Entity| UoW
    AnalysisRouter -->|10. Return Structured JSON Payload| UI
    UI -->|11. Synthesize Caption/Summary to Audio| TTS
```

---

## 3. Component Architecture & Responsibility Matrix

### 3.1. Frontend Architecture (`/frontend`)
* **Framework**: React 18 with functional components and React Hooks (`useState`, `useEffect`).
* **Styling**: Tailwind CSS v3 for responsive component styling.
* **HTTP Client**: Axios with global `Authorization: Bearer <token>` header injection.
* **Key Components**:
  * `App.js`: Root container orchestrating token verification, authentication state, and main view conditional rendering.
  * `AuthContainer.js` / `LoginForm.js` / `RegisterForm.js`: Handles user credential submission, error messaging, and token storage in `localStorage`.
  * `FileUploadAnalyze.js`: Drag-and-drop / file selector, upload progress indicator, presigned URL storage, and analysis triggering.
  * `AiVoicePlayer.js`: Audio player component invoking `window.speechSynthesis` (`SpeechSynthesisUtterance`) to play back the image caption or document summary.

---

### 3.2. Backend Architecture (`/backend`)
* **Framework**: ASP.NET Core 8 Web API (C#) using Dependency Injection and standard middleware pipeline.
* **Controllers**:
  * `SecurityController`:
    * `POST /api/Security/register`: Verifies user uniqueness and stores BCrypt salted password hashes.
    * `POST /api/Security/login`: Verifies credentials and generates JWT access token and refresh token.
  * `OpenAIAwsController`:
    * `POST /OpenAIAws/AwsFileUpload`: Receives `IFormFile`, pushes to S3, returns generated Pre-Signed URL.
    * `POST /OpenAIAws/OpenAISummary`: Inspects URL, checks SQL cache, delegates to analyzer service, returns structured JSON.
    * `GET /OpenAIAws/ListS3Files`: Lists objects in S3 bucket with renewed pre-signed URLs.
    * `GET /OpenAIAws/ListLoadHistory`: Queries DB for uploaded files in the last $N$ days.
    * `GET /OpenAIAws/ListAnalysisResults`: Joins `FileUploadHistory` with `FileAnalysisResult`.
* **Services**:
  * `FileUploadService`: Wraps AWS SDK `AmazonS3Client` operations and database history logging.
  * `FileAnalysisService`: Master router detecting MIME types and delegating to specialized engines.
  * `ImageService`: Formats multimodal OpenAI prompts requiring structured JSON geolocation/landmark output.
  * `PdfService`: Uses `UglyToad.PdfPig` for binary extraction and applies chunking for documents $> 12,000$ characters.
  * `TextService`: Summarizes plain text and HTML payloads.
* **Data Access & Persistence**:
  * `GenericRepository<T>` & `UnitOfWork`: Encapsulates EF Core `DbContext` interactions behind an abstraction layer.
  * `ApplicationDbContext`: Defines `DbSet<UserLoginModel>`, `DbSet<FileUploadModel>`, and `DbSet<FileAnalysisResultModel>`.

---

## 4. Detailed Data Schemas

### 4.1. Relational Database Schema (Azure SQL / Entity Framework Core)

#### `UserLogin` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `int` | PK, Identity | Unique user ID |
| `Username` | `nvarchar(max)` | Not Null | User login name |
| `Password` | `nvarchar(max)` | Not Null | BCrypt salted password hash |

#### `FileUploadHistory` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `int` | PK, Identity | Upload event ID |
| `LocalFileName` | `nvarchar(max)` | Not Null | Original filename |
| `FileExtension` | `nvarchar(max)` | Not Null | `.jpg`, `.pdf`, `.txt`, etc. |
| `FileSize` | `bigint` | Not Null | File size in bytes |
| `LoadTime` | `datetimeoffset` | Not Null | UTC timestamp of upload |
| `PresignedUrl` | `nvarchar(max)` | Not Null | S3 Pre-signed URL |

#### `FileAnalysisResult` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Id` | `int` | PK, Identity | Result record ID |
| `PresignedUrl` | `nvarchar(max)` | Not Null, Indexed | Key linking analysis to file |
| `AnalysisText` | `nvarchar(max)` | Not Null | JSON response payload from OpenAI |

---

### 4.2. Structured JSON Output Contracts

#### Image Analysis Schema (GPT-4o Vision)
```json
{
  "city": "string | null",
  "region": "string | null",
  "country": "string | null",
  "landmark": "string | null",
  "weather": "string | null",
  "category": "string",
  "caption": "string | null",
  "confidence": "float (0.0 - 1.0)",
  "justification": "string | null"
}
```

#### Document / PDF Analysis Schema
```json
{
  "caption": "string (one sentence overall topic)",
  "summary": "string (2-3 sentences core points)",
  "highlights": ["string"],
  "keywords": ["string"],
  "sentiment": "positive | neutral | negative"
}
```

---

## 5. Key Design Decisions & Architectural Trade-offs

| Decision | Chosen Approach | Alternative Considered | Rationale / Trade-off |
| :--- | :--- | :--- | :--- |
| **Media Delivery to LLM** | AWS S3 Pre-Signed URLs (60-min TTL) | Streaming raw byte streams through backend RAM | Eliminates server memory bloat for multi-MB files; allows OpenAI and clients to fetch directly from S3. |
| **LLM Caching Layer** | Relational Cache Table in Azure SQL | Redis in-memory cache or no cache | High cost savings on repeat queries; using existing Azure SQL database simplifies deployment without requiring extra Redis infra. |
| **Large Document Handling** | Stream parsing (`PdfPig`) + 4KB chunking | Sending full raw text in single prompt | Prevents context window overflows, lowers token costs per chunk, and increases summary precision. |
| **Password Security** | BCrypt hashing with auto-salting | SHA-256 or plain PBKDF2 | BCrypt includes adaptive work factors resistant to GPU brute-force attacks. |
| **Design Pattern** | Repository & Unit of Work | Direct DbContext calls in controllers | Decouples business logic from EF Core; simplifies mocking for unit testing. |

---

## 6. Security Architecture

1. **Authentication**: Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256 containing expiration times.
2. **Access Delegation**: S3 buckets remain strictly private with public access blocked; access is granted only via cryptographic pre-signed URLs.
3. **Password Storage**: Passwords are never stored in plaintext; hashed with work factor $\ge 11$ using BCrypt.
4. **Endpoint Protection**: All data endpoints protected via `[Authorize]` attributes requiring valid Bearer tokens.
