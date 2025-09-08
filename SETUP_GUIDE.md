# Hackathon Sniffer - Quick Setup Guide

This guide will get you up and running with the Hackathon Sniffer platform in development mode.

## Prerequisites

- Node.js 18+ 
- Bun 1.1+ (recommended) or npm
- Git

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
bun install  # or npm install

# Set up environment
cp env.example .env

# Run database migrations
bun run db:migrate up

# Start the backend server
bun run dev
```

The backend API will be available at `http://localhost:8000`

### 2. Ingestion Setup (Now Integrated in Backend)

```bash
# Ingestion is now part of the backend - no separate setup needed!
# From the backend directory, run ingestion commands:

cd backend  # if not already there

# Run ingestion once to populate database
npm run ingest:once  # or bun run ingest:once

# Or run ingestion on schedule
npm run ingest:watch  # or bun run ingest:watch
```

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
bun install  # or npm install

# Start the development server
bun run dev
```

The frontend will be available at `http://localhost:3000`

## Verify Setup

1. **Backend Health Check**: Visit `http://localhost:8000/health`
2. **API Test**: Visit `http://localhost:8000/api/hackathons`
3. **Frontend**: Visit `http://localhost:3000`

## Development Workflow

### Running Ingestion

```bash
# Run ingestion once (from backend directory)
cd backend && npm run ingest:once  # or bun run ingest:once

# Run ingestion on schedule (daily at 3 AM by default)
cd backend && npm run ingest:watch  # or bun run ingest:watch
```

### Database Operations

```bash
# Run migrations
cd backend && bun run db:migrate up

# Rollback to specific version
cd backend && bun run db:migrate down <version>
```

### Development Servers

```bash
# Backend (with hot reload)
cd backend && bun run dev

# Frontend (with hot reload)
cd frontend && bun run dev

# Ingestion worker (watch mode) - now part of backend
cd backend && bun run ingest:watch
```

## Project Structure

```
hackathon-sniffer/
├── backend/           # Express API server + Ingestion system
│   ├── src/
│   │   ├── ingestion/ # Web scraping system (consolidated)
│   │   │   ├── adapters/ # Source-specific scrapers (Devpost, etc.)
│   │   │   ├── cli.ts    # Command-line interface
│   │   │   ├── scheduler.ts # Cron-based scheduler
│   │   │   └── utils/    # HTTP client, deduplication
│   │   ├── db/       # Database connection and migrations
│   │   ├── models/   # Data access layer
│   │   ├── routes/   # API endpoints
│   │   └── types/    # TypeScript types
│   └── package.json  # Now includes ingestion dependencies
├── frontend/          # Next.js React app
│   ├── src/
│   │   ├── app/      # App Router pages
│   │   ├── components/ # React components
│   │   └── store/    # Zustand state management
│   └── package.json
└── docs/             # Documentation
```

## Environment Variables

### Backend (.env) - Now includes ingestion settings
```
# Server settings
PORT=8000
DATABASE_URL=file:./sqlite.db
NODE_ENV=development
LOG_LEVEL=info

# Ingestion settings (consolidated into backend)
INGEST_CRON=0 3 * * *
USER_AGENT=HackathonSnifferBot/0.1 (+contact@example.com)
REQUEST_TIMEOUT_MS=15000
MAX_CONCURRENCY=3
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Troubleshooting

### Common Issues

1. **Database locked**: Stop all processes and restart
2. **Port conflicts**: Change PORT in backend/.env
3. **CORS errors**: Check frontend API URL configuration
4. **Ingestion fails**: Verify robots.txt compliance and rate limits

### Logs

- Backend logs: Console output when running `bun run dev`
- Ingestion logs: Console output with detailed scraping information
- Frontend logs: Browser console and Next.js terminal

## Next Steps

1. Review the [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) for development phases
2. Check [PROGRESS.md](PROGRESS.md) for current implementation status
3. See [FEATURES.md](FEATURES.md) for planned functionality

## Contributing

1. Follow the existing code structure and TypeScript conventions
2. Run linting: `bun run lint` in each directory
3. Test changes manually using the development setup
4. Update documentation as needed

## Support

Check the project documentation in the root directory:
- `README.md` - Project overview
- `TECHNOLOGY_STACK.md` - Technical decisions
- `FEATURES.md` - Feature specifications
