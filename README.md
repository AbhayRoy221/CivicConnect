# AI Civic Issue Reporting Platform

React + TypeScript frontend, FastAPI/PostgreSQL backend, deterministic AI demo classifier, and role-based civic reporting workflow.

## Start the full stack

1. Install and start Docker Desktop.
2. Copy `.env.example` to `.env`.
3. Replace `POSTGRES_PASSWORD` and `JWT_SECRET` in `.env` with long local secrets. Keep the `DATABASE_URL` password in sync.
4. Run `docker compose up --build`.
5. Visit `http://localhost:5173`; API documentation is at `http://localhost:8000/docs` and health is at `http://localhost:8000/api/health`.

Startup applies migrations and seeds the departments/categories. `Other` enters **General Intake** for manual reassignment.

## Demo credentials — change before any real deployment

The seed script creates these accounts using the `DEMO_*` settings in `.env`:

| Account | Email | Password |
|---|---|---|
| Administrator | `admin@demo.local` | `ChangeMe123!` |
| Sanitation officer | `officer@demo.local` | `ChangeMe123!` |

Public registration always creates a Citizen.

## Features implemented

- Citizen signup/login, JWT authentication, roles, bilingual account preference (English/Hindi)
- Image validation, local file storage, browser GPS/manual map/address location
- Deterministic AI category suggestion that never overrides the citizen's choice
- Automatic category-to-department routing, manual reassignment, officer queue
- Complaint tracking timeline, resolution-evidence gate, duplicate flags
- In-app notifications, admin analytics/user listing, audiyt logging
- Alembic migrations, seed data, lint/test/build CI

The classifier is deliberately a reliable demo adapter based on filename keywords plus a content hash fallback. Replace `backend/app/services.py:classify_demo_image` with a trained model adapter later; its API response stays the same.

## Local commands

```powershell
# Backend (activate the local environment first)
cd backend
alembic upgrade head
python -m app.seed
pytest

# Frontend
cd frontend
npm ci
npm run build
```

## Project layout

- `frontend/` — Vite, React, TypeScript, Tailwind, Leaflet map
- `backend/` — FastAPI API, models, migration, seed data, tests
- `ml/` — future trained-model integration
- `database/` — migration guidance
- `.github/workflows/` — CI
