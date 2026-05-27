# Payroll Salary System

A modern, responsive payroll management dashboard built with React, TypeScript, and Vite.

## Features

- Employee management and payroll overview
- Timesheet and attendance tracking
- Payroll processing and payslip generation
- Reporting and security settings
- Responsive layout with sidebar navigation

## Technologies

- React
- TypeScript
- Vite
- Tailwind CSS
- Express backend

## Getting Started

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Or use the new shortcut:

```bash
npm start
```

Open the local development URL shown in the terminal to view the app. Vite starts on `http://localhost:8080` by default and will use the next available port if `8080` is already in use (for example, `http://localhost:8081`).

### Deployment

This app requires both the frontend and backend to be available for login and data access.

#### Frontend deployment

The frontend can be deployed as a static Vite app using Vercel or Netlify.

- `vercel.json` is provided for Vercel.
- `netlify.toml` is provided for Netlify.

On a deployment service, set the following build settings:

- Build command: `npm run build`
- Publish directory: `dist`

If the frontend and backend are deployed on different hosts, set `VITE_API_URL` to the backend base URL in your deployment environment.

Example for a separate backend host:

```env
VITE_API_URL=https://api.yourdomain.com
```

If the backend is hosted on the same origin as the frontend, leave `VITE_API_URL` empty.

#### Backend deployment

The backend is in `backend/index.js` and must be deployed separately as a Node/Express service.

The backend service should be reachable from the deployed frontend at the URL configured in `VITE_API_URL`.

Example backend environment variables:

```env
DATABASE_URL=postgresql://postgres:postgres@your-db-host:5432/payroll_system
PORT=4000
```

#### Deploying the backend to Render (quick)

1. Create an account at https://render.com and connect your GitHub repo.
2. Create a new **Web Service** and select your repository and `main` branch.
3. Set the following values:
	- **Environment**: `Node`
	- **Build Command**: `npm ci`
	- **Start Command**: `npm run backend`
	- **Health Check Path**: `/`
4. Add environment variables in Render for `DATABASE_URL` and `PORT` (use `4000`).
5. Deploy — Render will provide a public URL (for example `https://payroll-api.onrender.com`).

After Render deploys, set `VITE_API_URL` in Vercel to the Render URL (see below).

#### Set `VITE_API_URL` on Vercel

From Vercel dashboard (recommended): Project → Settings → Environment Variables → Add `VITE_API_URL` = `https://your-backend-url` and redeploy.

Or using Vercel CLI:

```bash
vercel env add VITE_API_URL production
# paste your backend URL when prompted
vercel --prod
```

### Docker deployment

You can start the full stack locally with Docker Compose:

```bash
docker compose up --build
```

This starts:
- `db` on `localhost:5432`
- `backend` on `http://localhost:4000`
- `frontend` on `http://localhost:5173`

If you deploy the frontend to a public host, the backend must still be reachable from the deployed frontend. Set `VITE_API_URL` to the public backend URL in your host settings.

### Demo/fallback mode

For convenience, the frontend includes a demo fallback auth mode that allows signing in using sample accounts when the backend is unreachable. This is useful to preview the UI but NOT suitable for production.

Sample accounts:

- `admin@example.com` / `password123`
- `hr@example.com` / `password123`
- `employee@example.com` / `password123`

When fallback mode is active a small banner appears in the UI indicating demo mode.

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Backend

This project now uses PostgreSQL as the backend database with Express in `backend/index.js`.

### Environment variables

Create a `.env` file in the repository root with:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payroll_system
PORT=4000
```

If you do not have PostgreSQL installed, the backend will still start in fallback in-memory mode for local testing.

### Run the backend server

```bash
npm run backend
```

Be sure to start the backend before running the frontend.

If port `4000` is already in use, stop the other process or set `PORT` to another value in `.env`.

Alternatively, start the database, backend, and frontend together with Docker Compose:

```bash
docker compose up --build
```

> Note: Docker must be installed and available on your PATH to run this command.
> On Windows, install Docker Desktop and restart your terminal.

This starts:
- `db` on `localhost:5432`
- `backend` on `http://localhost:4000`
- `frontend` on `http://localhost:5173`

Open the frontend at `http://localhost:5173` after the services are ready.

Docker Compose includes health checks for Postgres and the backend, so the stack can report readiness more reliably.

The backend is available at `http://localhost:4000` and provides these endpoints:

- `GET /api/employees` — list all employees
- `GET /api/employees/:id` — fetch a single employee profile
- `POST /api/employees` — create a new employee
- `PUT /api/employees/:id` — update an employee profile
- `DELETE /api/employees/:id` — delete an employee
- `GET /api/payroll` — list all payroll records
- `POST /api/payroll-records` — create payroll records
- `PUT /api/payroll-records/:id` — update payroll record status
- `GET /api/leave-requests` — list leave requests
- `POST /api/leave-requests` — submit a new leave request
- `PUT /api/leave-requests/:id` — update leave request status
- `GET /api/attendance` — list attendance data
- `POST /api/attendance` — add an attendance record
- `GET /api/audit-logs` — list audit logs
- `POST /api/audit-logs` — create an audit entry
- `POST /api/payslips` — create a payslip payload

## Project Structure

- `src/` – application source files
- `src/components/` – UI and payroll components
- `src/contexts/` – React context providers
- `src/data/` – sample payroll data
- `src/hooks/` – custom hooks
- `src/lib/` – utility modules and third-party integrations
- `src/pages/` – page components and routes

## Notes

- Update the app metadata in `index.html` as needed.
- The frontend now uses the local backend instead of Supabase.

## Upcoming Enhancements

- Real Login System
- Employee Portal
- Clock In System

## License

This repository is provided as-is. Customize it for your own payroll application.
