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

Media files live under `UPLOAD_DIR` (default `backend/uploads/`) via `lib/storage.ts`, a small interface with a local-disk driver; an S3 driver can implement the same interface.

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

```bash
cp backend/.env.example backend/.env   # then fill in DATABASE_URL, JWT_SECRET, seed admin
(cd frontend && npm install)
cd backend
npm install
npm run db:migrate
npm run build && npm run db:seed       # creates the first admin user
npm run dev
```

Sign in as the seeded admin. You'll be asked to set up 2FA with an authenticator app. Then share the site link. New sign-ups wait under **Listeners → Waiting for approval**, and you can delegate areas to other people under **Admin team**.

The backend spawns the Vite dev server in development mode. Open http://localhost:3001 (Express proxies to Vite) or http://localhost:5000 (Vite proxies `/api` to Express).

## Environment Variables

See `backend/.env.example`:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Backend port (default 3001)
- `FRONTEND_PORT` - Frontend port (default 5000)
- `JWT_SECRET` - JWT signing secret
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` - first admin account, used by `npm run db:seed`
- `UPLOAD_DIR` - where uploaded media is stored (default `./uploads`, relative to `backend/`)
- `MAX_UPLOAD_MB` - per-file upload limit (default 500)
- `SECRET_ENCRYPTION_KEY` - optional key for encrypting 2FA secrets at rest; defaults to one derived from `JWT_SECRET`. Changing either later invalidates everyone's 2FA setup.
