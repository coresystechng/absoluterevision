# Setup Guide

This guide covers local development, required environment variables, Neon Auth, Dropbox assignment files, and Vercel deployment.

## Prerequisites

- Node.js 22 or newer
- npm
- Neon project with Auth enabled
- Dropbox app for assignment file uploads
- Vercel project for production deployment

## Install Dependencies

```bash
npm install
```

## Environment Variables

Create `.env.local` for local development:

```bash
VITE_NEON_DATABASE_URL=
VITE_NEON_AUTH_URL=
VITE_DROPBOX_OWNER_USER_ID=

NEON_DATABASE_URL=
DROPBOX_OWNER_USER_ID=
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI=
DROPBOX_TOKEN_ENCRYPTION_KEY=
DROPBOX_ROOT_PATH=
```

Use `.env.example` as the source of truth for required variable names.

## Local Development

Start the Vite development server:

```bash
npm run dev
```

Validate before deploying:

```bash
npm run lint
npm run build
```

Preview the production build locally:

```bash
npm run build
npm run preview
```

## Neon Setup

Enable Neon Auth in your Neon project and copy the Auth URL into:

```bash
VITE_NEON_AUTH_URL=
```

The app initializes the `users` and `assignments` tables on first database access and seeds starter assignments for newly created user rows.

The current SPA architecture uses `VITE_NEON_DATABASE_URL`, which exposes the database URL to the browser. For a hardened production architecture, move Neon queries behind serverless API routes or enforce database-side authorization so clients cannot bypass scoped frontend queries.

## Dropbox Assignment Files

Assignment file uploads use a single owner Dropbox account. Uploads are sent through serverless API routes so Dropbox refresh tokens and access tokens never reach the browser. File metadata is stored in Neon and scoped to an assignment.

### Dropbox App Setup

1. Create an app in the Dropbox App Console.
2. Choose App Folder access unless the app needs full Dropbox access.
3. Add these permissions:

```bash
files.content.write
files.content.read
```

4. Add the deployed callback URL to the app OAuth redirect URIs:

```bash
https://your-domain.com/api/dropbox/callback
```

5. For local testing with `npm run dev`, also add:

```bash
http://localhost:5173/api/dropbox/callback
```

6. Copy the Dropbox app key and app secret into:

```bash
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
```

### Dropbox Environment Notes

- `DROPBOX_OWNER_USER_ID` must match `VITE_DROPBOX_OWNER_USER_ID`.
- Owner ID values must be the Absolute Revision app account ID from **Settings > Account ID**, not a Dropbox `dbid`.
- `DROPBOX_TOKEN_ENCRYPTION_KEY` should be a strong random value, preferably 32 bytes of base64.
- `DROPBOX_REDIRECT_URI` must match the Dropbox OAuth callback URL.
- `DROPBOX_ROOT_PATH` is optional and defaults to `/Absolute Revision`.
- Uploads are sent in 3 MB backend chunks to protect the Dropbox token while supporting files up to 250 MB.

## Vercel Production Setup

Add the same environment variables from `.env.example` to the Vercel project for Production, Preview, and Development as needed.

Vite embeds `VITE_*` values at build time, so redeploy after changing:

```bash
VITE_NEON_AUTH_URL
VITE_NEON_DATABASE_URL
VITE_DROPBOX_OWNER_USER_ID
```

For Neon Auth, add each deployed application origin in **Neon Console > Auth > Configuration > Domains** using the full protocol and no trailing slash.

Examples:

```bash
https://absoluterevision.com
https://www.absoluterevision.com
https://your-project.vercel.app
```

Neon Auth allows localhost automatically for development, but production domains must be added explicitly.

## Production Routing

The app uses React Router in SPA mode. `vercel.json` rewrites authenticated app routes such as `/login`, `/dashboard`, `/settings`, and `/assignments/:id` to `index.html` while leaving `/api/*` available for serverless functions.

## Dropbox Troubleshooting

If the Files panel shows that Dropbox is not configured or the browser console reports `/api/dropbox/status` failing, check these items in order:

1. Confirm all required variables exist in Vercel Production:

```bash
NEON_DATABASE_URL
DROPBOX_OWNER_USER_ID
DROPBOX_CLIENT_ID
DROPBOX_CLIENT_SECRET
DROPBOX_TOKEN_ENCRYPTION_KEY
VITE_DROPBOX_OWNER_USER_ID
```

2. Confirm `DROPBOX_OWNER_USER_ID` and `VITE_DROPBOX_OWNER_USER_ID` are the same Absolute Revision account ID shown in **Settings > Account ID**.
3. Redeploy the Vercel production deployment after changing environment variables.
4. Open the assignment page as the configured owner account.
5. If the Files panel shows **Connect Dropbox**, complete the Dropbox OAuth flow once.
6. If `/api/dropbox/status` still returns a server error, check Vercel function logs for the exact database or Dropbox API error.
