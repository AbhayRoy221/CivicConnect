# Database

Schema migrations live in `backend/migrations/`. With the backend environment configured:

```powershell
cd backend
alembic upgrade head
python -m app.seed
```

The seed is safe to run more than once. It creates the five specified departments and categories plus a **General Intake Department** for the `Other` category, which must be manually assigned after intake.
