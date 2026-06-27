# Absolute Revision

Absolute Revision is a Vite + React + TypeScript assignment tracker with Neon Auth, Neon PostgreSQL, Tailwind CSS, shadcn-style UI primitives, React Router, and Sonner notifications.

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
VITE_NEON_DATABASE_URL=
VITE_NEON_AUTH_URL=
```

Run locally:

```bash
npm run dev
```

Validate before deployment:

```bash
npm run lint
npm run build
```

## Notes

The app initializes the `users` and `assignments` tables on first database access and seeds starter assignments for newly created user rows.

Get `VITE_NEON_AUTH_URL` from your Neon project under **Auth** after enabling Neon Auth.

The requested SPA architecture uses `VITE_NEON_DATABASE_URL`, which exposes the database URL to the browser. For a production deployment, move Neon queries behind serverless API routes or enforce database-side authorization so clients cannot bypass scoped frontend queries.
