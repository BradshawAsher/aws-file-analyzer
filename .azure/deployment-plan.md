# Azure Deployment Plan

> **Status:** Deployed & Verified

Generated: 2026-09-09T19:21:16Z

---

## 1. Project Overview

**Goal:** Deploy the existing hybrid-cloud portfolio application with its React frontend on Cloudflare Pages, its .NET API and relational database on Azure, and file storage on AWS S3.

**Path:** Modernize Existing

The existing AWS S3 integration is intentionally retained. This plan provisions only the Azure portion and configures the API to call the separately managed S3 bucket.

---

## 2. Requirements

| Attribute | Value |
|---|---|
| Classification | POC / portfolio demonstration |
| Scale | Small, low traffic |
| Budget | Cost-Optimized with overage prevention |
| Subscription | Azure for Students (`855dcbce-0723-4f41-9955-21e6a0ff0887`) |
| Location | West US (`westus`) |
| Resource group | `rg-aws-file-analyzer-portfolio` |
| Authentication | Existing application JWT; Microsoft Entra authentication between App Service and Azure SQL |
| Compliance | No special regulatory or residency requirement stated |

### Policy Constraints

The subscription has an **Allowed resource deployment regions** policy. Permitted regions are `northcentralus`, `mexicocentral`, `westus`, `eastus2`, and `canadacentral`. West US is selected because it is the closest permitted region and the subscription already uses it.

---

## 3. Components Detected

| Component | Type | Technology | Path | Hosting target |
|---|---|---|---|---|
| OpenAiChat API | API | ASP.NET Core, .NET 8, EF Core | `backend` | Azure App Service |
| file-uploader | SPA frontend | React 19 | `frontend` | Cloudflare Pages (external to this Azure plan) |
| File database | Relational data | SQL Server schema and EF Core migrations | `backend/Migrations` | Azure SQL Database |
| Object storage | External dependency | AWS SDK for .NET / S3 | `backend` | Existing AWS S3 bucket |

### Dependencies

| Component | Depends on | Integration |
|---|---|---|
| React frontend | ASP.NET API | HTTPS with configurable `VITE_API_BASE_URL` |
| ASP.NET API | Azure SQL | EF Core with managed identity / Microsoft Entra authentication |
| ASP.NET API | AWS S3 | Restricted IAM access key stored in Azure Key Vault |
| ASP.NET API | Google Gemini | API key stored in Azure Key Vault |

### Existing Infrastructure

| Item | Status |
|---|---|
| Azure infrastructure-as-code | Generated in `infra/` and successfully deployed with AZD |
| Dockerfile | Not found; not required for App Service code deployment |
| AWS S3 | Private bucket `aws-file-analyzer-bd3b69e5` created in `us-east-2` |
| AWS IAM | Dedicated least-privilege identity `aws-file-analyzer-api` configured |

---

## 4. Recipe Selection

**Selected:** Azure Developer CLI (AZD) with Bicep

**Rationale:** AZD plus Bicep provides repeatable Azure-native infrastructure, environment management, validation, and straightforward application deployments while leaving Cloudflare and AWS independently managed.

---

## 5. Architecture

**Stack:** App Service

### Service Mapping

| Component | Service | SKU / configuration | Expected cost |
|---|---|---|---|
| .NET API | Azure App Service for Linux | F1 Free, .NET 8, one shared instance | $0/month |
| Relational database | Azure SQL Database | General Purpose serverless `GP_S_Gen5_1`, free limit enabled, 0.5 minimum vCore, 60-minute auto-pause, AutoPause when monthly free allowance is exhausted | $0 within free allowance |
| Secrets | Azure Key Vault | Standard, RBAC authorization, soft delete | Usage-based; expected less than $0.01/month at portfolio traffic |
| Monitoring | Application Insights | Workspace-based, sampling enabled | Expected $0 within the first 5 GB/month billing-account allowance |
| Logs | Log Analytics workspace | PerGB2018, 30-day retention, 0.1 GB/day cap target | Expected $0 within the first 5 GB/month billing-account allowance |
| Frontend | Cloudflare Pages | Free plan; configured separately | $0/month |
| Files | AWS S3 | Existing private bucket; configured separately | Expected pennies at portfolio traffic |

**Estimated combined total:** approximately **$0-$0.10/month** at portfolio traffic. Spending risks are Azure Monitor ingestion above its free allowance, unusual Key Vault transaction volume, AWS storage/egress, or changing the SQL free-limit behavior. The plan keeps SQL on `AutoPause` rather than allowing billed overage.

### Security

