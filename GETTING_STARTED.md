# Hackathon Sniffer — Getting Started

Status: ✅ MVP Implementation Complete

This guide explains how to run the project locally. The hackathon discovery platform is now fully implemented with ingestion, API, and frontend components.

## Prerequisites

- Node.js 18+
- npm or Bun 1.1+
- Git

## Architecture Overview

The platform consists of three main components:

- **Backend**: Express (Node.js + TypeScript) with SQLite database and integrated ingestion system
- **Frontend**: Next.js (React + TypeScript) with Zustand for state management  
- **Ingestion**: Built into the backend as a module with scheduler, scrapers, and deduplication

Current workspace layout:

```
hackathon-sniffer/
├── backend/                 # Express API + Ingestion (Node.js + TypeScript)
│   ├── src/
│   │   ├── ingestion/      # Ingestion system (moved from standalone)
│   │   │   ├── adapters/   # Source-specific scrapers (Devpost, etc.)
│   │   │   ├── cli.ts      # Command-line interface
│   │   │   ├── scheduler.ts # Cron-based scheduler
│   │   │   └── utils/      # HTTP client, deduplication
│   │   ├── routes/         # API endpoints
│   │   ├── models/         # Database models
│   │   └── db/             # Database connection & migrations
│   ├── package.json
│   ├── tsconfig.json
│   └── sqlite.db           # SQLite database
├── frontend/                # Next.js app (React + TypeScript)
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   └── store/          # Zustand state
│   ├── package.json
│   └── tsconfig.json
└── docs/                   # Documentation files
```

## Local Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/hackathon-sniffer.git
cd hackathon-sniffer

# Backend (Express + TypeScript + SQLite + Ingestion)
cd backend
npm install          # Install all dependencies (includes ingestion deps)
npm run db:migrate   # Set up database schema
npm run dev          # Run API server in development mode

# Run ingestion (in the same backend directory) — new terminal
npm run ingest:once  # Run a single ingestion pass
# or
npm run ingest:watch # Run on schedule (cron-based)

# Frontend (Next.js + TypeScript + Zustand) — new terminal
cd frontend
npm install
npm run dev          # Run frontend with hot reload
```

Expected local URLs:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Health Check: http://localhost:8000/health

## Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Copy the example environment file
cd backend
cp env.example .env
```

Backend environment variables (`.env`):
```
PORT=8000
DATABASE_URL=file:./sqlite.db
NODE_ENV=development
LOG_LEVEL=info

# Ingestion settings (now part of backend)
INGEST_CRON=0 3 * * *
USER_AGENT=HackathonSnifferBot/0.1 (+contact@example.com)
REQUEST_TIMEOUT_MS=15000
MAX_CONCURRENCY=3
```

No authentication or third-party keys are required for the MVP; use only public pages/APIs that permit crawling.

## Available Scripts

### Backend + Ingestion (from `backend/` directory)
```bash
npm run dev          # Start API server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run ingest:once  # Run ingestion once (populate database)
npm run ingest:watch # Run ingestion on schedule (daily)
npm run lint         # Run ESLint
npm run test         # Run tests
```

### Frontend (from `frontend/` directory)
```bash
npm run dev          # Start Next.js development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Verify Setup

1. **Backend Health**: Visit http://localhost:8000/health
2. **API Test**: Visit http://localhost:8000/api/hackathons
3. **Frontend**: Visit http://localhost:3000
4. **Ingestion Test**: Run `npm run ingest:once` in backend directory

## Next Steps

- See [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md) for technical implementation details
- See [FEATURES.md](FEATURES.md) for current and planned features  
- See [PROGRESS.md](PROGRESS.md) for implementation status
- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions


