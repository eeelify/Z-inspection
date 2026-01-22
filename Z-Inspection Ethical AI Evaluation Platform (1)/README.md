# Z-Inspection Ethical AI Evaluation Platform

Z-Inspection is an ethical AI evaluation platform that enables systematic assessment of AI systems based on EU's 7 ethical principles. The platform supports role-based evaluations, questionnaire versioning, and comprehensive reporting.

**Original Design**: https://www.figma.com/design/rnE7QnlZqdW3femYLWfViy/Z-Inspection-Ethical-AI-Evaluation-Platform

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Email System](#email-system)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 20.x
- npm >= 9.0.0
- MongoDB Atlas account (or local MongoDB)
- Resend API account (for email)

### Local Development

```bash
# Install dependencies
cd backend
npm install

# Configure environment variables (create backend/.env)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/zinspection
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Z-Inspection <noreply@yourdomain.com>

# Start development server
npm start
```

The server will run on `http://localhost:5000` (or `PORT` environment variable).

## Architecture

### Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Email**: Resend API
- **AI Reports**: Google Gemini API
- **Deployment**: Railway

### Project Structure

```
backend/
├── models/              # MongoDB schemas
│   ├── User.js
│   ├── Project.js
│   ├── Question.js
│   ├── Questionnaire.js
│   ├── Response.js
│   └── ...
├── services/           # Business logic
│   ├── emailService.js
│   ├── evaluationService.js
│   ├── geminiService.js
│   └── ...
├── routes/             # API routes
│   ├── evaluationRoutes.js
│   └── reportRoutes.js
├── utils/              # Helper functions
│   ├── guideSelector.js
│   └── ...
├── assets/             # Static files
│   └── guides/         # PDF user guides
├── scripts/            # Migration and seed scripts
└── server.js           # Main entry point
```

### User Roles

- **admin** - Platform administrator
- **ethical-expert** - Ethical evaluation expert
- **medical-expert** - Medical domain expert
- **technical-expert** - Technical evaluation expert
- **legal-expert** - Legal compliance expert
- **education-expert** - Education domain expert
- **use-case-owner** - Project owner

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd Z-Inspection-Ethical-AI-Evaluation-Platform
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Environment Variables

Create `backend/.env` file:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/zinspection?retryWrites=true&w=majority

# Email Configuration (Resend API)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Z-Inspection <noreply@yourdomain.com>
WELCOME_ATTACHMENTS_ENABLED=true

# Optional
NODE_ENV=development
PORT=5000
GEMINI_API_KEY=your-gemini-api-key
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
```

### 4. MongoDB Setup

1. Create MongoDB Atlas account: https://www.mongodb.com/cloud/atlas
2. Create cluster and database named `zinspection`
3. Get connection string and add to `MONGO_URI`
4. Whitelist IP `0.0.0.0/0` (or Railway IPs for production)

### 5. Resend API Setup

1. Create account: https://resend.com
2. Verify your domain
3. Create API key: Dashboard → API Keys → Create API Key
4. Add to `RESEND_API_KEY` environment variable

### 6. PDF User Guides

Place role-specific PDF guides in `backend/assets/guides/`:

- `admin-guide.pdf` - Admin user guide
- `experts-guide.pdf` - Expert roles guide (shared by all expert types)
- `usecase-owner-guide.pdf` - Use-case-owner guide

If PDFs are missing, welcome emails will be sent without attachments.

### 7. Start Server

```bash
npm start
```

Check logs for:
```
🚀 Server running on port 5000
✅ MongoDB Atlas Bağlantısı Başarılı
📧 Email service: ✅ Configured
```

## Configuration

### Environment Variables

#### Required

- `MONGO_URI` - MongoDB connection string
- `RESEND_API_KEY` - Resend API key for email sending

#### Optional

- `EMAIL_FROM` - Email sender address (default: `Z-Inspection <no-reply@resend.dev>`)
- `WELCOME_ATTACHMENTS_ENABLED` - Enable PDF attachments in welcome emails (default: `true`)
- `NODE_ENV` - Environment mode (`development` | `production`)
- `PORT` - Server port (default: `5000`)
- `GEMINI_API_KEY` - Google Gemini API key for AI report generation
- `SERVER_URL` - Backend server URL
- `CLIENT_URL` - Frontend client URL

## API Endpoints

### Authentication

- `POST /api/auth/request-code` - Request verification code
  ```json
  { "email": "user@example.com" }
  ```

- `POST /api/auth/verify-code-and-register` - Verify code and register
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "name": "John Doe",
    "password": "password",
    "role": "admin"
  }
  ```

- `POST /api/login` - User login
  ```json
  {
    "email": "user@example.com",
    "password": "password"
  }
  ```

### Projects

- `GET /api/projects` - List projects (filtered by user role)
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Evaluations

- `POST /api/evaluations/assignments` - Create expert assignment
- `POST /api/evaluations/responses/draft` - Save draft response
- `POST /api/evaluations/responses/submit` - Submit response
- `GET /api/evaluations/responses` - Get responses
- `GET /api/evaluations/scores` - Get aggregated scores

### Reports

- `POST /api/projects/:projectId/reports/generate-pdf` - Generate PDF report
- `GET /api/projects/:projectId/reports/latest` - Get latest report
- `GET /api/reports/:id/file` - Download report file
- `GET /api/reports/list-models` - List available Gemini models

### Health Check

- `GET /api/health` - Server health status

## Data Model

### MongoDB Collections

#### Users
```javascript
{
  name: String,
  email: String (unique),
  password: String,
  role: String, // admin, ethical-expert, medical-expert, etc.
  isOnline: Boolean,
  lastSeen: Date,
  isVerified: Boolean
}
```

#### Projects
```javascript
{
  title: String,
  description: String,
  status: String, // draft, active, completed
  stage: String, // set-up, assess, resolve
  progress: Number,
  assignedUsers: [ObjectId],
  createdByAdmin: ObjectId,
  useCase: Object,
  inspectionContext: Object
}
```

#### Questionnaires
```javascript
{
  key: String, // general-v1, ethical-expert-v1, etc.
  title: String,
  language: String, // en-tr
  version: Number,
  isActive: Boolean
}
```

#### Questions
```javascript
{
  questionnaireKey: String,
  code: String, // T1, E1, etc.
  principle: String, // TRANSPARENCY, HUMAN AGENCY & OVERSIGHT, etc.
  appliesToRoles: [String], // ['any'] or ['ethical-expert']
  text: { en: String, tr: String },
  answerType: String, // single_choice, multi_choice, open_text, numeric
  options: [{
    key: String,
    label: { en: String, tr: String },
    score: Number // 0-4
  }],
  order: Number
}
```

#### Responses
```javascript
{
  projectId: ObjectId,
  userId: ObjectId,
  role: String,
  questionnaireKey: String,
  questionnaireVersion: Number,
  answers: [{
    questionCode: String,
    answer: { choiceKey | text | numeric | multiChoiceKeys },
    score: Number, // 0-4
    scoreSuggested: Number, // For open_text
    scoreFinal: Number,
    reviewerId: ObjectId
  }],
  status: String // draft, submitted, locked
}
```

#### Project Assignments
```javascript
{
  projectId: ObjectId,
  userId: ObjectId,
  role: String,
  questionnaires: [String], // ['general-v1', 'ethical-expert-v1']
  status: String, // assigned, in-progress, completed
  assignedAt: Date,
  completedAt: Date
}
```

### Questionnaire Structure

#### Active Questionnaires

1. **general-v1** - General questions (applies to all roles)
2. **ethical-expert-v1** - Ethical expert questions
3. **medical-expert-v1** - Medical expert questions
4. **technical-expert-v1** - Technical expert questions
5. **legal-expert-v1** - Legal expert questions
6. **education-expert-v1** - Education expert questions

#### Role-Based Access

- All experts see `general-v1` questions
- Role-specific questionnaires are only visible to their respective roles
- Example: `ethical-expert` sees `general-v1` + `ethical-expert-v1`

## Email System

### Verification Email

Sent when user requests registration code:
- Subject: "Your verification code for Z-Inspection Platform"
- Contains 6-digit code valid for 10 minutes
- Uses Resend API

### Welcome Email

Sent after successful registration:
- Subject: "Welcome to Z-Inspection Platform"
- Includes role-specific PDF guide attachment
- Role mapping:
  - `admin` → `admin-guide.pdf`
  - All expert roles → `experts-guide.pdf`
  - `use-case-owner` → `usecase-owner-guide.pdf`

### Email Configuration

**Files:**
- `backend/services/emailService.js` - Email sending functions
- `backend/utils/guideSelector.js` - PDF selection helper

**Functions:**
- `sendVerificationEmail(to, code)` - Send verification code
- `sendWelcomeEmail(to, name, role)` - Send welcome email with PDF
- `sendEmail(to, subject, html, text)` - Generic email sender

**Logging:**
- `[MAIL]` prefix for verification emails
- `[WELCOME]` prefix for welcome emails

## Deployment

### Railway Deployment

#### 1. Setup Railway Account

1. Go to https://railway.app
2. Login with GitHub
3. Connect your repository

#### 2. Create Backend Service

1. **New Service** → **GitHub Repo**
2. Select repository
3. Set **Root Directory**: `backend`
4. Railway will auto-detect and build

#### 3. Configure Environment Variables

In Railway Dashboard → Variables:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/zinspection
NODE_ENV=production
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Z-Inspection <noreply@yourdomain.com>
WELCOME_ATTACHMENTS_ENABLED=true
GEMINI_API_KEY=your-gemini-api-key
SERVER_URL=https://your-backend.railway.app
CLIENT_URL=https://your-frontend.railway.app
```

#### 4. Generate Domain

1. Backend service → **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy backend URL

#### 5. Verify Deployment

Check logs for:
```
🚀 Server running on port 5000
✅ MongoDB Atlas Bağlantısı Başarılı
📧 Email service: ✅ Configured
```

Test health endpoint:
```bash
curl https://your-backend.railway.app/api/health
```

### Railway Configuration Files

- `backend/railway.json` - Railway build settings
- `backend/Procfile` - Process start command
- `backend/nixpacks.toml` - Build configuration
- `backend/package.json` - Dependencies

### Deployment Process

1. Push code to GitHub
2. Railway auto-deploys on push
3. Monitor in **Deployments** tab
4. Check **Logs** for errors

## Troubleshooting

### Server Won't Start

1. Check `MONGO_URI` is set correctly
2. Verify MongoDB connection (check IP whitelist)
3. Check port availability
4. Review logs: `Railway Dashboard → Logs`

### MongoDB Connection Failed

1. Verify `MONGO_URI` format
2. Check MongoDB Atlas IP whitelist (`0.0.0.0/0` for all IPs)
3. Verify username/password
4. Check network connectivity

### Email Not Sending

1. Verify `RESEND_API_KEY` is set
2. Check Resend API key is valid
3. Verify domain is verified in Resend
4. Check logs for `[MAIL]` or `[WELCOME]` errors
5. Ensure `EMAIL_FROM` matches verified domain

### PDF Attachments Missing

1. Verify PDF files exist in `backend/assets/guides/`
2. Check file names match exactly (case-sensitive):
   - `admin-guide.pdf`
   - `experts-guide.pdf`
   - `usecase-owner-guide.pdf`
3. Verify `WELCOME_ATTACHMENTS_ENABLED` is not `false`
4. Check logs for file read errors

### Build Fails on Railway

1. Check `package.json` dependencies
2. Verify Node.js version (20.x)
3. Check `nixpacks.toml` configuration
4. Review build logs in Railway

### API Endpoints Not Working

1. Verify CORS configuration
2. Check authentication tokens
3. Review request/response format
4. Check server logs for errors

## Development

### Running Tests

```bash
npm test                    # Acceptance criteria verification
npm run test:unit          # Unit tests
npm run test:acceptance   # Acceptance tests
npm run test:integration  # Integration tests
npm run test:all          # All tests
```

### Scripts

- `npm start` - Start server
- `npm run migrate:usecasequestions` - Run use case questions migration

### Code Structure

- **Models**: MongoDB schemas (`backend/models/`)
- **Services**: Business logic (`backend/services/`)
- **Routes**: API endpoints (`backend/routes/`)
- **Utils**: Helper functions (`backend/utils/`)
- **Scripts**: Migration and seed scripts (`backend/scripts/`)

## License

ISC

## Support

For issues:
1. Check Railway Dashboard → Logs
2. Test `/api/health` endpoint
3. Verify environment variables
4. Review MongoDB connection
5. Check Resend API status