- Enable a system-assigned managed identity on the web app.
- Configure the SQL logical server for Microsoft Entra-only authentication with `mysue@batestech.edu` (`bb082606-a57c-4ced-b775-a2ab3db525c7`) as administrator.
- Grant the web app identity only the required database permissions.
- Store Gemini, JWT, and AWS access credentials in Key Vault; expose them to App Service through Key Vault references.
- Keep S3 public access fully blocked and use presigned URLs.
- Permit only the final Cloudflare Pages origin through API CORS configuration.
- Configure `/health` as the application health endpoint.

---

## 6. Provisioning Limit Checklist

The Azure Quota CLI was invoked first for each provider. Microsoft.Web exposed only a regional VM quota that does not apply to F1 shared App Service. Microsoft.Sql, Key Vault, Operational Insights, and Application Insights returned `BadRequest`, so current usage was checked with Azure Resource Graph and limits were taken from current service documentation or the service capability response.

| Resource type | Deploy | Total after deployment | Limit / quota | Result and source |
|---|---:|---:|---|---|
| `Microsoft.Web/serverfarms` F1 | 1 | 1 | 10 free plans per region | Within limit; ARG current usage 0 + official App Service limits |
| `Microsoft.Web/sites` | 1 | 1 | 10 apps per F1 plan | Within limit; ARG current usage 0 + official App Service limits |
| `Microsoft.Sql/servers` | 1 | 1 | 250 logical servers per subscription/region | Within limit; ARG current usage 0 + official Azure SQL limits |
| `Microsoft.Sql/servers/databases` free offer | 1 | 1 | Up to 10 free-offer databases per subscription; 5,000 databases per logical server | Within limit; free-limit behavior reported available in West US |
| `Microsoft.KeyVault/vaults` | 1 | 1 | No vault-count limit published; 4,000 other transactions per 10 seconds per vault | Within operational limits; ARG current usage 0 + Key Vault limits |
| `Microsoft.OperationalInsights/workspaces` | 1 | 1 | No resource-count quota exposed; ingestion service limits apply | Within limits; ARG current usage 0 + Azure Monitor limits |
| `Microsoft.Insights/components` | 1 | 1 | 100 Application Insights/Log Analytics resources per cross-resource query; ingestion limits apply | Within limits; ARG current usage 0 + Azure Monitor limits |

**Status:** All planned resources are within available limits. F1 and Azure SQL serverless free-limit behavior are available in West US.

---

## 7. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace
- [x] Gather requirements
- [x] Confirm subscription and location with user
- [x] Prepare resource inventory
- [x] Fetch quotas and validate capacity
- [x] Scan codebase
- [x] Select recipe
- [x] Plan architecture
- [x] User approved this plan

### Phase 2: Execution

- [x] Install Azure Developer CLI 1.33.0
- [x] Research and load service-specific App Service, Azure SQL, Key Vault, and monitoring guidance
- [x] Generate `azure.yaml` and Bicep infrastructure from the Microsoft App Service/Azure SQL AZD base
- [x] Generate Key Vault references and managed-identity role assignments
- [x] Generate the EF Core migration/deployment procedure
- [x] Configure the Cloudflare production origin parameter with a replacement-required placeholder
- [x] Perform local functional verification (Bicep build and .NET Release publish)
- [x] Update this plan to `Ready for Validation`

### Phase 3: Validation

- [x] All validation checks pass
  - [x] 1. AZD Installation
  - [x] 2. Schema Validation
  - [x] 3. Environment Setup
  - [x] 4. Authentication Check
  - [x] 5. Subscription/Location Check
  - [x] 6. Aspire Pre-Provisioning Checks (N/A - non-Aspire)
  - [x] 7. Provision Preview
  - [x] 8. Build Verification
  - [x] 9. Docker Build Context Validation (N/A - App Service code deployment)
  - [x] 10. Package Validation
  - [x] 11. Azure Policy Validation
  - [x] 12. Aspire Post-Provisioning Checks (N/A - non-Aspire)
- [x] Resolve all blocking validation findings
- [x] Update this plan to `Validated`
- [x] Record validation proof below

### Phase 4: Deployment

- [x] Store the Gemini API key in Azure Key Vault
- [x] Deploy approved Azure resources
- [x] Apply EF Core migrations and grant the web app database access
- [x] Deploy the API and verify `/health`
- [x] Configure and deploy Cloudflare Pages
- [x] Verify registration, login, S3 upload, and Gemini analysis end to end

---

## 8. Validation Proof

