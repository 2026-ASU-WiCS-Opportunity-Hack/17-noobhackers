# WIAL Chapter Platform — NoobHackers

A multi-site web platform for the World Institute for Action Learning (WIAL) to manage its global chapter network across 20+ countries. Super Admins create Chapter Leads, who provision country-specific websites with one click, manage coach directories, collect dues via Stripe/PayPal, and enable AI-powered cross-lingual coach search.

## Team "NoobHackers"
- Rashi Sharma
- Shashwat Dwivedi
- Harsh Tita

## Quick Links
| Link | URL |
|------|-----|
| Live Platform | [wial-platform.vercel.app](https://wial-platform.vercel.app) |
| DevPost | [DevPost Submission](https://wics-ohack-sp26-hackathon.devpost.com/) |
| Slack Channel | [#team-17-noobhackers](https://opportunity-hack.slack.com/app_redirect?channel=team-17-noobhackers) |
| Hackathon | [ohack.dev](https://www.ohack.dev/hack/2026_spring_wics_asu) |

## Problem Statement
WIAL is a global non-profit certifying Action Learning Coaches across 20+ countries. They need a unified platform where:
- A Super Admin can onboard new country Chapter Leads
- Each Chapter Lead can create and manage their country's website
- Coaches can be added, searched, and managed per chapter
- Dues ($50/student enrollment, $30/coach certification) are collected via Stripe/PayPal
- An AI-powered semantic search finds coaches across languages and regions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, App Router |
| Deployment (Frontend) | Vercel |
| Backend | AWS Lambda (Python 3.12), API Gateway REST |
| Infrastructure as Code | AWS CDK (TypeScript) |
| Authentication | Amazon Cognito (User Pools, RBAC Groups, MFA) |
| Database | Amazon DynamoDB (6 tables, GSIs) |
| File Storage | Amazon S3 (templates, assets, coach photos) |
| Payments | Stripe SDK, PayPal SDK |
| AI Search | Cohere Embed Multilingual v3.0 (embeddings + cosine similarity in DynamoDB) |
| AI Query Parsing | Cohere Command-R (natural language → structured filters) |
| Email | Amazon SES (receipts, reminders) |
| Secrets | AWS Secrets Manager |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (Frontend)                                      │
│  Next.js 15 + Tailwind CSS                              │
│  SSG/ISR + Service Worker (offline)                     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│  API Gateway REST + Cognito Authorizer                  │
├─────────┬──────────┬──────────┬──────────┬──────────────┤
│ Provisioning │ Coaches │ Payments │ Search │ Auth/Users  │
│ (Lambda)     │(Lambda) │ (Lambda) │(Lambda)│ (Lambda)    │
└─────────┬──────────┬──────────┬──────────┬──────────────┘
          │          │          │          │
    ┌─────▼──────────▼──────────▼──────────▼─────┐
    │  DynamoDB (6 tables)  │  S3 (assets)       │
    │  Cognito (auth)       │  SES (email)       │
    │  Secrets Manager      │  Cohere API        │
    │  (Stripe/PayPal keys) │  (AI embeddings)   │
    └────────────────────────────────────────────┘
```

## Key Features

### 1. Multi-Site Chapter Provisioning
- Super Admin creates Chapter Leads via `/admin/users`
- Chapter Lead logs in and creates their country website at `/{country}/setup`
- One-click provisioning: DynamoDB records, S3 template copy, Route 53 DNS, 6 core pages auto-generated
- Each chapter gets: Home, Coaches, Events, Team, Resources, Contact pages

### 2. Role-Based Access Control (4 roles)
- **Super Admin**: Full platform access, user management, global dashboard
- **Chapter Lead**: Manage their chapter's coaches, content, payments
- **Content Creator**: Edit chapter content (no structural changes)
- **Coach**: View directory, update own profile

### 3. Coach Directory with AI Search
- Global directory aggregating coaches from all chapters
- Chapter-filtered views with "View All" toggle
- AI-powered cross-lingual semantic search via Bedrock embeddings
- Fallback to keyword search when AI is unavailable
- Coach profiles: name, certification level (CALC/PALC/SALC/MALC), location, bio

### 4. Payment Processing
- Stripe and PayPal integration for dues collection
- $50/student enrollment, $30/coach certification
- Payment dashboard with summary cards (Total Paid, Students Enrolled, Coaches Certified)
- Automated receipt emails via SES
- Overdue payment reminders at 7, 14, 30 days

### 5. Chapter-Scoped Navigation
- Each chapter has its own navbar (no global nav overlap)
- Chapter-specific login at `/{country}/login`
- Admin links (Dashboard, Manage Coaches, Content, Payments) visible only to Chapter Leads
- Coach "My Profile" link when logged in as Coach

## Project Structure

```
├── frontend/                    # Next.js 15 App Router
│   ├── app/
│   │   ├── [chapter]/           # Dynamic chapter routes (/{country}/*)
│   │   │   ├── coaches/         # Chapter-filtered coach directory
│   │   │   ├── dashboard/       # Chapter Lead dashboard
│   │   │   ├── manage-coaches/  # Add/edit/delete coaches
│   │   │   ├── payments/        # Stripe/PayPal dues collection
│   │   │   ├── content/         # Edit chapter page content
│   │   │   └── login/           # Chapter-specific login
│   │   ├── admin/               # Super Admin pages
│   │   │   ├── dashboard/       # Global metrics
│   │   │   ├── users/           # User management (create Chapter Leads)
│   │   │   ├── chapters/        # Chapter management
│   │   │   └── payments/        # Global payment dashboard
│   │   ├── coaches/             # Global coach directory with AI search
│   │   ├── components/          # Shared UI components
│   │   └── context/             # Auth context (Cognito)
│   └── public/
│       └── sw.js                # Service worker (offline support)
│
├── backend/                     # AWS CDK + Lambda
│   ├── lambda/
│   │   ├── auth/                # Cognito triggers + user CRUD
│   │   ├── coaches/             # Coach CRUD + Cognito account creation
│   │   ├── provisioning/        # Chapter creation + DNS + template copy
│   │   ├── payments/            # Stripe/PayPal + SES receipts
│   │   ├── search/              # AI semantic search + embeddings
│   │   ├── metrics/             # Revenue aggregation
│   │   ├── templates/           # Template sync across chapters
│   │   └── shared/              # Models, validators, PII filter
│   ├── lib/
│   │   └── wial-platform-stack.ts  # Single CDK stack (all infra)
│   └── scripts/
│       ├── seed_payments.py     # Seed dummy payment data
│       └── setup-cognito-triggers.sh  # Post-deploy Cognito wiring
│
└── .kiro/specs/                 # Spec-driven development docs
```

## Getting Started

### Prerequisites
- Node.js 18+, npm
- Python 3.12+
- AWS CLI configured for `us-east-2`
- AWS CDK CLI (`npm install -g aws-cdk`)

### Backend Deployment
```bash
cd backend
npm install
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-2
cdk deploy --require-approval never

# Post-deploy: wire Cognito triggers
chmod +x scripts/setup-cognito-triggers.sh
./scripts/setup-cognito-triggers.sh
```

### Frontend (Local)
```bash
cd frontend
npm install

# Create .env.local with your API URL and Cognito IDs
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/v1/
NEXT_PUBLIC_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=us-east-2
EOF

npm run dev
```

### Frontend (Production)
```bash
cd frontend
vercel --prod
```

### Create Super Admin
```bash
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 \
  --query "UserPools[?Name=='wial-user-pool'].Id" --output text)

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  Name=given_name,Value=Admin Name=family_name,Value=User \
  --temporary-password TempPass123!

aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID \
  --username admin@example.com --password YourSecurePass123! --permanent

aws cognito-idp admin-add-user-to-group --user-pool-id $USER_POOL_ID \
  --username admin@example.com --group-name SuperAdmins
```

## End-to-End Demo Flow

1. **Super Admin** logs in at `/login` → redirected to `/admin/dashboard`
2. Creates a new Chapter Lead at `/admin/users` (email + password + country)
3. **Chapter Lead** logs in → redirected to `/{country}/dashboard`
4. Creates their chapter website at `/{country}/setup` (auto-provisions 6 pages + 20 dummy payments)
5. Adds coaches at `/{country}/manage-coaches` (with optional login credentials)
6. Views/edits chapter content at `/{country}/content`
7. Collects dues at `/{country}/payments` (Stripe/PayPal)
8. **Coach** logs in → redirected to `/{country}/coaches`
9. Searches for coaches globally using AI-powered search

## DynamoDB Tables

| Table | PK | SK | Purpose |
|-------|----|----|---------|
| wial-chapters | CHAPTER#{id} | METADATA | Chapter metadata + slug |
| wial-coaches | COACH#{id} | PROFILE | Coach profiles + embeddings |
| wial-payments | PAYMENT#{id} | RECORD | Payment records + status |
| wial-pages | CHAPTER#{id} | PAGE#{slug} | Chapter page content |
| wial-templates | TEMPLATE#global | VERSION#{n} | Global template versions |
| wial-users | USER#{sub} | PROFILE | User roles + assigned chapters |

## License
MIT
