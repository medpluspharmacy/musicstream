# MusicStream Dashboard

A private, company-wide radio station. Admins upload audio and video (ads, jingles, tracks), arrange them into one universal playlist, and put the station live. Anyone with the link can sign up and secure their account with an authenticator app (2FA). Once an admin approves them, they hear the same item at the same moment as everyone else.

## Features

**Admin** (roles `admin`, `super_admin`)
- **Media Library**: upload audio/video with progress, preview, rename, delete
- **Playlist**: add from the library, reorder, remove; go live / stop the station
- **Listeners**: approve or decline new sign-ups; see 2FA status; deactivate/reactivate; reset 2FA
- **Admin team** (super admin only): promote approved listeners to sub-admins and choose what each one manages
- **Integrations**: uploaded media, and AzuraCast radio stations (see below); Spotify is planned
- **Dashboard**: station status and listener/media counts

**Listener** (role `user`)
- Open self sign-up with any email, then mandatory authenticator-app 2FA. They see a "waiting for approval" screen until an admin approves them; declined accounts can't sign in
- **Listen**: a live player that stays in sync with the station; shows what's up next

### Admin roles

- `super_admin` can do everything, including managing the admin team. The seeded account is the super admin.
- `admin` is a sub-admin with one or more delegated areas (`users.permissions`): **station** (media library, playlist, going live, station source), **listeners** (approvals, deactivation, 2FA resets) and **integrations** (AzuraCast). Every admin can see the Dashboard.
- Sub-admins are promoted from approved listeners who have set up 2FA, so no invite email is needed. Removing admin rights turns them back into a listener.
- Role, permissions and approval are read from the database on every request (`requireAuth`, `requirePermission`, `requireApproved`), so changes apply immediately to people already signed in. The UI picks them up within 30 seconds.
- Sign-up email addresses aren't verified (no email is sent), so check who someone is before approving them.

### How the live station works

The playlist plays as an endless loop anchored to the moment the station went live (`station_state.started_at`). `GET /api/station/now-playing` tells each listener which item is on and how many seconds in, and the player re-syncs every 15 seconds. When the admin edits the playlist, the anchor is shifted so the item currently playing carries on without a jump.

Audio/video is served by `GET /api/media/:id/stream` with HTTP Range support. Browsers' media elements can't send an `Authorization` header, so stream URLs carry a short-lived signed token scoped to that one file.

### AzuraCast

