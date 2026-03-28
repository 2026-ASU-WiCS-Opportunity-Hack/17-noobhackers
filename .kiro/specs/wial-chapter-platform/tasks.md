# Implementation Plan: WIAL Chapter Platform

## Overview

This plan implements the WIAL multi-site chapter platform in incremental steps: CDK infrastructure first, then backend Lambda functions with data models, followed by frontend pages and components, and finally integrations (payments, AI search, template sync). Each task builds on previous work. Property-based tests use Hypothesis (Python) and fast-check (TypeScript).

## Tasks

- [x] 1. Project scaffolding and CDK infrastructure foundation
  - [x] 1.1 Initialize CDK project and Next.js frontend
    - Create `backend/` directory with CDK TypeScript project (`cdk init app --language typescript`)
    - Create `frontend/` directory with Next.js 15 App Router, TypeScript, Tailwind CSS
    - Configure `tailwind.config.ts` with WIAL design token system (colors, typography, spacing)
    - Create `frontend/app/config/designTokens.ts` with brand tokens
    - _Requirements: 1.1, 4.6, 9.1_

  - [x] 1.2 Implement DynamoDB tables and S3 buckets (data-stack.ts)
    - Create `backend/lib/data-stack.ts` CDK stack
    - Define Chapters table with PK/SK pattern (`CHAPTER#{chapterId}`, `METADATA`), GSI1 on `slug`
    - Define Coaches table with PK/SK (`COACH#{coachId}`, `PROFILE`), GSI1 on `cognitoUserId`, GSI2 on `chapterId`+`certificationLevel`
    - Define Payments table with PK/SK (`PAYMENT#{paymentId}`, `RECORD`), GSI1 on `chapterId`+`createdAt`, GSI2 on `status`+`dueDate`
    - Define Pages table with PK/SK (`CHAPTER#{chapterId}`, `PAGE#{pageSlug}`)
    - Define Templates table with PK/SK (`TEMPLATE#global`, `VERSION#{version}`)
    - Define Users table with PK/SK (`USER#{cognitoUserId}`, `PROFILE`), GSI1 on `email`
    - Enable encryption at rest with AWS KMS managed keys on all tables
    - Create S3 bucket `wial-platform-assets` with encryption at rest, versioning enabled
    - _Requirements: 10.2_

  - [x] 1.3 Implement Cognito auth stack (auth-stack.ts)
    - Create `backend/lib/auth-stack.ts` CDK stack
    - Define Cognito User Pool with password policy and email verification
    - Create four groups: `SuperAdmins`, `ChapterLeads`, `ContentCreators`, `Coaches`
    - Enable MFA (TOTP) enforced for `SuperAdmins` group
    - Configure JWT token settings and token expiration
    - _Requirements: 3.1, 3.6, 10.8_

  - [x] 1.4 Implement API Gateway and Lambda stacks (api-stack.ts)
    - Create `backend/lib/api-stack.ts` CDK stack
    - Define REST API Gateway with Cognito authorizer
    - Define Lambda functions for: provisioning, coaches, payments, search, metrics, templates, auth
    - Configure IAM roles with least-privilege policies per Lambda
    - Wire API routes to Lambda handlers per the API endpoint table in design
    - Enforce HTTPS/TLS on all endpoints
    - _Requirements: 10.1, 10.7_

  - [x] 1.5 Implement Secrets Manager, SES, and DNS stacks
    - Create `backend/lib/payments-stack.ts` for Secrets Manager entries (Stripe API key, PayPal client secret) and SES configuration
    - Create `backend/lib/dns-stack.ts` for Route 53 hosted zone and wildcard subdomain record
    - Create `backend/lib/search-stack.ts` for OpenSearch Serverless collection with vector engine and Bedrock model access
    - _Requirements: 5.10, 10.3_

  - [x] 1.6 Implement main CDK stack wiring (wial-platform-stack.ts)
    - Create `backend/lib/wial-platform-stack.ts` that composes all sub-stacks
    - Wire cross-stack references (DynamoDB table ARNs to Lambda roles, Cognito pool to API Gateway, etc.)
    - _Requirements: all infrastructure_

