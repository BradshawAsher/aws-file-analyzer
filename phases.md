# Project Build Phases

This document records the major phases through which AWS File Analyzer was built. It is intended to complement the current-state documentation in [`README.md`](README.md) and [`architecture.md`](architecture.md). The phases are grouped by capability rather than by every individual commit.

## Phase 1: Application foundation

**Dates:** September 25–October 1, 2025  
**Representative commits:** `a8b8238`–`b5e0db3`

The project began as an ASP.NET Core 8 Web API paired with a React frontend. The initial work established the application shell, frontend build configuration, file-upload flow, AWS S3 integration, and validation for missing or invalid bucket configuration.

**Outcome:** A working baseline that could accept files and interact with S3, with basic safeguards around empty buckets and invalid configuration.

## Phase 2: Persistence and data access

**Dates:** October 3–7, 2025  
**Representative commits:** `71418bc`–`4990280`

Azure SQL persistence was introduced for uploaded-file metadata, file history, and AI analysis results. Retrieval endpoints were added, followed by EF Core Generic Repository and Unit of Work abstractions to keep data access separate from controller logic.

**Outcome:** Uploads and analysis results became durable, queryable records instead of transient request data.

## Phase 3: Authentication and account security

**Dates:** October 8–13, 2025  
**Representative commits:** `044b2d7`–`c0f6a79`

The application gained JWT-based authentication, user registration and login endpoints, credential validation, BCrypt password hashing, and duplicate-username protection. Configuration such as the S3 bucket name was also moved out of code and into application settings.

**Outcome:** File analysis could be associated with authenticated users, with passwords stored using salted hashes and access protected by bearer tokens.

## Phase 4: Frontend workflow and user experience

**Dates:** October 15–November 3, 2025  
**Representative commits:** `ea777a1`–`60c7e39`

The React client was reorganized into focused authentication and file-analysis components. Login and registration forms, validation, Axios bearer-token configuration, responsive styling, and clearer upload states were added.

**Outcome:** The core backend capabilities were exposed through a complete sign-in, upload, and analysis workflow in the browser.

## Phase 5: Multimodal AI analysis

**Dates:** November 5–10, 2025  
**Representative commits:** `e4472c3`–`b22b682`

AI output was made structured and predictable through metadata models, strict JSON response formatting, confidence and reasoning fields, and prompt rules for landmarks, outdoor scenes, indoor images, and geographical inference. Support expanded beyond images to PDF text extraction with PdfPig, chunked summarization, and structured summaries for plain-text and HTML files.

**Outcome:** The analyzer evolved from an image-focused feature into a multimodal file-analysis system with consistent result contracts.

## Phase 6: Separation of concerns and performance

**Dates:** November 10, 2025–January 19, 2026  
**Representative commits:** `8431f6e`–`03c453f`

AI analysis logic was extracted from controllers into `FileAnalysisService`, redundant frontend authentication re-renders were removed, and database-backed caching was added to avoid repeating AI calls for previously analyzed files. S3 upload and metadata persistence were then encapsulated in `FileUploadService`.

**Outcome:** The system became easier to maintain, reduced unnecessary AI spend and latency, and gave controllers clearer responsibilities.

## Phase 7: Reliability and documentation

**Dates:** January 20–August 24, 2026  
**Representative commits:** `2ea50c7`–`7108940`

Global exception handling was added for upload, analysis, and GET flows so failures could be returned consistently. The project documentation was then expanded with a system architecture specification, API reference, Mermaid diagrams, screenshots, engineering trade-offs, and interview preparation material.

**Outcome:** The application gained a consistent error boundary and a documented technical baseline for onboarding, review, and future work.

## Phase 8: Multi-cloud deployment and production hardening

**Date:** September 9, 2026

The AI integration was migrated to Google Gemini with a configurable model fallback hierarchy. The React 19 frontend was migrated from deprecated Create React App tooling to Vite and deployed through Cloudflare, while the .NET 8 API, managed secrets, monitoring, and relational persistence were deployed across Azure App Service, Key Vault, Application Insights, and Azure SQL; private object storage remained in AWS S3.

A public guest landing page and short-lived guest JWT flow were added so recruiters can understand the architecture and run one real file through the analyzer without creating a persistent account. Guest uploads and request rates are more restrictive, while account history and bucket-wide operations remain limited to signed-in users. Upload limits, MIME checks, API rate limits, expired-token handling, S3 URL allowlisting, canonical `/api/ai` Swagger routes, and a dedicated GitHub Actions regression workflow were also added.

**Outcome:** The project became a live, recruiter-friendly multi-cloud portfolio application with safer production boundaries and repeatable regression checks.

## Phase 9: Guest claiming, Google OAuth, and full-stack CI/CD automation

**Date:** September 10, 2026

Added seamless guest history claiming (`POST /api/Security/claim-guest-uploads`) and client state handoff so visitors testing the live demo can register or sign in without losing their uploaded files, AI analyses, or voice players. Implemented one-tap Google OAuth 2.0 with automatic account provisioning and immediate JWT session issuance upon standard registration.

Expanded test coverage to 54 automated tests across backend xUnit, Vite/Vitest component tests, and a 7-scenario Playwright headless browser E2E suite. Automated continuous deployment to both Cloudflare Pages (`aws-file-analyzer.pages.dev`) via Wrangler and Azure App Service via secretless GitHub OIDC.

**Outcome:** A seamless, production-ready onboarding experience for recruiters and visitors with complete end-to-end regression validation and automated multi-cloud deployment.

## Current state

The project currently combines:

- Public guest landing page, demo live analyzer, and seamless account claiming upon sign-in/registration
- Dual authentication: BCrypt salted credentials and Google OAuth 2.0 with automated user provisioning
- Immediate auto-login token issuance upon registration (zero re-login friction)
- An ASP.NET Core 8 API on Azure App Service with Azure Key Vault Managed Identity
- AWS S3 private object storage with 60-minute presigned URLs and S3 URL allowlisting
- Azure SQL Serverless persistence with EF Core Unit of Work and 60-minute auto-pause
- Structured Google Gemini Multimodal Vision and LLM fallback hierarchy
- PDF stream extraction with PdfPig and chunked summarization
- Relational result caching eliminating duplicate AI inference costs
- Dual Cloudflare Edge deployments: Cloudflare Pages (`aws-file-analyzer.pages.dev`) and Cloudflare Workers (`aws-file-analyzer.bradshin231.workers.dev`)
- Automated CI/CD: 54-test regression matrix (.NET xUnit, Vitest, Playwright E2E) and secretless Azure OIDC deployment

Future work is tracked in [`future_work.md`](future_work.md), while this document should be updated when a new architectural phase is completed or an existing phase changes materially.

