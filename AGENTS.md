# AGENTS.md - Coding Agent Guidelines

This document provides repository-specific guidance for AI coding agents working in this project.

## Project Overview

Protype Dashboard is a full-stack dashboard for tracking cohort/student progress in Dicoding Coding Camp.
The system scrapes Dicoding Coding Camp data with Selenium, queues scraping work with Redis/ARQ, stores scraped JSON output, logs scrape requests to PostgreSQL, and serves a React dashboard.

## Tech Stack

### Frontend (`/frontend`)

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI primitives
- **State/Fetching**: React Query + `StudentDataContext`
- **Routing**: React Router v6
- **Charts/UI**: Recharts, lucide-react, Sonner
- **Testing**: Vitest + React Testing Library

### Backend (`/backend`)

- **Language**: Python 3.14
- **Framework**: FastAPI
- **Package Manager**: uv
- **Task Queue**: Redis + ARQ
- **Scraping**: Selenium (Standalone Chrome container)
- **Database**: PostgreSQL via SQLModel + asyncpg
- **Monitoring/Notifications**: Discord webhooks, psutil, Prometheus instrumentation

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **Frontend Server**: Vite dev server in development, containerized frontend in production
- **Reverse Proxy**: Frontend container/Nginx in production
- **Browser Automation**: `selenium/standalone-chrome`

## Project Structure

```text
protype-dashboard/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   ├── dashboard/       # Dashboard components
│   │   │   └── landing/         # Landing page sections
│   │   ├── contexts/            # React contexts
│   │   ├── data/                # Data models and static dashboard data
│   │   ├── hooks/               # Frontend hooks
│   │   ├── lib/                 # Utilities and parsers
│   │   ├── pages/               # Route page components
│   │   ├── test/                # Vitest setup and tests
│   │   ├── App.tsx              # Routes and providers
│   │   └── main.tsx             # Entry point
│   ├── vite.config.ts           # Vite config and `/api` proxy
│   └── package.json
│
├── backend/                     # Python FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, Redis pool, monitoring lifecycle
│   │   ├── api/
│   │   │   ├── auth.py          # Optional API key auth via `X-API-Key`
│   │   │   └── routes.py        # Student, scrape, stream, file, stats endpoints
│   │   ├── services/            # Scraper, monitoring, notifications
│   │   ├── utils/               # Data parsing and file handling
│   │   ├── db.py                # Async PostgreSQL session setup
│   │   ├── models.py            # SQLModel tables
│   │   ├── worker.py            # ARQ worker settings and scrape task
│   │   └── run_worker.py        # Worker entrypoint used by Docker Compose
│   ├── output/                  # Scraped JSON data storage
│   └── pyproject.toml           # Python dependencies (uv)
│
├── diCodex/                     # Legacy/reference scraper scripts
├── docker-compose.yml           # Production Docker Compose config
├── docker-compose.dev.yml       # Development Docker Compose config
├── .env.example                 # Environment variable template
└── README.md
```

## Development Workflow

### Docker Development (Recommended)

Run the full stack with hot reloading:

```bash
docker-compose -f docker-compose.dev.yml up
```

- Frontend: `http://localhost:8080`
- Backend API: proxied through `http://localhost:8080/api`
- Selenium Grid: `http://localhost:4444`
- Selenium VNC: `http://localhost:7900` (password: `secret`)
- Redis: `localhost:6379`

Backend is not exposed directly in dev Compose. Use the Vite `/api` proxy unless you explicitly expose backend port for local debugging.

### Local Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite loads env from the repository root via `envDir`. Browser-exposed variables must use the `VITE_` prefix.

### Local Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 3000
```

Local backend requires supporting services/configuration:

- `CONN_PSQL` must point to PostgreSQL. `backend/app/db.py` raises at import time if missing.
- `REDIS_URL` must point to Redis. Default is `redis://redis:6379`, which only works inside Compose.
- `SELENIUM_URL` must point to Selenium/Chrome. Default is `http://selenium:4444`, which only works inside Compose.
- Run worker separately for scrape jobs: `uv run python -m app.run_worker`.

## Environment Variables

Primary template: `.env.example` at repository root.