- [x] 2. Checkpoint - Verify CDK synthesizes cleanly
  - Run `cdk synth` and ensure all stacks synthesize without errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Shared backend modules and data models
  - [x] 3.1 Implement shared data models and schemas (shared/models.py)
    - Create `backend/lambda/shared/models.py`
    - Define dataclasses/TypedDicts for: Chapter, Coach, Payment, Page, Template, User
    - Define JSON schemas for input validation of each entity
    - Define dues constants: STUDENT_ENROLLMENT_FEE = 50, COACH_CERTIFICATION_FEE = 30
    - Define valid certification levels: CALC, PALC, SALC, MALC
    - Define valid roles: Super_Admin, Chapter_Lead, Content_Creator, Coach
    - _Requirements: 5.2, 5.3, 6.3, 6.7, 3.1_

  - [x] 3.2 Implement input validation and sanitization (shared/validators.py)
    - Create `backend/lambda/shared/validators.py`
    - Implement `validate_input(data, schema)` that validates against JSON schema
    - Implement HTML tag stripping, script injection prevention, SQL injection pattern detection
    - Enforce field length limits and required field checks
    - Raise `ValidationError` with descriptive messages on failure
    - _Requirements: 10.5, 10.6_

  - [ ]* 3.3 Write property test for input validation (Property 26)
    - **Property 26: Input validation and sanitization**
    - Generate random inputs with HTML tags, script injections, SQL patterns; verify dangerous content is stripped/escaped
    - Generate random valid/invalid data against schemas; verify acceptance/rejection matches schema rules
    - **Validates: Requirements 10.5, 10.6**

  - [x] 3.4 Implement PII redaction filter (shared/pii_filter.py)
    - Create `backend/lambda/shared/pii_filter.py`
    - Implement `redact_pii(log_record)` that replaces names, emails, phone numbers with `[REDACTED]`
    - Preserve all non-PII fields unchanged
    - Use regex patterns for email, phone, and name field detection
    - _Requirements: 10.4_

  - [ ]* 3.5 Write property test for PII redaction (Property 25)
    - **Property 25: PII redaction in logs**
    - Generate random log records with and without PII fields; verify all PII values replaced with `[REDACTED]` and non-PII fields preserved
    - **Validates: Requirements 10.4**

  - [x] 3.6 Implement custom exceptions (shared/exceptions.py)
    - Create `backend/lambda/shared/exceptions.py`
    - Define: `ValidationError`, `ProvisioningError`, `PaymentError`, `AuthorizationError`, `SearchUnavailableError`
    - Each exception includes error code, message, and HTTP status code
    - _Requirements: 2.6, 5.9, 8.7_

- [x] 4. Chapter provisioning Lambda
  - [x] 4.1 Implement chapter provisioning handler (provisioning/handler.py)
    - Create `backend/lambda/provisioning/handler.py`
    - Implement `create_chapter()`: validate input, write chapter metadata to DynamoDB, copy parent template assets from S3, create Route 53 subdomain record, auto-generate 6 core pages (About, Coach Directory, Events, Team, Resources, Contact) in Pages table
    - Implement URL generation based on global config (subdomain vs subdirectory mode)
    - Support optional `externalLink` field for affiliate websites
    - Return `{ chapterId, url, status: "active" }` on success
    - On failure: raise `ProvisioningError` with descriptive message, log for Super_Admin review
    - Implement `list_chapters()`, `get_chapter()`, `update_chapter()`, `delete_chapter()` (deactivate)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 7.2_

  - [ ]* 4.2 Write property tests for chapter provisioning (Properties 1, 2, 3)
    - **Property 1: Chapter provisioning produces complete sites**
    - Generate random valid chapter configs; verify chapter record has status "active", valid URL, and exactly 6 core pages
    - **Property 2: Chapter URL format matches global configuration**
    - Generate random slugs and URL modes; verify URL matches `{slug}.wial.org` or `wial.org/{slug}`
    - **Property 3: External affiliate link round-trip**
    - Generate random chapter configs with external links; verify create-then-retrieve returns same link
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 7.2**

