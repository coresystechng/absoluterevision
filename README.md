# Absolute Revision

Absolute Revision is a production-oriented assignment and revision workspace for academic editing services. It combines a polished public website with an authenticated dashboard for tracking assignments, deadlines, priorities, progress, and related file activity.

The app is built with React, TypeScript, Vite, Tailwind CSS, Neon Auth, Neon PostgreSQL, Vercel serverless functions, and Dropbox-backed assignment file storage.

## Features

- Public marketing site for Absolute Revision services, pricing, FAQs, testimonials, and contact flows
- Email/password authentication through Neon Auth
- Protected assignment dashboard with user-scoped assignment data
- Assignment creation, editing, status tracking, priorities, deadlines, and progress metadata
- File upload, download, and management flows backed by Dropbox through serverless API routes
- Theme controls and shadcn-style UI primitives
- Vercel-ready SPA routing and API function structure

## Tech Stack

- React 18 + TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn-style component primitives
- Neon Auth
- Neon PostgreSQL
- Dropbox API
- Vercel serverless functions
- ESLint

## Project Structure

```text
api/                 Vercel serverless API routes
assets/              Static markdown policy content
img/                 Source image assets
server/api/          Shared server-side helpers for API routes
src/api/             Browser API clients
src/components/      Shared React components
src/hooks/           App hooks and context
src/lib/             Auth, database, upload, and domain utilities
src/pages/           Route-level React pages
src/styles/          Global styles
```

## Documentation

For local development, environment variables, Neon Auth, Dropbox setup, and Vercel deployment notes, see [SETUP.md](SETUP.md).

## Quality Checks

```bash
npm run lint
npm run build
```

## License

This project is licensed under the terms in [LICENSE](LICENSE).
