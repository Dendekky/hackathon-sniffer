# Hackathon Sniffer — Technology Stack (MVP)

Status: Planning (pre-implementation)

This document describes the chosen technologies for the initial MVP. The goal is to keep the stack simple and fast to ship.

## Backend

- Runtime: Node.js 18+
- Language: TypeScript
- Framework: Express 4.x with TypeScript
- Database: SQLite (file-based) for development
- ORM/DB Layer: Raw SQL with TypeScript interfaces
- Validation: Zod (TypeScript-first validation)
- Testing: Jest + Supertest (planned)
- Logging: pino (planned)
- API Style: REST (JSON)
- Auth: None initially (no API keys/JWT)

### Ingestion (MVP)

- Language: TypeScript
- Scheduler: node-cron (in-process) for daily runs
- HTTP client: fetch API with retry + backoff
- HTML parsing: Cheerio (static pages); Playwright (fallback for dynamic pages)
- Rate limiting: Bottleneck (in-process)
- Normalization/validation: Zod (TypeScript-first)
- Deduplication: URL canonicalization + content hashing

## Frontend

- Framework: Next.js (React 18 + TypeScript)
- Styling: Tailwind CSS (planned)
- State Management: Zustand
- Component Primitives: Headless UI/Radix UI (TBD)
- Testing: Playwright/RTL (planned)

## Dev & Ops

- Package Manager: Bun (preferred)
- TypeScript: Strict mode enabled across all projects
- Linting/Formatting: ESLint + Prettier with TypeScript rules (planned)
- GitHub Actions: CI for lint, type-check, tests (planned)
- Static checks: robots.txt compliance checks in ingestion tests
- Local Only: No cloud dependencies; no Redis/Elasticsearch

## Non-Goals for MVP

- Authentication/Authorization
- Background job queues
- Elasticsearch or external caches
- Kubernetes/microservices

## Local Conventions (proposed)

- Backend port: 8000
- Frontend port: 3000
- Backend env file:
  - PORT=8000
  - DATABASE_URL=file:./sqlite.db
  - INGEST_CRON="0 3 * * *"  # daily at 03:00 local
  - USER_AGENT="HackathonSnifferBot/0.1 (+contact@example.com)"

## Future Considerations (post-MVP)

- Switch to Postgres for production
- Introduce auth (JWT) and role-based access
- Add background processing (BullMQ/Redis) if needed
- Evaluate search options (SQLite FTS initially; external search later)
- Observability (Sentry, OpenTelemetry)

If any of the above changes, update this document and link to relevant ADRs or PRs.
