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
VITE_NEON_BROWSER_URL=
VITE_NEON_AUTH_URL=
VITE_DROPBOX_OWNER_USER_ID=

NEON_DATABASE_URL=
NEON_AUTH_URL=
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

Server database initialization runs the legacy schema migrations. The browser checks that the schema is ready and seeds starter assignments for newly created user rows; it does not run DDL. On an empty database, initialize it through a server API before using the dashboard.

The current SPA architecture uses `VITE_NEON_BROWSER_URL`, which exposes the database URL to the browser. For a hardened production architecture, move Neon queries behind serverless API routes or enforce database-side authorization so clients cannot bypass scoped frontend queries.

### Client submissions inbox

Open **Dashboard → Client submissions** (or the user menu) to review public uploads. The Dropbox owner and admins of teams whose `admin_user_id` is that owner can access new submissions. After conversion, team admins see submissions assigned to their team; the owner can see all their submissions. Team members cannot access this inbox.

Before enabling intake, configure `NEON_DATABASE_URL` with a **server-only database role** and `VITE_NEON_BROWSER_URL` with a **different browser role**, both pointing to the same database. The browser role must not be a superuser or inherit the server role. Preserve that browser role's existing access to the legacy app tables; never grant it access to `client_submissions` or `client_submission_files`. The server role must be able to run the existing schema initializer and create/own the new tables. The initializer checks role separation and revokes browser/PUBLIC privileges on these two private tables. Using the same role for both URLs returns HTTP 503 instead of exposing client details or upload credentials.

