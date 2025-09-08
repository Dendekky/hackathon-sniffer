# Hackathon Sniffer — Features (Planned)

Status: Planning (pre-implementation)

This document captures the intended feature set, starting with a small MVP and growing over time. Nothing is implemented yet; this serves as the source of truth for scope and expectations.

## MVP Scope (Ingestion-first — no seeding)

- Automated ingestion (daily crawling)
  - Scrapers and API adapters pull hackathons from multiple public sources
  - Respect robots.txt, rate limits, and add backoff/retry
  - Normalization to a common schema + validation (Zod/validators)
  - Deduplication by URL/domain + content fingerprint
- Discovery UI (live data)
  - List hackathons with title, dates, location (online/onsite), links
  - Basic filters: upcoming vs past, online vs onsite
  - Client-side search over displayed list
- Details
  - Simple detail view with description and key links
- User experience
  - Responsive UI (desktop/mobile)
  - State management with Zustand
- Persistence
  - SQLite (file-based) for development
- No authentication yet

## Post-MVP (Next Iterations)

- Ingestion expansion
  - Add more sources, credentialed APIs where available
  - Source-specific heuristics and richer field mapping
  - Admin tools to review ingestion results
- Better discovery & filtering
  - Server-side pagination and filtering
  - Category/tags, difficulty, prize range
  - Calendar view
- Notifications (basic)
  - Email digests (daily/weekly) without personalization
- Quality and trust
  - Advanced deduplication and validation checks

## Future (Not in scope for initial milestones)

- Personalization & recommendations
  - User preferences and tailored results
- Advanced notifications
  - Real-time alerts, push notifications, scheduling
- Search
  - Full-text search (SQLite FTS or a dedicated service later if needed)
- Analytics
  - Trends, popularity metrics, insights
- Integrations
  - Webhooks, SDKs, calendar integrations

## Data Fields (initial)

- id (UUID/string)
- title
- description (optional)
- start_date, end_date
- registration_deadline (optional)
- location (string), is_online (boolean)
- website_url, registration_url (optional)
- created_at, updated_at

## Non-Goals (for now)

- Authentication/authorization
- Payments/subscriptions
- Elasticsearch or external caches
- Microservices architecture
- Manual data seeding

## Notes

- This file intentionally reflects an ingestion-first MVP consistent with:
  - Backend: Express
  - Database: SQLite
  - Frontend: Next.js + Zustand
  - No authentication initially

If priorities change, update this file first and then adjust the roadmap and tech stack docs.
