# MusicStream Dashboard

A private, company-wide radio station. Admins upload audio and video (ads, jingles, tracks), arrange them into one universal playlist, and put the station live. Anyone with the link can sign up and secure their account with an authenticator app (2FA). Once an admin approves them, they hear the same item at the same moment as everyone else.

## Features

**Admin** (roles `admin`, `super_admin`)
- **Media Library**: upload up to 5 audio/video files at a time with progress, preview, rename, delete
- **Playlist**: add from the library, reorder, remove; go live / stop the station
- **Listeners**: approve or decline new sign-ups; see who's connected and listening now; sign people out; see 2FA status; deactivate/reactivate; reset 2FA
- **Admin team** (super admin only): promote approved listeners to sub-admins and choose what each one manages
- **Integrations**: uploaded media, and AzuraCast radio stations (see below); Spotify is planned
- **Settings** (super admin only): choose where uploads are stored (see below)
- **Dashboard**: station status and listener/media counts
- **Appearance** (everyone): light, dark, or match the device; saved per browser

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

**Playback** settings on the Playlist page apply to every listener:
- **Crossfade** (0–12 seconds) starts each item that many seconds before the previous one ends, fading one out and the other in. The schedule includes the overlap, so listeners stay in sync. It's capped at half the length of either item, and a one-item playlist doesn't fade into itself. iOS and iPadOS don't let pages change volume, so players there cut cleanly at the same moment.
- **Gapless** (on by default) has each player load the next item about 30 seconds early on a second player, then start it on time. With it off and no crossfade, the next item loads when the current one ends, which can leave a short gap.

Audio/video is served by `GET /api/media/:id/stream` with HTTP Range support. Browsers' media elements can't send an `Authorization` header, so stream URLs carry a short-lived signed token scoped to that one file.

### Who's connected

**Listeners → Connected** lists listeners with the Listen page open, marked **Listening** when they're tuned in, and the Dashboard shows how many are listening. The player's regular now-playing checks (every 10–15 seconds) are the signal, so people drop off about a minute after closing the page. This is kept in the server's memory, so it's per instance: another reason to run one instance. From the list you can **Sign out** someone (they can sign in again) or **Deactivate** them. Either stops their player within about 30 seconds.

### AzuraCast