- [x] 5. Auth Lambda and RBAC enforcement
  - [x] 5.1 Implement auth triggers and RBAC middleware (auth/handler.py)
    - Create `backend/lambda/auth/handler.py`
    - Implement Cognito pre-authentication trigger (validate user status)
    - Implement Cognito post-authentication trigger (sync user record to Users table)
    - Implement `authorize(token, required_role, resource)` middleware function
    - Implement permission matrix: Super_Admin → full access; Chapter_Lead → manage assigned chapters + Content_Creator actions on own chapters; Content_Creator → edit content on assigned chapters only; Coach → read directory + update own profile
    - Return 401 for missing/invalid/expired JWT, 403 with "insufficient permissions" for valid token but wrong role
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9_

  - [ ]* 5.2 Write property tests for RBAC (Properties 4, 5)
    - **Property 4: RBAC permission matrix enforcement**
    - Generate random user-role-action-resource tuples; verify authorization decision matches permission matrix
    - **Property 5: Unauthorized access denial**
    - Generate requests with missing/invalid/expired tokens; verify 401. Generate valid tokens with wrong roles; verify 403 with "insufficient permissions"
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9, 10.7**

- [x] 6. Coach directory Lambda
  - [x] 6.1 Implement coach CRUD handler (coaches/handler.py)
    - Create `backend/lambda/coaches/handler.py`
    - Implement `list_coaches()`: paginated, filterable by chapterId, certificationLevel, location; keyword search by name and bio
    - Implement `get_coach()`: return all required fields (name, photoUrl, certificationLevel, location, contactInfo, bio)
    - Implement `create_coach()`: Chapter_Lead or Super_Admin only
    - Implement `update_coach_profile()`: store changes in `pendingUpdate` field, set status to `pending_approval`, keep active profile unchanged
    - Implement `approve_coach_update()`: merge pending changes into active profile, clear pendingUpdate, increment embeddingVersion, trigger re-embedding
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 6.2 Write property tests for coach directory (Properties 13, 14, 15, 16, 17, 18)
    - **Property 13: Global coach directory completeness** — all active coaches returned with no chapter filter
    - **Property 14: Chapter-filtered coach directory correctness** — only coaches from specified chapter returned
    - **Property 15: Coach profile display completeness** — all required fields present, certificationLevel is valid enum
    - **Property 16: Coach directory search by name and keyword** — searching by name/bio keyword includes matching coach
    - **Property 17: Coach directory filter correctness** — all returned coaches match filter criteria
    - **Property 18: Coach profile update pending state machine** — update sets pending_approval, original unchanged; approval merges changes
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8**

