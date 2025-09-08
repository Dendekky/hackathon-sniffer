# Hackathon Sniffer — Ingestion Sources (Initial)

Status: Planning (pre-implementation)

This document lists initial public sources for hackathon discovery, with notes on approach and field mapping. Use only sources whose terms allow crawling; respect robots.txt and fair use.

## Initial Sources (MVP)

- Devpost
  - Approach: Public listing pages; HTML parsing; pagination
  - Notes: Normalize dates/timezones; capture project submission deadlines if present
- MLH (Major League Hacking)
  - Approach: Public season schedule pages; HTML parsing
  - Notes: Some events are partner-hosted; ensure location/online flags
- Eventbrite (public hackathon searches)
  - Approach: Public search results pages; HTML parsing with query filters
  - Notes: Highly dynamic; may require Playwright fallback

## Candidate Sources (post-MVP)

- Meetup (public) — group and event pages
- Gitcoin/Protocol Labs/ETHGlobal — ecosystem-specific listings
- University calendars — departmental hackathon pages

## Field Mapping (normalized schema)

- id: generated UUID (stable per canonical URL)
- title: string
- description: optional string (sanitized)
- start_date, end_date: ISO 8601
- registration_deadline: optional ISO 8601
- location: string; is_online: boolean
- website_url: canonical event page URL
- registration_url: optional
- source: enum/string (e.g., "devpost", "mlh", "eventbrite")
- created_at, updated_at: timestamps

## Deduplication

- Canonicalize URLs (strip tracking params, normalize host)
- Content hash of title+dates+host to detect near-duplicates
- Prefer primary source over aggregators when duplicates found

## Scheduling & Limits (MVP)

- Default schedule: daily at 03:00 local via `INGEST_CRON`
- Concurrency: small (e.g., 2-3) with Bottleneck
- Backoff: exponential retry up to 3 attempts per request
- User-Agent: `HackathonSnifferBot/0.1 (+contact@example.com)`

## Compliance

- Check and honor robots.txt for each domain
- Avoid login-gated or rate-limited APIs without permission
- Remove content upon request from hosts

If sources change or break, update this file alongside adapter updates.