Instead of the playlist, the station can play a live [AzuraCast](https://www.azuracast.com) station, which brings 24/7 scheduling and live DJ broadcasts. Connect it under **Integrations** (server address, station short name, and an API key for private stations), then choose **AzuraCast** under "Station plays" on the Playlist page.

- Listeners never connect to AzuraCast directly. MusicStream relays the audio (`GET /api/station/live`) using a signed token tied to the listener's session, checks it again every 30 seconds while they're listening, and cuts the stream if they're deactivated or the station stops. Now-playing details and artwork come from AzuraCast's API.
- Keep the AzuraCast station **non-public** (or firewall it to this server). Otherwise anyone who finds its address can listen without signing in to MusicStream.
- Every listener uses one connection from this server to AzuraCast, so bandwidth grows with the audience (about 1 MB per minute per listener at 128 kbps).
- The stream and artwork must be on the same host as the configured AzuraCast address. The server doesn't follow redirects, and the API key is stored encrypted.

### Media storage

The super admin chooses where uploads go under **Settings → Storage**: DigitalOcean Spaces, Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, Google Cloud Storage (with an HMAC key), any other S3-compatible service such as MinIO, or this server's disk. Presets work out the storage URL from the region or account; for other services you enter it.

- **Test and save** writes, reads back and deletes a small file, so a wrong key or bucket is caught before any upload goes there. The key must be able to read, write and delete in the bucket.
- Until something is saved there, the `STORAGE_DRIVER` and `S3_*` environment variables decide. **Use server settings** goes back to them.
- Files aren't moved. Each file remembers its location (`media_files.storage_backend_id`) and keeps playing from it, so keep an old bucket and its key working while any file there is still in use.
- The secret key is stored encrypted and never sent back to the browser. A blank secret keeps the saved one only for the same storage URL and access key.
- Listeners always stream through this server, so buckets stay private.

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

Media files go through `lib/storage.ts`, and `controllers/StorageController.ts` picks the location for each file: the one saved under Settings, or otherwise the environment (`STORAGE_DRIVER=local` keeps files under `UPLOAD_DIR`, `STORAGE_DRIVER=s3` uses an S3-compatible bucket). Either way, the API streams them to listeners, so the bucket stays private.

### Look and feel

The colours follow MedPlus (medplusnig.com): pink `#FF0077`, the purple-to-pink gradient (`#9A00D9` to `#FF3A9C`) on the sign-in panel and brand tiles, near-white pages and grey text. Buttons and links use a deeper pink (`#E00069`) so small white text on them meets contrast guidelines. The theme tokens are in `frontend/src/index.css`; dark mode redefines them under `.dark`, which `ThemeProvider` (`src/hooks/use-theme.tsx`) sets from **Settings → Appearance**. A small script in `index.html` applies the saved theme before the page paints.

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

The app runs on **App Platform** as a single web service, with **Managed PostgreSQL** and a **Spaces** bucket for uploads. App Platform's disk is wiped on every deploy, so uploads must go to Spaces. Set the app up in the DigitalOcean dashboard:

1. **Database:** create a Managed PostgreSQL cluster, in the same region as the app. Attach it to the app as a database component (e.g. named `db`). The app verifies the database's certificate.
2. **Spaces:** create a bucket (e.g. `musicstream-media`, with file listing restricted) and a Spaces access key.
3. **Create the app** from the `medpluspharmacy/musicstream` repo, branch `production`, with autodeploy on. For the web service:
   - Build command: `npm run build`
   - Run command: `npm start`
   - HTTP port: `8080`; health check path: `/api/healthz`
   - Keep 1 instance for now: the sign-in rate limit and the AzuraCast now-playing cache live in each server's memory.
4. **Pre-deploy job:** add a job (kind: pre-deploy) from the same repo and branch, with build command `npm run build` and run command `npm run release`. It runs migrations before each release, and creates the first super admin when `SEED_ADMIN_PASSWORD` is set.
5. **Environment variables** (app-level, so the job gets them too):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${db.DATABASE_URL}` |
   | `DATABASE_CERT` | `${db.CA_CERT}` (without it the connection is encrypted but the server certificate isn't checked) |
   | `JWT_SECRET` (encrypt) | `openssl rand -base64 48` (the server won't start with fewer than 32 characters) |
   | `SECRET_ENCRYPTION_KEY` (encrypt) | `openssl rand -base64 32`. Keep it forever; changing it makes everyone set up 2FA again. |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_ENDPOINT` | your Spaces region endpoint, e.g. `https://lon1.digitaloceanspaces.com` |
   | `S3_BUCKET` | the bucket name |
   | `S3_PREFIX` | `production` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (encrypt) | the Spaces key |
   | `UPLOAD_DIR` | `/tmp/musicstream-uploads` |
   | `MAX_UPLOAD_MB` | `100` |
   | `TRUST_PROXY` | `1` |
   | `CLIENT_IP_HEADER` | `do-connecting-ip` |

   On the pre-deploy job only, for the first deploy: `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (encrypt; 12+ characters), for the first super admin.
6. **Deploy.** Each deploy runs `npm run build`, then the pre-deploy job, then `npm start`. Pushes to `production` redeploy automatically.
7. **After the first sign-in:** clear `SEED_ADMIN_PASSWORD`, and add your own domain under **Settings → Domains**.

If the first migration fails with `permission denied for schema public`, the database user doesn't own the database (PostgreSQL 15+). Connect as `doadmin` and run `ALTER DATABASE <db name> OWNER TO <db user>;`.

## Environment Variables

See `backend/.env.example` (local defaults) and the table above (production):
- `DATABASE_URL` - PostgreSQL connection string. SSL is on automatically for any non-local host. `ssl*` options in the URL are ignored; use the settings below.
- `DATABASE_CERT` - the database's CA certificate (PEM text, not a file path); when set, the server certificate is verified
- `PORT` - port the server listens on (App Platform sets this)
- `FRONTEND_PORT` - Vite dev server port in development (default 5000)
- `JWT_SECRET` - JWT signing secret, 32+ characters in production
- `SECRET_ENCRYPTION_KEY` - optional key for encrypting 2FA secrets and the AzuraCast API key at rest; defaults to one derived from `JWT_SECRET`. Changing either later invalidates everyone's 2FA setup.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` - first admin account, used by `npm run db:seed` / `npm run release`
- `STORAGE_DRIVER` - `local` (default) or `s3`; used until a location is saved under Settings
- `UPLOAD_DIR` - local media folder, and temp space for uploads with `s3` (default `./uploads`, relative to `backend/`)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - bucket settings for `STORAGE_DRIVER=s3`; optional `S3_PREFIX` (folder inside the bucket), `S3_REGION`, `S3_FORCE_PATH_STYLE`
- `MAX_UPLOAD_MB` - per-file upload limit (default 500)
- `TRUST_PROXY` - proxy hops in front of the app (default 1)
- `CLIENT_IP_HEADER` - header with the visitor's IP from your hosting edge (App Platform: `do-connecting-ip`); used by the sign-in rate limit
- `CORS_ORIGINS` - comma-separated extra origins allowed to call the API from a browser; not needed when this server serves the dashboard
- `LOG_LEVEL` - log level (default `info`)
