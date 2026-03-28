# Requirements Document: WIAL Chapter Platform

## Introduction

The World Institute for Action Learning (WIAL) is a global non-profit that certifies Action Learning Coaches across 20+ countries. WIAL requires a multi-site web platform to manage its global chapter network. The platform enables authorized chapter leads to provision chapter-specific websites under a unified brand, manage coach directories, collect dues via Stripe/PayPal, and provide a cross-lingual AI-powered coach search. This document covers all P0 (Must Have) features for the MVP launch.

## Glossary

- **Platform**: The WIAL multi-site web platform comprising a global site and chapter sub-sites
- **Chapter_Site**: A chapter-specific website provisioned under the Platform, accessible via subdomain (e.g., usa.wial.org) or subdirectory (e.g., wial.org/usa)
- **Global_Site**: The top-level WIAL website (wial.org) serving as the parent for all Chapter_Sites
- **Super_Admin**: A WIAL Global Administrator with full access to all sites, templates, users, and revenue dashboards
- **Chapter_Lead**: An authorized regional affiliate director who provisions and manages a Chapter_Site
- **Content_Creator**: A user authorized to edit content on one or more assigned Chapter_Sites without modifying site structure
- **Coach**: A certified Action Learning Coach who can view the directory and update their own profile
- **Coach_Directory**: A searchable, filterable listing of all certified coaches, available globally and per chapter
- **Template_Engine**: The system responsible for enforcing parent-level branding (header, footer, navigation, styling) across all Chapter_Sites
- **Payment_Gateway**: The integration layer connecting Stripe and PayPal for dues collection
- **Dues**: Fees paid by affiliates and instructors to WIAL Global — $50 USD per student enrolled in eLearning, $30 USD per fully certified coach
- **CALC**: Certified Action Learning Coach — entry-level certification
- **PALC**: Professional Action Learning Coach — advanced certification
- **SALC**: Senior Action Learning Coach — senior certification
- **MALC**: Master Action Learning Coach — master-level certification
- **Semantic_Search_Engine**: The AI subsystem that embeds coach profiles using a multilingual model and performs cross-lingual natural language search
- **Provisioning_System**: The subsystem that creates new Chapter_Sites from the parent template with one-click deployment
- **RBAC_System**: The Role-Based Access Control subsystem managing user roles and permissions via Amazon Cognito
- **SSG**: Static Site Generation — pre-rendering pages at build time for performance and global accessibility
- **Service_Worker**: A browser-side script enabling offline support and asset caching

## Tech Stack Recommendation

### Frontend
- **Framework**: Next.js 15 with TypeScript and App Router
- **Styling**: Tailwind CSS with a WIAL design token system
- **Deployment**: Cloudflare Pages for global CDN coverage (330+ edge locations including 32 African cities), with AWS Amplify as a viable alternative if the team prefers AWS-only infrastructure
- **Rendering**: Static Site Generation (SSG) as default; Incremental Static Regeneration (ISR) for coach directory and events pages
- **Image Optimization**: Next.js Image component with AVIF primary, WebP fallback, JPEG last resort; all images ≤ 50 KB; lazy-loading below the fold
- **Fonts**: System font stack (no custom web fonts unless required for WIAL branding)

### Backend
- **Infrastructure as Code**: AWS CDK with TypeScript
- **Compute**: AWS Lambda with Python runtime
- **API**: Amazon API Gateway (REST)
- **Authentication**: Amazon Cognito (user pools, identity pools, RBAC groups)
- **Database**: Amazon DynamoDB (coach profiles, chapter metadata, payment records, user roles)
- **File Storage**: Amazon S3 (images, static assets, template files)
- **Payments**: Stripe SDK and PayPal SDK integrated via Lambda functions
- **Email**: Amazon SES for automated payment receipts and dues reminders

### AI / Semantic Search
- **Embedding Model**: A multilingual sentence embedding model (e.g., Cohere Embed v3 or Amazon Titan Embeddings) for coach profile vectorization
- **Vector Store**: Amazon OpenSearch Serverless with vector engine, or Pinecone if cost-optimized
- **Query Parsing**: An LLM (e.g., Amazon Bedrock with Claude) to parse complex natural language queries into structured filters + semantic search