- [x] 7. Checkpoint - Verify core backend Lambdas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Payment processing Lambda
  - [x] 8.1 Implement payment handler (payments/handler.py)
    - Create `backend/lambda/payments/handler.py`
    - Implement `create_payment()`: fetch API keys from Secrets Manager at runtime, route to Stripe or PayPal based on `paymentMethod` field, calculate total (quantity × unit amount: $50 student_enrollment, $30 coach_certification), write payment record to DynamoDB, send receipt via SES on success, return descriptive error on failure and log for Super_Admin review
    - Implement `list_payments()`: filterable by chapterId for Chapter_Lead, global view for Super_Admin
    - Implement `get_payment()`: return payment details
    - Implement Stripe webhook handler with signature verification
    - Implement PayPal webhook handler with signature verification
    - Implement retry logic: up to 2 retries with exponential backoff (1s, 3s) for payment provider calls
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.9, 5.10_

  - [x] 8.2 Implement dues reminder scheduler (payments/handler.py)
    - Implement `send_dues_reminders()` triggered by EventBridge scheduled rule
    - Query Payments table GSI2 for status=`overdue`
    - Determine reminder action: send at 7, 14, 30 days past due; skip if not overdue or all 3 reminders sent
    - Increment `remindersSent` counter after each send
    - Send reminder emails via SES
    - _Requirements: 5.8_

  - [ ]* 8.3 Write property tests for payments (Properties 8, 9, 10, 11, 12)
    - **Property 8: Dues calculation correctness** — student_enrollment × N = N×$50; coach_certification × N = N×$30
    - **Property 9: Payment method routing** — "stripe" routes to Stripe API, "paypal" routes to PayPal API, no other methods accepted
    - **Property 10: Successful payment triggers receipt email** — succeeded payment invokes SES with payer email
    - **Property 11: Chapter-level payment filtering** — query by chapterId returns only that chapter's payments
    - **Property 12: Overdue payment reminder scheduling** — correct reminder at 7/14/30 days, no reminder if not overdue or all sent
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.8**

- [x] 9. Template engine Lambda
  - [x] 9.1 Implement template sync handler (templates/handler.py)
    - Create `backend/lambda/templates/handler.py`
    - Implement `get_template()`: return current parent template (header, footer, nav, global styles)
    - Implement `update_template()`: Super_Admin only; store new template version in Templates table, upload assets to S3, trigger sync to all active chapters
    - Implement `sync_template()`: iterate all active chapters, update locked template elements (header, footer, nav, global styles), track sync status, complete within 10 minutes
    - Implement template lock enforcement: reject any Chapter_Lead or Content_Creator attempt to modify locked elements, return error message indicating element is controlled by global template
    - Implement chapter page content CRUD: `get_pages()`, `get_page()`, `update_page()` with role checks
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 9.2 Write property tests for templates (Properties 6, 7)
    - **Property 6: Locked template elements are immutable by non-Super_Admins** — Chapter_Lead/Content_Creator modifications to locked elements rejected with error message
    - **Property 7: Template sync propagates to all active chapters** — after update, count of updated chapters equals count of active chapters
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5**

- [x] 10. Metrics and dashboard Lambda
  - [x] 10.1 Implement metrics handler (metrics/handler.py)
    - Create `backend/lambda/metrics/handler.py`
    - Implement `get_global_metrics()`: aggregate across all chapters — total revenue (sum), active chapters (count with status "active"), total coaches (sum), dues collection status, membership growth rate, payment conversion rate
    - Implement `get_chapter_metrics()`: per-chapter metrics — revenue, coach count, membership growth rate ((current - previous) / previous), payment conversion rate (paid / issued)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 5.7_

  - [ ]* 10.2 Write property tests for metrics (Properties 28, 29)
    - **Property 28: Global metrics aggregation correctness** — total revenue = sum of chapter revenues; active chapters = count of active; total coaches = sum of chapter coaches
    - **Property 29: Per-chapter metrics calculation** — membership growth = (current - previous) / previous; payment conversion = paid / issued; active count = chapters with status "active"
    - **Validates: Requirements 5.7, 11.1, 11.2, 11.3, 11.4**