- `API_KEY`: enables backend API key auth when set. Protected routes require `X-API-Key`.
- `VITE_API_KEY`: frontend API key value exposed to browser.
- `CONN_PSQL`: PostgreSQL connection string. `postgresql://` is converted to `postgresql+asyncpg://` automatically.
- `POSTGRES_TABLE_NAME`: optional table override for request logs.
- `REDIS_URL`: Redis connection for FastAPI and ARQ worker.
- `SELENIUM_URL`: Selenium remote URL.
- `CODINGCAMP_URL`: Dicoding Coding Camp base URL.
- `DISCORD_STATS_WEBHOOK_URL`, `DISCORD_MONITOR_WEBHOOK_URL`, `DISCORD_ALERT_WEBHOOK_URL`: notification targets.
- `MONITOR_INTERVAL`: monitoring interval in seconds.

Never commit real `.env` values, credentials, webhook URLs, tokens, or database passwords.

## Code Style Guidelines

### Frontend (React/TypeScript)

- Use `@/` alias for imports from `frontend/src`.
- Keep components functional and typed.
- Follow existing shadcn/ui and Tailwind patterns.
- Use `cn()` from `@/lib/utils` for conditional class composition.
- Keep route pages in `src/pages`, dashboard UI in `src/components/dashboard`, landing UI in `src/components/landing`.
- Put shared frontend state in contexts only when multiple routes/components consume it.
- Prefer React Query for server state and polling/streaming integration.
- Do not add new UI libraries unless explicitly needed.

### Backend (Python/FastAPI)

- Use `uv` for dependency management. Add packages with `uv add <package>` from `backend/`.
- Use async route handlers and async I/O where practical.
- Keep blocking Selenium work off the event loop. Existing worker uses `asyncio.to_thread`.
- Put API endpoints in `backend/app/api/routes.py` unless a split is clearly warranted.
- Put auth concerns in `backend/app/api/auth.py`.
- Put scraping/business logic in `backend/app/services/`.
- Use SQLModel models in `backend/app/models.py` and sessions from `backend/app/db.py`.
- Keep request logging and webhook notifications aligned with worker events: `started`, `completed`, `failed`.
- Avoid printing secrets. Mask database URLs, API keys, credentials, and webhook URLs.

## API Notes

- Public routes live on `public_router`; protected routes live on `router` with `require_api_key`.
- API key auth is skipped when `API_KEY` is empty.
- Scraping flow: `POST /api/scrape` enqueues ARQ job, `GET /api/scrape/status/{job_id}` polls status, `GET /api/scrape/stream/{job_id}` streams SSE progress.
- Student data endpoints transform latest or selected scraped JSON through `DataTransformer`.
- Landing stats use PostgreSQL `RequestLog` records.

## Testing and Checks

### Frontend

Run from `frontend/`:

```bash
npm run lint
npm run test
npm run build
```

### Backend

No pytest suite is currently documented. For backend changes, run import/startup checks with `uv` when services/env are available:

```bash
uv run uvicorn app.main:app --reload --port 3000
```

For worker changes, verify worker startup when Redis/PostgreSQL env is available:

```bash
uv run python -m app.run_worker
```

If required external services are unavailable, state exactly which check could not run and why.

## Common Tasks

### Adding a UI Component

1. Run `npx shadcn@latest add <component-name>` in `frontend/`.
2. Customize generated files in `frontend/src/components/ui/` only as needed.
3. Use the component from feature folders via `@/components/ui/...`.

### Modifying Scraper Behavior

1. Edit `backend/app/services/scraper.py`.
2. Keep Selenium selectors resilient and explicit.
3. Preserve progress callback behavior used by the worker/SSE flow.
4. Test through Compose when possible so Selenium, Redis, PostgreSQL, and worker behavior match runtime.

### Modifying Job Queue Behavior

1. Update `backend/app/worker.py` for ARQ task execution, retries, timeouts, and progress writes.
2. Update `backend/app/api/routes.py` if response shape or status flow changes.
3. Verify frontend polling/SSE consumers still handle `queued`, `in_progress`, `complete`, and `not_found`.

### Modifying Monitoring or Notifications

- System monitoring lives in `backend/app/services/monitoring.py`.
- Scrape notifications live in `backend/app/services/notification.py`.
- Keep Discord webhook env vars optional and safe when unset.

## Agent-Specific Cautions

- Treat `diCodex/` as reference/legacy unless the task explicitly targets it.
- Do not commit generated scrape output from `backend/output/` unless explicitly requested.
- Do not change `.env` with real secrets.
- Before changing Docker networking or ports, check both Compose files and Vite proxy config.
- Prefer small, localized edits that preserve current frontend/backend contracts.