For an existing owner-role deployment, run `node scripts/prepare-browser-database-role.mjs` locally with the administrative database connection in `.env`. It creates `absolute_revision_browser` using SQL (not the Neon console's privileged role creation), grants DML on only the seven existing SPA tables and their sequences, and checks that it cannot inherit the server role or read Dropbox credentials. It makes no changes to existing records or table ownership. The browser connection is saved in `.git/client-submissions-browser.env`, never printed or committed. Do not rerun against an existing role; inspect it instead.

Add `VITE_NEON_BROWSER_URL` as a new Vercel **Config** variable. The old `VITE_NEON_DATABASE_URL` Secret can remain for rollback; this release never reads it in the browser or uses it for the inbox privacy check. Existing Vercel Secrets cannot be changed to Config.

Set Vercel **Preview** `VITE_NEON_BROWSER_URL` to that new value, keep `NEON_DATABASE_URL` on the existing owner connection, and redeploy the release branch. Once the inbox and dashboard work, apply the browser value to **Production** before releasing the branch. The existing browser connection exposed the owner's password in past builds: rotate that owner password in Neon and update server `NEON_DATABASE_URL` in Vercel during the production cutover, then redeploy. Update local administrative credentials too. Never put the new owner connection in a `VITE_*` variable. Older deployments using the owner connection will no longer function after its password is rotated; rollback must use rebuilt code with restricted credentials.

This isolates private inbox and Dropbox tables. The seven legacy SPA tables still use direct browser SQL and require a separate API/authorization migration for full per-user database isolation.

Set server `DROPBOX_OWNER_USER_ID` and browser `VITE_DROPBOX_OWNER_USER_ID` to the same owner ID. `NEON_AUTH_URL` must match the Neon Auth service used by the app. Inbox, download, conversion, and assignment-file requests verify signed Neon session JWTs and then check team permissions on the server. Existing assignment-file clients must be redeployed together with these APIs because a user-ID header alone is no longer accepted.

The new tables and inbox index are created automatically on first intake/inbox request. No existing assignment data is changed by their creation. Client selection creates one intake record for 1–3 files, with hashed upload credentials that expire after 24 hours. Successful files appear together in the inbox and in one Dropbox client folder. Failed-file retries retain their original submission and file positions. Finalizing a partial upload marks its unfinished files as failed so an admin can convert the successfully uploaded files.

**Create assignment** lets an admin choose their team, assignee, title, type, priority, deadline, and notes. Conversion commits the assignment, client contact notes, uploaded files as Brief attachments, activity entry, and conversion marker in one PostgreSQL statement. Repeated conversion requests return the existing assignment. Files stay in Dropbox; the assignee uses the normal assignment Files section to download them. No email is sent automatically.

Uploads made before this feature was enabled remain in Dropbox and are not automatically imported. The empty inbox explains this. If reverting the feature, keep the two tables and their records to preserve client metadata; they can remain unused until the feature is restored.

Verification: `npm test` includes real SQL tests on an isolated in-memory PostgreSQL engine (PGlite), authenticated API tests, public upload/retry tests, and inbox UI tests. These do not connect to your live database or Dropbox.

The deployment uses 12 API functions to fit the Vercel Hobby-plan limit. Assignment upload-session `start`, `append`, and `finish` URLs share one dynamic function; their implementation lives in `server/api/assignment-file-upload-session-*.ts`. The `/client-submissions` and trailing-slash routes both rewrite to the SPA and are marked `noindex`.

## Team Signup Invitations

Team admins can use **Settings → Teams → Invite new users** to generate an access token for a recipient's email. The token is single-use, expires after seven days, and automatically adds the new account to the issuing team as a member. Copy the invitation or open an email draft to send it through your email app. Plaintext tokens are shown only when created; generate another invitation if a token is lost. Pending invitations can be revoked in Settings.

Existing registered users can be added to other teams with **Add member**. New invited users begin in their issuing team without receiving a separate personal team or sample assignments.

Configure `NEON_AUTH_URL` on the server to match `VITE_NEON_AUTH_URL` (the server falls back to the latter). Invitation requests use the signed JWT from `getSession().data.session.token`; the installed SDK caches sessions and refreshes them when the JWT expires. The server verifies it using that service's `/.well-known/jwks.json` endpoint. The expected issuer and audience are the Auth URL's origin, without its path. The APIs also check team administrator membership. `NEON_DATABASE_URL` must target the same database as the app. Invitation schema columns are added automatically on first server database initialization.

These controls protect invitation management and team enrollment. The existing browser-driven Neon account creation still requires provider-side signup restrictions for strict invite-only account creation; direct database credentials in the SPA remain an independent authorization concern.

## Dropbox Assignment Files

Assignment file uploads use a single owner Dropbox account. Uploads are sent through serverless API routes so Dropbox refresh tokens and access tokens never reach the browser. File metadata is stored in Neon and scoped to an assignment. The configured owner connects Dropbox once; signed-in team members can then manage files for their own app assignments through that shared Dropbox connection.

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
- Keep the owner ID set to the account that should administer the Dropbox connection. Do not replace it with each team member's account ID after they sign up.
- `DROPBOX_TOKEN_ENCRYPTION_KEY` should be a strong random value, preferably 32 bytes of base64.
- `DROPBOX_REDIRECT_URI` must match the Dropbox OAuth callback URL.
- `DROPBOX_ROOT_PATH` is optional and defaults to `/Absolute Revision`.
- Uploads are sent in 3 MB backend chunks to protect the Dropbox token while supporting public submission files up to 25 MB.

## Vercel Production Setup

Add the same environment variables from `.env.example` to the Vercel project for Production, Preview, and Development as needed.

Vite embeds `VITE_*` values at build time, so redeploy after changing:

```bash
VITE_NEON_AUTH_URL
VITE_NEON_BROWSER_URL
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

The app uses React Router with statically rendered public pages and a client-rendered workspace. The metadata plugin in `build/site-metadata.ts` emits route-specific utility HTML shells under `dist/_pages/`, reusing the same application assets. It also generates `pricing.html` and `404.html`. Before the service worker is generated, `build/prerender.ts` builds an isolated public renderer in the ignored `node_modules/.cache/absolute-revision-prerender` directory and renders the homepage, pricing page, and not-found page into their HTML. These pages are readable without JavaScript and hydrate in the browser. Private pages are never rendered at build time.

`vercel.json` rewrites known app routes to their HTML shells while leaving `/api/*` available for serverless functions. Unknown URLs use Vercel's static `404.html` convention with a 404 response; the client router also shows a not-found page instead of redirecting home. Local Vite development and preview middleware mirror known page routing and 404 status behavior. The service worker's navigation allowlist excludes unknown URLs so it cannot turn them into successful homepage responses.

### SEO and social previews

The canonical origin is `https://absoluterevision.com`. Vercel permanently redirects `www.absoluterevision.com` to that host, `/index.html` to `/`, `/sign-in` to `/login`, and the legacy `/pricing.html` URL to `/pricing`, and normalizes trailing slashes. Keep both domains connected to the Vercel project with valid TLS. If a dashboard-level domain redirect exists, it must agree with this configuration to avoid redirect loops.

Shared metadata lives in `src/lib/site-metadata.ts`. The Vite plugin writes initial HTML metadata, including Organization/WebSite/WebPage JSON-LD on public marketing routes, and `RouteMetadata` updates it during client navigation. Utility routes (including upload and tracking) and private app pages have both HTML `noindex` rules and Vercel `X-Robots-Tag` headers. The shared private-assignment shell uses generic metadata without assignment IDs, client information, or a fabricated canonical URL. Never include query parameters, access codes, or session data in SEO metadata.

`public/robots.txt` allows crawling so search engines can read the utility pages' `noindex` rules. `public/sitemap.xml` lists the canonical homepage and pricing page. Add future public marketing pages only when they return successful responses and are intended to be indexed; do not add app routes. If the canonical origin changes, update the shared metadata, crawler files, Vercel host redirect, and social artwork together.

Public contact information is centralized in `src/lib/public-business.ts`; visible WhatsApp links, enquiry emails, and JSON-LD use the same details. The public number is for WhatsApp messaging; use `businessContact.whatsappHref` rather than telephone call links. Approved service fees live in `src/lib/public-pricing.ts`: $40 for assignments/essays, $113 for BSc. dissertations, and $150 for MSc. dissertations, excluding VAT and transfer fees. The naira fees remain ₦50,000, ₦150,000, and ₦200,000 respectively; journals and magazines require a custom quote. Dollar amounts are explicitly approved prices rather than live conversions. Confirm any applicable VAT and transfer fees with the client before payment.

Marketing photographs use responsive WebP variants in `public/media`. Regenerate them with `npm run assets:images` after changing the JPEG sources. Inter and Playfair Display Latin variable WOFF2 fonts are hosted in `public/fonts` with their SIL Open Font licenses. `npm run assets:fonts` refreshes them from Google Fonts and retrieves the licenses. Asset regeneration requires network access for fonts; ordinary builds use committed files. Heavy utility/workspace pages and the auth boundary load on demand. The service worker precaches only the public JavaScript dependency graph and caches additional chunks when visited, preventing background precaching from undoing route splitting.

The committed social PNG is 1200 × 630. Edit `public/social/absolute-revision.svg`, then regenerate it with `node scripts/generate-social-image.mjs` (uses Playwright with Microsoft Edge on Windows or its installed Chromium elsewhere). Production builds use the committed PNG and do not require a browser for image generation.

Before release, run `npm run lint`, `npm test`, and `npm run test:e2e` (which builds production artifacts first). The browser suite exercises both Vite development and the built production preview, including no-JavaScript content, hydration, pricing, generic private metadata, chunk loading, and real 404 responses. Inspect deployed Vercel utility response headers, host redirects, and unknown-URL status codes as a final deployment check: local preview middleware mirrors routing but cannot confirm Vercel's live configuration. Preserve Vercel's default preview-deployment `noindex` behavior.

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
6. After Dropbox is connected, signed-in team members should see the upload controls on their assignment pages.
7. If `/api/dropbox/status` still returns a server error, check Vercel function logs for the exact database or Dropbox API error.


### Public submission retention

Public upload validation accepts at most three files of 25 MB each. Unconverted submissions expire after 14 days and disappear from the inbox, count, download API, and conversion API at that cutoff. Converted submissions and assignment attachments are excluded.

The authenticated `/api/cron/submission-retention` job runs daily at 01:00 UTC (02:00 Lagos) on Vercel. Set a strong server-only `CRON_SECRET` in the deployment environment; Vercel sends it as a Bearer token. The job respects the project’s 60-second function limit, stops starting deletions after a 40-second work budget, and releases unprocessed claims for the next run. Cleanup claims up to 50 expired submissions per run, deletes each entire Dropbox submission folder (including backup metadata and orphaned partial files), then removes the intake record and cascaded file records. Missing folders are safe to retry; failed deletions keep the record for retry and return an error status. Claims older than 15 minutes can be retried after interrupted runs. Monitor job failures and backlog; increase frequency/batch capacity if expired submission volume exceeds the cleanup capacity. Changing `DROPBOX_ROOT_PATH` after intake requires migrating existing folders before cleanup. Existing unconverted records older than 14 days will expire on deployment.


### Account-free email verification

Clients request a six-digit code sent from coresystechng@gmail.com and enter it on the upload page; no account, password, or sign-in is required. Set server-only GMAIL_SMTP_APP_PASSWORD (a Google app password with 2-Step Verification enabled) and SUBMISSION_EMAIL_SECRET (a random 32-byte value) in Vercel and local development. Do not use the normal Gmail password or expose either value through a VITE_ variable. Gmail SMTP uses smtp.gmail.com:465 with TLS and bounded connection timeouts. The website can remain on absoluterevision.vercel.app; no custom sending domain is required for Gmail.

Email codes expire after ten minutes with five guesses maximum. A verified proof expires after 30 minutes and is atomically consumed when creating one submission, bound to the same email address. Upload retries reuse the existing submission credentials. Private database-backed counters apply across server instances: five code requests per IP per hour, three per email per hour, one-minute resend cooldown, 90 total verification emails per day, and three new submissions per verified email per day. Code hashes use the server secret; proof tokens are stored only as SHA-256 hashes. No verification codes or mail credentials are logged. Expired verification records and counters are swept by the retention job. Verification does not scan files or replace malware/content checks.

The app refuses new intakes until the email proof is valid. Configure and test SMTP before deploying these changes, otherwise public submissions will remain blocked. Test using the upload page with an inbox you control, then verify the saved intake and files in Client submissions. Google may limit or block SMTP from new hosts; monitor delivery failures and app-password revocation.
