# Hackathon Sniffer — Implementation Roadmap (MVP)

Status: Planning (pre-implementation)

This roadmap outlines a lean path to an ingestion-first MVP using Express (Node.js), a headless ingestion worker (scrapers/APIs), SQLite, and a Next.js frontend with Zustand. No authentication or external infra in MVP (no Redis/queues); scheduling is in-process.

## Timeline Overview (6 weeks)

```
Phase 1: MVP (Weeks 1-4)
├── Week 1: Repo, scaffolds, minimal data model, ingestion foundations
├── Week 2: Ingestion adapters stable (Devpost/MLH/Eventbrite), read-only API
├── Week 3: Next.js UI (list/detail, filters, Zustand)
└── Week 4: Server filters/pagination, basic search, polish

Phase 2: Hardening (Weeks 5-6)
├── Week 5: Testing, accessibility, perf passes
└── Week 6: Docs, packaging, MVP release
```

---

## Phase 1: MVP (Weeks 1-4)

### Week 1 — Project setup
- Backend: Express scaffold (TypeScript), SQLite file DB
- Define minimal schema (hackathons table) and ingestion tables (raw_events, sources)
- Ingestion worker scaffold: scheduler (node-cron), rate limiter, HTTP client (TypeScript)
- Basic `/health` endpoint
- Repo scripts: `dev`, `build`, `ingest:once`, `ingest:watch`
- Frontend: Next.js scaffold with Tailwind + Zustand (TypeScript)

Success criteria:
- Repo installs and runs locally (frontend 3000, backend 8000)
- Ingestion worker runs once locally and persists normalized hackathons

### Week 2 — Ingestion adapters + Read-only API
- Sources (initial): Devpost, MLH, Eventbrite (public pages/APIs as allowed)
- Adapters: HTML parsing (Cheerio/Playwright TBD), data normalization, deduplication
- Endpoints:
  - `GET /api/hackathons` — list with optional basic filters (is_online, date window)
  - `GET /api/hackathons/:id` — detail
- Validation: minimal request validation (Zod with TypeScript)
- Error handling and structured logging

Success criteria:
- Ingestion runs on a schedule locally and on demand
- API serves ingested data with stable shape
- Basic filters work and are predictable

### Week 3 — Frontend list + detail
- Pages: list, detail
- Components: HackathonCard, FilterPanel, SearchBar (client-side search)
- State: Zustand store for filters/search/query params
- Styling: Tailwind; responsive layout

Success criteria:
- Users can browse and view details comfortably on desktop and mobile
- Client-side search filters the in-memory list

### Week 4 — Server filters, pagination, basic search
- Server-side pagination (page, limit)
- Filters: date range, is_online, location (string match)
- Basic search: title/description LIKE (SQLite) with simple ranking
- DX polish: 404/500 pages, loading/empty states

Success criteria:
- List page uses server pagination and filters
- Simple search returns expected items quickly

---

## Phase 2: Hardening (Weeks 5-6)

### Week 5 — Quality pass
- Testing:
  - Backend: Supertest for API
  - Frontend: Playwright/RTL smoke tests for core flows
- Accessibility: color contrast, focus states, keyboard nav
- Performance: image optimization, bundle trimming

Success criteria:
- Green test suite locally and in CI
- Baseline a11y checks pass on key pages

### Week 6 — Docs and MVP release
- Documentation:
  - Update GETTING_STARTED.md, FEATURES.md, TECHNOLOGY_STACK.md
  - Minimal API doc in README (or /docs endpoint served statically)
- Versioning/tagging for MVP release
- Collect feedback plan

Success criteria:
- Clean run from fresh clone to working app
- MVP tag created and changelog entry added

---

## Out of Scope for MVP (defer)
- Authentication/authorization
- Notifications, push or email
- Webhooks or SDKs
- Redis/Elasticsearch or other infra
- Mobile app
- Manual data seeding

## Minimal Data Model (initial)
- id
- title
- description (optional)
- start_date, end_date
- registration_deadline (optional)
- location (string), is_online (boolean)
- website_url, registration_url (optional)
- created_at, updated_at

## Local Conventions
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Env: `PORT=8000`, `DATABASE_URL=file:./sqlite.db`

If priorities change, adjust this roadmap first, then update linked docs.