### Infrastructure
- **CDN / Edge**: Cloudflare Pages (recommended) or CloudFront
- **Compression**: Brotli on all static assets
- **Offline**: Service workers for offline support on content pages
- **DNS**: Route 53 for subdomain management (usa.wial.org, brazil.wial.org, etc.)

## Webpage Layout Recommendation

### Global Site (wial.org) Layout
```
┌─────────────────────────────────────────────────┐
│  HEADER (sticky)                                │
│  [WIAL Logo] [About] [Certification] [Coaches]  │
│  [Resources] [Events] [Contact] [Login]         │
├─────────────────────────────────────────────────┤
│  HERO SECTION                                   │
│  Tagline + CTA ("Find a Coach" / "Get Certified")│
├─────────────────────────────────────────────────┤
│  ABOUT WIAL (brief)                             │
├─────────────────────────────────────────────────┤
│  CERTIFICATION LEVELS (CALC/PALC/SALC/MALC)     │
├─────────────────────────────────────────────────┤
│  GLOBAL COACH DIRECTORY (search + filters)      │
├─────────────────────────────────────────────────┤
│  CHAPTER MAP / DIRECTORY (links to chapters)    │
├─────────────────────────────────────────────────┤
│  GLOBAL EVENTS CALENDAR                         │
├─────────────────────────────────────────────────┤
│  RESOURCES & LIBRARY                            │
├─────────────────────────────────────────────────┤
│  FOOTER                                         │
│  [Contact] [Privacy] [Terms] [Social Links]     │
│  [Chapter Links] [© WIAL]                       │
└─────────────────────────────────────────────────┘
```

### Chapter Site Layout (e.g., usa.wial.org)
```
┌─────────────────────────────────────────────────┐
│  HEADER (inherited from Global — locked)        │
│  [WIAL Logo] [Chapter Name] [Nav inherited]     │
│  [Local Nav: Team | Events | Resources | Contact]│
├─────────────────────────────────────────────────┤
│  CHAPTER HERO (editable by Chapter_Lead)        │
│  Chapter-specific tagline + imagery             │
├─────────────────────────────────────────────────┤
│  ABOUT THIS CHAPTER (editable)                  │
├─────────────────────────────────────────────────┤
│  LOCAL COACH DIRECTORY (filtered by chapter)    │
├─────────────────────────────────────────────────┤
│  LOCAL EVENTS                                   │
├─────────────────────────────────────────────────┤
│  LOCAL TEAM / LEADERSHIP                        │
├─────────────────────────────────────────────────┤
│  LOCAL RESOURCES                                │
├─────────────────────────────────────────────────┤
│  CONTACT (Executive Director email)             │
├─────────────────────────────────────────────────┤
│  FOOTER (inherited from Global — locked)        │
└─────────────────────────────────────────────────┘
```

## Requirements

### Requirement 1: MVP Website Structure

**User Story:** As a visitor, I want to browse a clean, scroll-down website with core WIAL information, so that I can learn about Action Learning and find relevant resources without complex navigation.

#### Acceptance Criteria

1. THE Platform SHALL render the Global_Site as a single-page scroll-down layout containing the following sections in order: Hero, About WIAL, Certification Information, Coach Directory, Chapter Map, Events Calendar, Resources and Library, and Contact.
2. WHEN a visitor loads the Global_Site landing page, THE Platform SHALL deliver the page with a compressed payload of 200 KB or less.
3. THE Platform SHALL generate all content pages using Static Site Generation at build time.
4. THE Platform SHALL serve all static assets with Brotli compression enabled.
5. THE Platform SHALL deliver fewer than 100 KB of total JavaScript on content pages.
6. WHEN a visitor views the Contact section, THE Platform SHALL display the Executive Director email address as the primary contact method.
7. THE Platform SHALL NOT integrate with any third-party services on the MVP landing page other than the Payment_Gateway and Semantic_Search_Engine defined in this document.