- [x] 11. AI semantic search Lambda
  - [x] 11.1 Implement semantic search handler (search/handler.py)
    - Create `backend/lambda/search/handler.py`
    - Implement `semantic_search()`:
      1. Send query to Bedrock LLM for structured filter extraction (location, language)
      2. Embed semantic portion via multilingual embedding model (Bedrock)
      3. Query OpenSearch Serverless for vector similarity (cosine similarity, knn_vector dimension 1024)
      4. Merge structured filters with semantic results
      5. Return results ranked by descending relevance score
    - Implement fallback: if AI pipeline unavailable, fall back to DynamoDB keyword search, return `"fallback": true` flag
    - Implement LLM parsing fallback: if LLM fails, skip structured filters and do pure semantic search; if embedding also fails, fall back to keyword search
    - _Requirements: 8.1, 8.3, 8.4, 8.6, 8.7_

  - [x] 11.2 Implement coach profile embedding pipeline
    - Implement `embed_coach_profile()`: concatenate name + location + bio + languages, call Bedrock multilingual embedding model, store 1024-dimension vector in OpenSearch Serverless
    - Implement `re_embed_coach()`: triggered on profile approval, increment embeddingVersion, update vector store within 5 minutes
    - Create OpenSearch Serverless index `coach-profiles` with knn_vector mapping per design
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ]* 11.3 Write property tests for search (Properties 19, 20, 21, 22, 23)
    - **Property 19: Embedding dimension consistency** — embedding produces exactly 1024-dimension vector with finite float values
    - **Property 20: Cross-lingual semantic search retrieval** — semantically equivalent query in different language returns matching coach above threshold
    - **Property 21: Search query parsing extracts structured filters** — complex query with location/language extracts at least one structured filter, semantic portion non-empty
    - **Property 22: Approved profile triggers re-embedding** — approval increments embeddingVersion, vector store updated
    - **Property 23: Search results ranked by relevance score** — results ordered by descending score
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.5, 8.6**

- [x] 12. Checkpoint - Verify all backend Lambdas and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend auth context and login
  - [x] 13.1 Implement Cognito auth context and login page
    - Create `frontend/app/context/AuthContext.tsx` with Cognito integration (user pool, identity pool)
    - Implement login, logout, token refresh, role extraction from JWT claims
    - Create `frontend/app/login/page.tsx` with Cognito-hosted UI redirect
    - Implement route guards: redirect unauthenticated users to login for protected routes, display "insufficient permissions" for unauthorized access
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 14. Global site layout and core pages
  - [x] 14.1 Implement global layout with locked header and footer
    - Create `frontend/app/layout.tsx` (root layout) with `GlobalHeader.tsx` and `GlobalFooter.tsx`
    - Implement sticky header with WIAL logo, nav links (About, Certification, Coaches, Resources, Events, Contact, Login)
    - Implement footer with contact, privacy, terms, social links, chapter links
    - Use system font stack (no custom web fonts)
    - Apply Tailwind design tokens for consistent branding
    - _Requirements: 1.1, 4.1, 4.6, 9.1_

  - [x] 14.2 Implement global site landing page
    - Create `frontend/app/page.tsx` as single-page scroll-down layout
    - Implement sections in order: Hero (with CTA), About WIAL, Certification Levels (CALC/PALC/SALC/MALC), Coach Directory preview, Chapter Map, Events Calendar, Resources & Library, Contact (Executive Director email)
    - Use Static Site Generation (SSG) for build-time rendering
    - Ensure compressed payload ≤ 200 KB, total JS < 100 KB on content pages
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 14.3 Implement global core pages
    - Create `frontend/app/about/page.tsx` — About WIAL page
    - Create `frontend/app/certification/page.tsx` — Certification levels (CALC/PALC/SALC/MALC) with descriptions
    - Create `frontend/app/resources/page.tsx` — Resources & Library with categorized links
    - Create `frontend/app/events/page.tsx` — Global events calendar with chapter filtering
    - Ensure image-heavy pages (Resources, About) have compressed payload ≤ 800 KB
    - Use SSG for all core pages, ISR for events
    - _Requirements: 7.1, 7.3, 7.5, 7.6, 1.3_

