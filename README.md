# Hackathon Sniffer 🎯

An intelligent platform to discover and aggregate hackathon opportunities for developers worldwide.

![Project Status](https://img.shields.io/badge/status-MVP_Complete-green)
![Node.js](https://img.shields.io/badge/node.js-18+-blue)
![Bun](https://img.shields.io/badge/bun-1.1+-blue)
![React](https://img.shields.io/badge/react-18+-blue)
![Express](https://img.shields.io/badge/express-4.18+-green)
![SQLite](https://img.shields.io/badge/sqlite-dev-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Status

✅ **MVP Complete** - The platform is fully functional with ingestion, API, and frontend components.

## What we built

- **Ingestion-first platform**: Automated scrapers discover hackathons from multiple sources (Devpost, etc.)
- **Backend**: Express (Node.js + TypeScript) with SQLite database and integrated ingestion system
- **Frontend**: Next.js (React + TypeScript) with Zustand for state management
- **Smart deduplication**: Prevents duplicate hackathons from multiple sources
- **Responsive design**: Works on desktop and mobile
- **No authentication required**: Open platform for discovering hackathons

## Quick Start

```bash
# Backend (API + Ingestion)
cd backend
npm install
npm run db:migrate
npm run dev  # Start API server

# Run ingestion (separate terminal)
npm run ingest:once  # Populate database with hackathons

# Frontend (separate terminal)
cd frontend
npm install
npm run dev  # Start frontend
```

Visit http://localhost:3000 to see the platform in action!

## Documentation

- [GETTING_STARTED.md](GETTING_STARTED.md) — Complete local development setup
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — Quick setup instructions
- [FEATURES.md](FEATURES.md) — Current features and future roadmap
- [TECHNOLOGY_STACK.md](TECHNOLOGY_STACK.md) — Technical implementation details
- [PROGRESS.md](PROGRESS.md) — Implementation status and completed features
- [INGESTION_SOURCES.md](INGESTION_SOURCES.md) — Supported hackathon sources

## Contributing

The platform is actively maintained and we welcome contributions! Areas of focus:
- Adding new hackathon sources (MLH, Eventbrite, etc.)
- Improving the frontend UI/UX
- Enhancing deduplication algorithms
- Adding new features from the roadmap

## License

MIT — see [LICENSE](LICENSE). 