### Requirement 2: Chapter Site Provisioning

**User Story:** As a Chapter_Lead, I want to create a new chapter website with one click, so that I can quickly establish an online presence for my regional chapter.

#### Acceptance Criteria

1. WHEN a Chapter_Lead initiates chapter creation, THE Provisioning_System SHALL create a new Chapter_Site within 60 seconds.
2. WHEN a Chapter_Site is created, THE Provisioning_System SHALL configure the Chapter_Site to be accessible via either a subdomain (e.g., usa.wial.org) or a subdirectory (e.g., wial.org/usa) based on the global configuration.
3. WHEN a Chapter_Site is created, THE Provisioning_System SHALL auto-populate the Chapter_Site with the parent template including all core pages: About, Coach Directory, Events, Team, Resources, and Contact.
4. THE Provisioning_System SHALL restrict chapter creation to authenticated users with the Chapter_Lead role.
5. WHEN a Chapter_Site belongs to an affiliate that offers WIAL as part of a broader suite, THE Provisioning_System SHALL allow the Chapter_Lead to configure an external link back to the affiliate's own website.
6. IF the Provisioning_System fails to create a Chapter_Site, THEN THE Provisioning_System SHALL display a descriptive error message to the Chapter_Lead and log the failure for Super_Admin review.

### Requirement 3: Role-Based Access Control

**User Story:** As a Super_Admin, I want to manage user roles across all chapter sites, so that each user has appropriate permissions for their responsibilities.

#### Acceptance Criteria

1. THE RBAC_System SHALL enforce four distinct roles: Super_Admin, Chapter_Lead, Content_Creator, and Coach.
2. WHILE a user is authenticated as Super_Admin, THE RBAC_System SHALL grant full read and write access to all Chapter_Sites, template management, user management, and revenue dashboards.
3. WHILE a user is authenticated as Chapter_Lead, THE RBAC_System SHALL grant access to create and manage the Chapter_Lead's assigned Chapter_Site, add local coaches, configure payment settings, and manage local content.
4. WHILE a user is authenticated as Content_Creator, THE RBAC_System SHALL grant access to edit content on assigned Chapter_Sites without the ability to modify site structure, navigation, or template settings.
5. WHILE a user is authenticated as Coach, THE RBAC_System SHALL grant read-only access to the Coach_Directory and the ability to update the Coach's own profile.
6. THE RBAC_System SHALL use Amazon Cognito user pools with role-based groups to manage authentication and authorization.
7. IF an unauthenticated user attempts to access a protected resource, THEN THE RBAC_System SHALL redirect the user to the login page.
8. IF an authenticated user attempts to perform an action outside the user's assigned role, THEN THE RBAC_System SHALL deny the action and display an "insufficient permissions" message.
9. WHEN a Chapter_Lead is also the sole Content_Creator for a chapter, THE RBAC_System SHALL allow the Chapter_Lead to perform all Content_Creator actions without requiring a separate account.

### Requirement 4: Consistent Branding and Template Inheritance

**User Story:** As a Super_Admin, I want to enforce consistent branding across all chapter sites, so that the WIAL brand identity remains unified globally.

#### Acceptance Criteria

1. THE Template_Engine SHALL enforce a parent template comprising header, footer, navigation, and global styling across all Chapter_Sites.
2. THE Template_Engine SHALL designate chapter-specific content areas (hero section, about, events, team, local resources) as editable by Chapter_Leads and Content_Creators.
3. WHEN a Super_Admin updates the parent template, THE Template_Engine SHALL auto-deploy the update to all Chapter_Sites within 10 minutes.
4. THE Template_Engine SHALL prevent Chapter_Leads and Content_Creators from modifying global header, footer, navigation structure, or base styling.
5. IF a Chapter_Lead attempts to override a locked template element, THEN THE Template_Engine SHALL reject the change and display a message indicating the element is controlled by the global template.
6. THE Template_Engine SHALL use a design token system via Tailwind CSS to ensure consistent colors, typography, and spacing across all Chapter_Sites.

### Requirement 5: Payment Integration