- [x] 15. Coach directory frontend
  - [x] 15.1 Implement coach directory components
    - Create `frontend/app/components/CoachCard.tsx` — displays name, photo, certification badge, location, contact, bio
    - Create `frontend/app/components/CertBadge.tsx` — renders CALC/PALC/SALC/MALC badge based on certification level
    - Create `frontend/app/components/CoachSearchBar.tsx` — AI-powered search input with natural language support, fallback notice when AI unavailable
    - Implement lazy-loading for coach photos below the fold
    - Serve images in AVIF primary, WebP fallback, JPEG last resort; max 50 KB per image
    - _Requirements: 6.3, 6.7, 6.9, 6.10, 9.4, 9.5, 9.6_

  - [x] 15.2 Implement global and chapter coach directory pages
    - Create `frontend/app/coaches/page.tsx` — global coach directory with AI semantic search, filters (location, certification level), pagination
    - Use ISR for coach directory pages
    - Ensure compressed payload ≤ 500 KB
    - _Requirements: 6.1, 6.4, 6.5, 6.9, 8.3, 8.7_

  - [ ]* 15.3 Write property test for coach card display (Property 15 - frontend)
    - **Property 15: Coach profile display completeness (frontend)**
    - Generate random coach profiles with fast-check; verify CoachCard renders all required fields and correct badge
    - **Validates: Requirements 6.3, 6.7**

- [x] 16. Chapter site pages
  - [x] 16.1 Implement chapter layout and landing page
    - Create `frontend/app/[chapter]/layout.tsx` — inherits global template (locked header/footer), adds chapter-specific local nav (Team, Events, Resources, Contact)
    - Create `frontend/app/[chapter]/page.tsx` — chapter landing with editable hero section and about content
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 16.2 Implement chapter sub-pages
    - Create `frontend/app/[chapter]/coaches/page.tsx` — chapter-filtered coach directory
    - Create `frontend/app/[chapter]/events/page.tsx` — chapter events + global events visible to all chapters
    - Create `frontend/app/[chapter]/team/page.tsx` — chapter leadership/team page
    - Create `frontend/app/[chapter]/resources/page.tsx` — chapter-specific resources
    - Create `frontend/app/[chapter]/contact/page.tsx` — chapter contact with Executive Director email
    - _Requirements: 6.2, 7.2, 7.3, 7.4_

  - [ ]* 16.3 Write property test for chapter events filtering (Property 27 - frontend)
    - **Property 27: Chapter events calendar filtering**
    - Generate random events (chapter-specific and global) with fast-check; verify chapter view shows only that chapter's events plus global events, no other chapter events
    - **Validates: Requirements 7.3, 7.4**

- [x] 17. Admin dashboards
  - [x] 17.1 Implement Super Admin dashboard and management pages
    - Create `frontend/app/admin/dashboard/page.tsx` — global metrics: total revenue, active chapters, total coaches, dues collection status, membership growth, payment conversion rates
    - Create `frontend/app/admin/chapters/page.tsx` — chapter management list with status
    - Create `frontend/app/admin/chapters/new/page.tsx` — one-click chapter provisioning form (chapter name, slug, region, executive director email, optional external link)
    - Create `frontend/app/admin/templates/page.tsx` — template management (view/update parent template)
    - Create `frontend/app/admin/users/page.tsx` — user/role management (list, create, change role, deactivate)
    - Create `frontend/app/admin/payments/page.tsx` — global payment dashboard with aggregated revenue
    - Protect all admin routes with Super_Admin role check
    - _Requirements: 3.2, 5.7, 11.1, 11.2, 11.3, 11.4_

  - [x] 17.2 Implement Chapter Lead dashboard
    - Create `frontend/app/chapter-admin/dashboard/page.tsx` — chapter-specific metrics
    - Create `frontend/app/chapter-admin/content/page.tsx` — content editor for chapter pages (editable areas only)
    - Create `frontend/app/chapter-admin/payments/page.tsx` — chapter payment reporting
    - Create `frontend/app/components/ContentEditor.tsx` — rich text editor for chapter content, enforces locked template elements cannot be edited
    - Protect all chapter-admin routes with Chapter_Lead role check
    - _Requirements: 3.3, 4.2, 5.6_

  - [x] 17.3 Implement coach profile editor
    - Create `frontend/app/profile/page.tsx` — coach self-service profile editor (name, photo, location, contact info, bio)
    - Display pending approval status when update is submitted
    - Protect with Coach role check, restrict to own profile only
    - _Requirements: 6.6, 6.8_

