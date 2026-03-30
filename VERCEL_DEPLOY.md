# Vercel Deployment

## Recommended setup

Deploy the frontend to Vercel and host the backend on a service that supports persistent databases.

This project's backend currently uses `better-sqlite3` with a local `catalog.db` file. Vercel Functions do not provide shared persistent local storage, so the current backend is not a safe fit for Vercel production deployments.

## Frontend on Vercel

The frontend is ready for Vercel:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL`

Set `VITE_API_BASE_URL` to your deployed backend URL, for example:

```env
VITE_API_BASE_URL=https://your-backend.example.com/api/v1
```

## CLI deploy

From the project root:

```powershell
npx vercel login
npx vercel --cwd frontend
npx vercel --prod --cwd frontend
```

## Dashboard deploy

1. Import the project into Vercel.
2. Set the Root Directory to `frontend`.
3. Add `VITE_API_BASE_URL` in the project's Environment Variables.
4. Deploy.

## Backend options

For the current Express + SQLite backend, use a host with persistent disk or move the database to a hosted service first.

Good next-step options:

- Railway
- Render
- Fly.io
- Supabase Postgres
- Neon Postgres