**User Story:** As a Chapter_Lead, I want to collect dues from affiliates and instructors through Stripe or PayPal, so that WIAL Global receives payments efficiently.

#### Acceptance Criteria

1. THE Payment_Gateway SHALL support dues collection via both Stripe and PayPal.
2. WHEN an affiliate enrolls a student in the eLearning platform, THE Payment_Gateway SHALL charge $50 USD per enrolled student.
3. WHEN a student is fully certified and encoded as a coach, THE Payment_Gateway SHALL charge $30 USD per certified coach.
4. THE Payment_Gateway SHALL process all payments from affiliates and instructors to WIAL Global — students do not pay directly.
5. WHEN a payment is successfully processed, THE Payment_Gateway SHALL generate and send an automated receipt via email to the payer.
6. THE Payment_Gateway SHALL provide chapter-level reporting showing all dues collected for each Chapter_Site.
7. THE Payment_Gateway SHALL provide a global dashboard accessible to Super_Admins showing aggregated revenue across all chapters.
8. WHEN dues remain unpaid past the due date, THE Payment_Gateway SHALL send automated email reminders to the responsible affiliate or instructor at intervals of 7, 14, and 30 days.
9. IF a payment transaction fails, THEN THE Payment_Gateway SHALL notify the payer with a descriptive error and log the failure for Super_Admin review.
10. THE Payment_Gateway SHALL store payment credentials (Stripe API keys, PayPal client secrets) in AWS Secrets Manager and access them at runtime only.

### Requirement 6: Coach Directory

**User Story:** As a visitor, I want to search and filter a directory of certified coaches, so that I can find a qualified Action Learning Coach in my region.

#### Acceptance Criteria

1. THE Coach_Directory SHALL aggregate all certified coaches across all chapters into a single global directory on the Global_Site.
2. THE Coach_Directory SHALL provide chapter-specific directory views filtered by the chapter's region.
3. THE Coach_Directory SHALL display the following fields for each coach: Name, Photo, Certification Level (CALC, PALC, SALC, or MALC), Location, Contact Information, and Bio.
4. THE Coach_Directory SHALL support search by coach name and keyword.
5. THE Coach_Directory SHALL support filtering by location and certification level.
6. WHILE a user is authenticated as Coach, THE Coach_Directory SHALL allow the Coach to update the Coach's own profile fields (Name, Photo, Location, Contact Information, and Bio).
7. THE Coach_Directory SHALL display certification level badges automatically based on the coach's recorded certification level.
8. WHEN a Coach updates their profile, THE Coach_Directory SHALL hold the update in a pending state until the Executive Director reviews and approves the change.
9. WHEN the Coach_Directory page is loaded, THE Platform SHALL deliver the page with a compressed payload of 500 KB or less.
10. THE Coach_Directory SHALL lazy-load coach photos below the fold and serve images in AVIF format with WebP fallback and JPEG as last resort, with no single image exceeding 50 KB.

### Requirement 7: Core Pages

**User Story:** As a visitor, I want to access standard WIAL information pages, so that I can learn about the organization, certification paths, events, and resources.

#### Acceptance Criteria

1. THE Platform SHALL include the following core pages on the Global_Site: About WIAL, Certification Information, Coach Directory, Resources and Library, Events Calendar, and Contact.
2. WHEN a Chapter_Site is provisioned, THE Provisioning_System SHALL auto-generate local versions of the core pages pre-populated with the parent template content.
3. THE Platform SHALL render an Events Calendar that displays both global events and chapter-specific events, with filtering by chapter.
4. WHEN a visitor views a chapter-specific Events Calendar, THE Platform SHALL display only events associated with that chapter plus global events marked as visible to all chapters.
5. THE Platform SHALL render the Resources and Library page with categorized links to WIAL publications, guides, and learning materials.
6. WHEN an image-heavy page (Resources, About) is loaded, THE Platform SHALL deliver the page with a compressed payload of 800 KB or less.

### Requirement 8: AI Cross-Lingual Semantic Coach Directory Search

