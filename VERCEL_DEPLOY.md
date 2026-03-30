# Vercel Deployment

## Recommended setup

You can deploy the frontend and backend separately on Vercel.

The backend now includes a serverless entrypoint in `backend/api/index.js` and expects Supabase environment variables to be configured in the Vercel project.

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

The frontend also accepts the backend root URL and will normalize it to `/api/v1`, but using the full API URL is recommended for clarity.

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

## Backend on Vercel

The backend can be deployed as its own Vercel project:

- Root directory: `backend`
- Build/runtime config: included in `backend/vercel.json`
- Required environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `CORS_ORIGIN` for your frontend URL, if you want to restrict origins explicitly

After deployment, verify the backend with:

```text
https://your-backend-domain.vercel.app/api/v1/health
```

If the response shows `"databaseConfigured": false`, your Vercel environment variables are missing or named incorrectly.