- [x] 18. Payment frontend
  - [x] 18.1 Implement payment form component
    - Create `frontend/app/components/PaymentForm.tsx`
    - Support Stripe and PayPal payment methods
    - Implement dues type selection (student enrollment $50, coach certification $30) with quantity input
    - Display calculated total before submission
    - Show success confirmation with receipt info, or descriptive error on failure
    - Create `frontend/app/components/ChapterMap.tsx` — interactive chapter map/directory
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9_

- [x] 19. Checkpoint - Verify frontend pages and components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Image optimization and performance
  - [x] 20.1 Implement image optimization pipeline
    - Configure Next.js Image component with AVIF primary, WebP fallback, JPEG last resort
    - Implement server-side image validation: reject or compress uploads exceeding 50 KB
    - Implement lazy-loading for all images below the fold using `loading="lazy"` and Next.js Image
    - Configure Brotli compression for all static assets in deployment config
    - _Requirements: 6.10, 9.4, 9.5, 9.6, 9.7, 1.4_

  - [ ]* 20.2 Write property test for image constraints (Property 24)
    - **Property 24: Image size constraint enforcement**
    - Generate random image upload payloads; verify images > 50 KB are rejected or compressed; verify format priority AVIF > WebP > JPEG
    - **Validates: Requirements 6.10, 9.4, 9.5**

- [x] 21. Service worker for offline support
  - [x] 21.1 Implement service worker
    - Create `frontend/public/sw.js` — cache-first strategy for static assets, network-first for API calls
    - Register service worker in root layout for all content pages
    - Cache previously visited pages for offline access
    - Implement asset caching for CSS, JS, images
    - _Requirements: 9.2_

- [x] 22. Integration wiring and end-to-end flows
  - [x] 22.1 Wire frontend API calls to backend endpoints
    - Create API client utility in frontend for all backend endpoints (chapters, coaches, payments, search, metrics, templates, users)
    - Attach Cognito JWT token to all protected API requests
    - Implement error handling: display descriptive errors from API, handle 401 redirect to login, handle 403 with permissions message
    - Wire coach search bar to `/coaches/search` endpoint with AI fallback notice
    - Wire payment form to `/payments` endpoint with Stripe/PayPal client-side SDKs
    - Wire admin dashboards to `/metrics/global` and `/metrics/chapters/{chapterId}`
    - Wire chapter provisioning form to `POST /chapters`
    - Wire template management to `/templates` endpoints
    - Wire content editor to `/chapters/{chapterId}/pages/{pageSlug}` endpoints
    - Wire coach profile editor to `PUT /coaches/{coachId}` with pending approval flow
    - _Requirements: all API integration_

  - [x] 22.2 Configure EventBridge rule for dues reminders
    - Create EventBridge scheduled rule in CDK to invoke `send_dues_reminders` Lambda daily
    - _Requirements: 5.8_

  - [x] 22.3 Configure CloudWatch alarms
    - Create CloudWatch alarms in CDK for: provisioning failure rate > 5%, payment failure rate > 10%, search fallback rate > 20%, Lambda error rate > 1%
    - _Requirements: monitoring per design_

- [x] 23. Final checkpoint - Ensure all tests pass
  - Run all backend property tests (Hypothesis) and unit tests (pytest)
  - Run all frontend tests (Jest + fast-check)
  - Verify CDK synth succeeds
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- Property tests validate universal correctness properties (29 total across Properties 1-29)
- Python Lambda tests use Hypothesis; TypeScript frontend tests use fast-check
- All secrets accessed at runtime from AWS Secrets Manager, never hardcoded
- All DynamoDB tables and S3 buckets encrypted at rest with KMS
- PII redaction applied to all CloudWatch log output via shared pii_filter module
- IAM roles follow least-privilege principle with resource-specific ARNs