**User Story:** As a visitor searching in any language, I want to find relevant coaches regardless of the language their profiles are written in, so that language barriers do not prevent me from finding the right coach.

#### Acceptance Criteria

1. THE Semantic_Search_Engine SHALL embed all coach profiles using a multilingual sentence embedding model.
2. THE Semantic_Search_Engine SHALL store coach profile vectors in a vector database.
3. WHEN a visitor enters a natural language search query in any language, THE Semantic_Search_Engine SHALL retrieve relevant coach profiles regardless of the language the profiles are written in.
4. WHEN a visitor enters a complex query (e.g., "experienced coach in São Paulo who speaks English"), THE Semantic_Search_Engine SHALL use an LLM to parse the query into structured filters (location, language) combined with semantic search.
5. WHEN a Coach profile is created or updated and approved, THE Semantic_Search_Engine SHALL re-embed the updated profile and update the vector store within 5 minutes.
6. THE Semantic_Search_Engine SHALL return search results ranked by semantic relevance score.
7. IF the Semantic_Search_Engine is unavailable, THEN THE Coach_Directory SHALL fall back to keyword-based search and filtering and display a notice that AI search is temporarily unavailable.

### Requirement 9: Performance and Global Accessibility

**User Story:** As a visitor accessing the platform from a low-bandwidth region, I want pages to load quickly and work offline, so that I can use the platform reliably regardless of my network conditions.

#### Acceptance Criteria

1. THE Platform SHALL use a system font stack with zero custom web fonts unless explicitly required for WIAL branding.
2. THE Platform SHALL register a Service_Worker on all content pages to enable offline access to previously visited pages.
3. THE Platform SHALL deploy static assets to a CDN with edge locations covering Africa, South America, and Southeast Asia.
4. THE Platform SHALL serve all images in AVIF format as primary, WebP as fallback, and JPEG as last resort.
5. THE Platform SHALL enforce a maximum file size of 50 KB per individual image.
6. THE Platform SHALL lazy-load all images positioned below the initial viewport fold.
7. THE Platform SHALL apply Brotli compression to all static assets served by the CDN.

### Requirement 10: Security and Data Protection

**User Story:** As a Super_Admin, I want the platform to follow security best practices, so that user data and payment information are protected.

#### Acceptance Criteria

1. THE Platform SHALL enforce HTTPS/TLS for all pages and API endpoints.
2. THE Platform SHALL encrypt all data at rest in DynamoDB and S3 using AWS KMS managed keys.
3. THE Platform SHALL store all API keys, payment credentials, and secrets in AWS Secrets Manager and retrieve them at runtime only.
4. THE Platform SHALL redact Personally Identifiable Information (coach names, emails, phone numbers) from CloudWatch logs.
5. THE Platform SHALL validate and sanitize all user input before storage.
6. WHEN a Coach or Chapter_Lead submits profile or content updates, THE Platform SHALL validate the input against defined schemas before persisting changes.
7. THE RBAC_System SHALL validate JWT tokens on all protected API endpoints.
8. THE RBAC_System SHALL enforce Multi-Factor Authentication for Super_Admin accounts.

### Requirement 11: Chapter Revenue and Metrics Tracking

**User Story:** As a Super_Admin, I want to track chapter activity and payment metrics, so that I can measure the health of the global chapter network.

#### Acceptance Criteria

1. THE Platform SHALL track and display the number of active Chapter_Sites on the Super_Admin dashboard.
2. THE Platform SHALL track and display membership growth rate per chapter on the Super_Admin dashboard.
3. THE Payment_Gateway SHALL track and display payment conversion rate per chapter, targeting above 90%.
4. WHEN a Super_Admin views the global dashboard, THE Platform SHALL display aggregated metrics across all chapters including total revenue, active chapters, total coaches, and dues collection status.

## Out of Scope

The following items are explicitly excluded from this P0 requirements document:

- eLearning platform (course delivery, certification tracking, CE credits)
- P1 features: multi-language UI support, organizational client list, testimonials, event management with RSVP, email campaigns, analytics dashboard
- P2 features: mobile app, member forums, job board
