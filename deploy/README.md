Deployment quick actions

1) Deploy backend to Render (quick)

- Connect your GitHub repo to Render and create a new **Web Service**.
- Use `main` branch, Build Command: `npm ci`, Start Command: `npm run backend`.
- Add environment variables: `DATABASE_URL` and `PORT=4000`.
- After deploy note the public URL (e.g. `https://payroll-api.onrender.com`).

2) Configure Vercel to forward `/api` to your backend

- Option A (recommended): Set `VITE_API_URL` in Vercel Project Settings → Environment Variables to your backend URL and redeploy.

  Example using Vercel CLI:

  ```bash
  vercel env add VITE_API_URL production
  # paste: https://payroll-api.onrender.com
  vercel --prod
  ```

- Option B: Use `vercel.json` rewrites (this rewrites paths at the CDN level).

  Replace the placeholder in `vercel.json` with your backend URL:

  ```json
  {
    "rewrites": [
      { "source": "/api/(.*)", "destination": "https://payroll-api.onrender.com/api/$1" }
    ]
  }
  ```

3) Quick local check (after backend is running locally on port 4000):

```bash
# start backend
npm run backend
# start frontend
npm run dev
# test login against local backend
curl -X POST http://localhost:5173/api/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"password123"}' -v
```
