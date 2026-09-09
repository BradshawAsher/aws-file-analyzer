# Future Work

This roadmap captures improvements that would make AWS File Analyzer more useful while preserving its value as a focused multi-cloud portfolio project.

## Next Up

### Photo gallery and collections

Add a visual library for uploaded images so users can browse prior work instead of treating each upload as a one-time action.

- Generate lightweight thumbnails after upload and keep original files private in AWS S3.
- Group images into named collections with cover images, descriptions, and created/updated timestamps.
- Store collection membership, image metadata, and ownership in Azure SQL.
- Add search and filters for Gemini-generated tags, file type, upload date, and likely location.
- Display EXIF details and an optional map when location metadata is available.
- Use short-lived presigned URLs so gallery access does not require making the S3 bucket public.
- Support bulk selection, re-analysis, moving images between collections, and deleting owned files.

## Product Improvements

- Add automatic cleanup for objects uploaded through short-lived guest sessions.
- Build upload and analysis history pages with pagination and clear processing states.
- Add user-facing retry controls when Gemini rate limits trigger the model fallback hierarchy.
- Stream longer analysis responses and show which fallback model completed the request.
- Add account settings, token revocation, password reset, and optional passkey authentication.
- Improve mobile layouts and add dark/light theme preferences.

### Connected photo sources

Let users analyze photos they already keep in cloud libraries instead of downloading and uploading each file manually.

- Add an explicit OAuth-based picker for importing selected items from Google Photos.
- Add OneDrive and SharePoint photo selection through Microsoft Graph, followed by other providers such as Dropbox where their APIs and permissions fit the privacy model.
- Preserve useful source metadata, album references, timestamps, and attribution while keeping the user's source account disconnected unless access is actively needed.
- Default to on-demand imports rather than copying an entire photo library into S3.
- Request the smallest practical permission scopes and show exactly which files will be copied or analyzed.
- Treat caption or description write-back as provider-specific research: only modify source metadata where an official API and user-granted permission support it. Otherwise, retain captions in AWS File Analyzer or export them as sidecar metadata.

### Browser extension companion

Explore a Chrome extension that brings analysis into supported photo websites without replacing the main application.

- Add an **Analyze with AWS File Analyzer** context-menu action for an eligible image or selected photo.
- Show generated captions, tags, confidence, and likely location in the Chrome Side Panel or a small page overlay.
- Offer an opt-in hover action for viewing an existing cached caption without repeatedly invoking Gemini.
- Deep-link users to the full collection or analysis record in the web app.
- Where a provider officially supports it, offer a separate confirmed action to write a generated caption back; otherwise provide copy and export controls.
- Secure extension-to-API calls with short-lived authentication, strict origin checks, minimal host permissions, and clear consent before transferring an image.
- Validate content-script behavior, cross-origin restrictions, provider terms, rate limits, and extension-store privacy requirements in a proof of concept before broadening provider support.

## Engineering Improvements

- Add explicit user ownership to upload and analysis records, then support claiming a guest session after registration. Local storage can preserve a guest-facing draft history, but the server must validate ownership before attaching cloud records to an account.
- Add API integration tests for authentication, authorization, upload validation, and database persistence.
- Add safe cleanup for test data and S3 objects created by authenticated end-to-end tests.
- Add OpenTelemetry traces spanning the Cloudflare frontend, Azure API, Azure SQL, AWS S3, and Gemini calls.
- Add budgets and alerts for Azure Monitor ingestion, AWS S3 storage/egress, and Gemini usage.
- Replace long-lived AWS access keys with temporary federated credentials if a practical cross-cloud identity flow is introduced.
- Evaluate background jobs for large-file processing so requests are not limited by the Azure App Service F1 execution window.

## Deployment Improvements

- Consolidate the duplicate Cloudflare Pages and Worker frontends behind one custom production domain after choosing the long-term Cloudflare hosting model.
- Add preview deployments for pull requests with isolated test configuration.
- Add a custom domain and production-grade App Service tier if the project receives sustained traffic.
- Restrict Azure SQL networking with private connectivity when moving beyond the free portfolio architecture.
- Add automated backup verification and a documented restore drill for Azure SQL and S3 metadata.