Instead of the playlist, the station can play a live [AzuraCast](https://www.azuracast.com) station, which brings 24/7 scheduling and live DJ broadcasts. Connect it under **Integrations** (server address, station short name, and an API key for private stations), then choose **AzuraCast** under "Station plays" on the Playlist page.

- Listeners never connect to AzuraCast directly. MusicStream relays the audio (`GET /api/station/live`) using a signed token tied to the listener's session, checks it again every 30 seconds while they're listening, and cuts the stream if they're deactivated or the station stops. Now-playing details and artwork come from AzuraCast's API.
- Keep the AzuraCast station **non-public** (or firewall it to this server). Otherwise anyone who finds its address can listen without signing in to MusicStream.
- Every listener uses one connection from this server to AzuraCast, so bandwidth grows with the audience (about 1 MB per minute per listener at 128 kbps).
- The stream and artwork must be on the same host as the configured AzuraCast address. The server doesn't follow redirects, and the API key is stored encrypted.

### Spotify

Spotify only permits playback through its own player, signed in to each listener's own Spotify Premium account. Its tracks can't be re-streamed to everyone like uploaded files. `media_files.provider` / `provider_ref` are reserved so external sources can sit beside uploads in the playlist when that integration is built.

## Project Structure

```
frontend/   - React + Vite frontend
backend/    - Express + Sequelize API
```

### Backend layering

Each feature is split across the same four layers:

```
routes/<feature>.ts                 URL + middleware → Action
actions/<feature>/<Verb>Action.ts   HTTP concerns: parse/validate input, status codes
controllers/<Feature>Controller.ts  business logic, talks to models
models/<Model>.ts                   Sequelize model (registered in models/index.ts)
migrations/NNN-<name>.cjs           raw-SQL schema changes, run by sequelize-cli
```

Media files go through `lib/storage.ts`. `STORAGE_DRIVER=local` (default) keeps them under `UPLOAD_DIR`; `STORAGE_DRIVER=s3` stores them in an S3-compatible bucket such as DigitalOcean Spaces. Either way, the API streams them to listeners, so the bucket stays private.

### Frontend layout

```
src/pages/          one file per route, registered in App.tsx
src/components/     app shell (layout.tsx), shared primitives (shared.tsx)
src/components/ui/  shadcn/Radix component library
src/hooks/          auth, app settings, toast, mobile breakpoint
src/lib/api.ts      typed API client, one function per endpoint
src/pages/listen.tsx  the synced live player
```

Sidebar entries live in `NAV_STRUCTURE` in `src/components/layout.tsx`.

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query, Wouter, Radix UI
- **Backend**: Node.js ESM, Express 5, TypeScript, bundled with esbuild
- **Database**: PostgreSQL via Sequelize
- **Auth**: JWT + bcryptjs

## Development

One server runs everything. The backend is the API under `/api`, and it also serves the dashboard: built files in production, or the Vite dev server (with hot reload) in development. The root `package.json` drives both apps:

```bash
cp backend/.env.example backend/.env   # then fill in DATABASE_URL, JWT_SECRET, seed admin
npm run build                          # installs and builds frontend + backend
npm run db:migrate
npm run db:seed                        # creates the first admin user
npm run dev                            # http://localhost:3001
```

| Command | What it does |
|---|---|
| `npm run build` | Installs both apps' dependencies and builds the frontend and backend |
| `npm start` | Runs the production server: API on `/api`, dashboard on every other path, on `$PORT` |
| `npm run dev` | Development: builds the backend, which spawns Vite with hot reload |
| `npm run release` | Runs migrations, then seeds the first admin if `SEED_ADMIN_PASSWORD` is set (used before each deploy) |
| `npm run typecheck` | Typechecks both apps |

Sign in as the seeded admin. You'll be asked to set up 2FA with an authenticator app. Then share the site link. New sign-ups wait under **Listeners → Waiting for approval**, and you can delegate areas to other people under **Admin team**.

In development, open http://localhost:3001 (Express proxies to Vite) or http://localhost:5000 (Vite proxies `/api` to Express).

## Deploying to DigitalOcean

The app runs on **App Platform** as a single service from `.do/app.yaml`, with **Managed PostgreSQL** and a **Spaces** bucket for uploads. App Platform's disk is wiped on every deploy, so uploads must go to Spaces.

1. **Database:** create a Managed PostgreSQL cluster called `musicstream-db`, in the same region as the app. Its connection string and CA certificate are wired in by the spec (`${db.DATABASE_URL}`, `${db.CA_CERT}`), and the app verifies the database's certificate.
2. **Spaces:** create a bucket (e.g. `musicstream-media`, with file listing restricted) and a Spaces access key. Set `S3_ENDPOINT` (e.g. `https://lon1.digitaloceanspaces.com`) and `S3_BUCKET` in `.do/app.yaml`.
3. **Create the app:** `doctl apps create --spec .do/app.yaml`, or upload the file under **Create App** in the dashboard. Allow DigitalOcean access to the `medpluspharmacy/musicstream` repo.
4. **Secrets:** in the app's **Settings**, fill in the blank secrets:
   - `JWT_SECRET`: `openssl rand -base64 48` (the server won't start with fewer than 32 characters).
   - `SECRET_ENCRYPTION_KEY`: `openssl rand -base64 32`. Keep it forever; changing it makes everyone set up 2FA again.
   - `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: the Spaces key.
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` on the `release` job: the first super admin (password 12+ characters).
5. **Deploy.** Each deploy runs `npm run build`, then the `release` job (migrations, plus the first admin), then `npm start`. The health check is `/api/healthz`. Pushes to `production` redeploy automatically.
6. **After the first sign-in:** clear `SEED_ADMIN_PASSWORD`, and add your own domain under **Settings → Domains**.

If the first migration fails with `permission denied for schema public`, the database user doesn't own the database (PostgreSQL 15+). Connect as `doadmin` and run `ALTER DATABASE musicstream OWNER TO musicstream;`.

Keep `instance_count` at 1 for now: the sign-in rate limit and the AzuraCast now-playing cache live in each server's memory.

## Environment Variables

See `backend/.env.example` (local defaults) and `.do/app.yaml` (production):
- `DATABASE_URL` - PostgreSQL connection string. SSL is on automatically for any non-local host. `ssl*` options in the URL are ignored; use the settings below.
- `DATABASE_CA_CERT` - the database's CA certificate (PEM text); when set, the server certificate is verified
- `DATABASE_SSL` - `true` / `false` to force SSL on or off
- `PORT` - port the server listens on (App Platform sets this)
- `FRONTEND_PORT` - Vite dev server port in development (default 5000)
- `JWT_SECRET` - JWT signing secret, 32+ characters in production
- `SECRET_ENCRYPTION_KEY` - optional key for encrypting 2FA secrets and the AzuraCast API key at rest; defaults to one derived from `JWT_SECRET`. Changing either later invalidates everyone's 2FA setup.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` - first admin account, used by `npm run db:seed` / `npm run release`
- `STORAGE_DRIVER` - `local` (default) or `s3`
- `UPLOAD_DIR` - local media folder, and temp space for uploads with `s3` (default `./uploads`, relative to `backend/`)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - bucket settings for `STORAGE_DRIVER=s3`; optional `S3_PREFIX` (folder inside the bucket), `S3_REGION`, `S3_FORCE_PATH_STYLE`
- `MAX_UPLOAD_MB` - per-file upload limit (default 500)
- `TRUST_PROXY` - proxy hops in front of the app (default 1)
- `CLIENT_IP_HEADER` - header with the visitor's IP from your hosting edge (App Platform: `do-connecting-ip`); used by the sign-in rate limit
- `CORS_ORIGINS` - comma-separated extra origins allowed to call the API from a browser; not needed when this server serves the dashboard
- `LOG_LEVEL` - log level (default `info`)
