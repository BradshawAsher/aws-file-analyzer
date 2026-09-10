# Future Work

This roadmap captures improvements that would make AWS File Analyzer more useful while preserving its value as a focused multi-cloud portfolio project.

## Next Up

### Photo gallery and collections (Shipped in v1.1)

A visual library and interactive map for uploaded images have been shipped live (`/gallery` & `/gallery?view=map`):

- [x] Search, tags, and category filters (Landmark, Document, General Photo, Code/Diagram).
- [x] Interactive Leaflet world map with automatic coordinate pin placement based on Gemini landmark extraction.
- [x] Short-lived AWS S3 pre-signed URLs ensuring private S3 bucket protection.
- [x] Audio narration player for AI visual descriptions via Web Speech API.
- [x] Persistent cross-navigation links (Landing Page, Analyzer, Swagger API docs).
- [ ] Group images into user-created custom named collections.
- [ ] Bulk selection, re-analysis, and manual deletion of owned files.

## Product Improvements

- Add automatic cleanup for objects uploaded through short-lived guest sessions.
- Build upload and analysis history pages with pagination and clear processing states.
- Add user-facing retry controls when Gemini rate limits trigger the model fallback hierarchy.
- Stream longer analysis responses and show which fallback model completed the request.
- Instrument Gemini usage metadata and evaluate context caching. Gemini 2.5+ models already receive implicit caching automatically for sufficiently large repeated prompt prefixes; explicit caches would require moving relevant calls from the current OpenAI-compatible endpoint to Gemini's native `generateContent` API. Adopt explicit caching only for repeated large shared context—not unique one-off file analyses—and compare cache-hit tokens, latency, and cost first.
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

- [x] **Guest Session Handoff**: Preserve staged guest file URLs and AI results in browser `localStorage`, restore them after registration or sign-in, and validate submitted URLs against the configured S3 bucket on `POST /api/Security/claim-guest-uploads`.
- Add explicit user and guest-session ownership columns to `FileUploadHistory` and `FileAnalysisResult`, filter every history query by owner, and turn the current handoff acknowledgement into a transactional, durable claim operation.
- Add API integration tests for authentication, authorization, upload validation, and database persistence.
- Add safe cleanup for test data and S3 objects created by authenticated end-to-end tests.
- Add OpenTelemetry traces spanning the Cloudflare frontend, Azure API, Azure SQL, AWS S3, and Gemini calls.
- Add budgets and alerts for Azure Monitor ingestion, AWS S3 storage/egress, and Gemini usage.
- Replace long-lived AWS access keys with temporary federated credentials if a practical cross-cloud identity flow is introduced.
- Evaluate background jobs for large-file processing so requests are not limited by the Azure App Service F1 execution window.

## Deployment Improvements

- Consolidate the duplicate Cloudflare Pages and Worker frontends behind one custom production domain after choosing the long-term Cloudflare hosting model.
- Add a disaster-recovery copy of S3 objects in Cloudflare R2. Start with a one-way scheduled copy or inventory reconciliation keyed by the existing S3 object key, then document retention and test restoration. R2's S3-compatible API makes a future storage-provider switch feasible, but a continuously consistent dual-write/failover path should be treated as a separate, more complex phase.
- Add a portable database recovery target. Prefer Neon or Supabase Postgres over Cloudflare D1 for this .NET/EF Core relational schema, maintain reviewed PostgreSQL migrations, export Azure SQL data on a schedule, and test restoration. D1 is SQLite-based and Worker-oriented, so using it would be a database migration/rewrite rather than a drop-in Azure SQL backup.
- Add preview deployments for pull requests with isolated test configuration.
- Add a custom domain and production-grade App Service tier if the project receives sustained traffic.
- Restrict Azure SQL networking with private connectivity when moving beyond the free portfolio architecture.
- Add automated backup verification and a documented restore drill for Azure SQL and S3 metadata.
