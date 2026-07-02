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
VITE_DROPBOX_OWNER_USER_ID=

NEON_DATABASE_URL=
DROPBOX_OWNER_USER_ID=
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI=
DROPBOX_TOKEN_ENCRYPTION_KEY=
DROPBOX_ROOT_PATH=
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

## Dropbox Assignment Files

Assignment file uploads use a single owner Dropbox account. The app sends uploads through serverless API routes so the Dropbox refresh token and access token never reach the browser. File metadata is stored in Neon and scoped to an assignment.

Dropbox app setup:

1. Create an app in the Dropbox App Console.
2. Choose App Folder access unless you need the app to manage your whole Dropbox.
3. Add these permissions:

```bash
files.content.write
files.content.read
```

4. Add the deployed callback URL to the app OAuth redirect URIs:

```bash
https://your-domain.com/api/dropbox/callback
```

For local testing with `npm run dev`, also add:

```bash
http://localhost:5173/api/dropbox/callback
```

5. Copy the app key and app secret into `DROPBOX_CLIENT_ID` and `DROPBOX_CLIENT_SECRET`.

Environment notes:

- `DROPBOX_OWNER_USER_ID` must match `VITE_DROPBOX_OWNER_USER_ID`.
- These owner ID values must be your Absolute Revision app account ID from **Settings > Account ID**, not your Dropbox `dbid`.
- `DROPBOX_TOKEN_ENCRYPTION_KEY` should be a strong random value, preferably 32 bytes of base64.
- `DROPBOX_REDIRECT_URI` must match the Dropbox OAuth callback URL.
- `DROPBOX_ROOT_PATH` is optional and defaults to `/Absolute Revision`.
- Uploads are sent in 3 MB backend chunks to protect your Dropbox token while supporting files up to 250 MB.