| Check | Command | Result | Timestamp |
|---|---|---|---|
| AZD Installation | `azd version` | azd 1.33.0 (stable) | 2026-09-09T19:49:37Z |
| Authentication | `azd auth login --check-status` | Logged in as mysue@batestech.edu | 2026-09-09T19:50:46Z |
| Environment Config | `azd env get-values` | Portfolio env bound to West US and `rg-aws-file-analyzer-portfolio` | 2026-09-09T19:50:50Z |
| Bicep Compilation | `az bicep build --file infra/main.bicep` | Clean compilation with zero errors | 2026-09-09T19:50:57Z |
| IaC Provision Preview | `azd provision --preview --no-prompt` | Success: 7 resources planned for creation in 31s | 2026-09-09T19:51:32Z |
| Backend Build | dotnet build backend | Build succeeded: 0 Warning(s), 0 Error(s) | 2026-09-09T19:54:30Z |
| Frontend Build | `npm --prefix frontend run build` | Compiled successfully into production build | 2026-09-09T19:54:52Z |
| Packaging Validation | `azd package --no-prompt` | Successfully packaged API service zip in 3s | 2026-09-09T19:51:40Z |
| RBAC Role Verification | Review infra/resources.bicep | Key Vault Secrets User (API identity) + Secrets Officer (deployer) verified | 2026-09-09T19:55:09Z |

**Validated by:** azure-validate workflow

## Role Assignment Verification
- Status: Verified
- Identities checked: API App Service system-assigned managed identity, deployer principal (`mysue@batestech.edu`)
- Roles confirmed:
  - Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6) assigned to App Service managed identity scoped to Key Vault.
  - Key Vault Secrets Officer (`b86a8fe4-44ce-4948-aee5-eccb2c155cd7`) assigned to deployer principal scoped to Key Vault.
  - Azure SQL db_datareader and db_datawriter assigned via post-provision hook script (scripts/grant-sql-access.ps1) using Entra authentication.
- Issues: None. Least privilege strictly maintained.

---

## 9. Files to Generate

| File | Purpose | Status |
|---|---|---|
| `.azure/deployment-plan.md` | Deployment source of truth | Complete |
| `azure.yaml` | AZD service and infrastructure configuration | Generated |
| `infra/main.bicep` | Subscription-scope deployment orchestrator | Generated |
| `infra/resources.bicep` | App Service, SQL, Key Vault, and monitoring resources | Generated |
| `infra/main.parameters.json` | Environment parameter mapping | Generated |
| `scripts/grant-sql-access.ps1` / `.sh` | Passwordless SQL data-plane grants | Generated from Azure recipe |
| `scripts/configure-app-secrets.ps1` | Copies local user secrets to Key Vault without printing them | Generated |
| `scripts/apply-database-migrations.ps1` | Applies existing EF Core migrations using Entra authentication | Generated |
| `.github/workflows/azure-api.yml` | Optional API deployment workflow | Deferred; application updates currently deploy through AZD |
| `.github/workflows/regression.yml` | Backend/frontend regression suite and public live smoke checks | Generated |

---

## 10. Deployment & Live Verification Proof
 
**Deployed:** 2026-09-09
 
| Target | Endpoint / Resource | Verification | Status |
|---|---|---|---|
| .NET 8 API | `https://app-afa-eycaz6z3q3pp4.azurewebsites.net/health` | HTTP 200 `{"status":"healthy"}` | Verified |
| Azure SQL Database | `sql-afa-eycaz6z3q3pp4.database.windows.net` / `FileAnalyzer` | EF Core migrations applied; User registered and queried | Verified |
| Azure Key Vault | `kv-afa-eycaz6z3q3pp4.vault.azure.net` | 4 secrets stored and resolved by App Service Managed Identity | Verified |
| AI Inference | Gemini API via `/OpenAIAws/GeminiChat` | Prompt executed; returned completion response | Verified |
| Auth & JWT | `/api/Security/register` & `/api/Security/login` | BCrypt password hash stored in SQL; signed JWT returned | Verified |
| Application Insights | `appi-afa-eycaz6z3q3pp4` | Live diagnostics & Kestrel telemetry active | Verified |
 
---
 
## 11. Live Endpoints and Update Process

- Frontend: `https://aws-file-analyzer.pages.dev/`
- API: `https://app-afa-eycaz6z3q3pp4.azurewebsites.net/`
- Swagger: `https://app-afa-eycaz6z3q3pp4.azurewebsites.net/swagger/index.html`
- Health: `https://app-afa-eycaz6z3q3pp4.azurewebsites.net/health`

Application-only API updates use `azd deploy api --no-prompt`. The Git-connected Cloudflare Worker build deploys the Vite frontend automatically, while the established Pages URL can be updated with `npm run deploy:pages`. Infrastructure changes still require the full validated AZD provisioning workflow.



