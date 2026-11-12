# resume-generate

Generate a tailored resume PDF (plus its JSON content) for each job description, using your profile, a chosen theme, a custom prompt and your own OpenAI API key.

## Stack

- **Next.js 15** (App Router, Server Actions) with TypeScript and Tailwind CSS v4
- **PostgreSQL 17** through **Drizzle ORM** (`postgres.js` driver)
- Auth: username + password hashed with Argon2id, database-backed sessions in httpOnly cookies
- Logging: pino (structured JSON, secrets redacted)
- Tests: Vitest

## Ubuntu prerequisites

| Need | How on Ubuntu |
|---|---|
| Node.js ≥ 20.9 (22 recommended, see `.nvmrc`) | **26.04:** `sudo apt install nodejs npm` (Node 22) works. **24.04 / 22.04:** apt ships Node 18 / 12, which are too old, so use nvm (below). |
| Docker Engine + Compose v2 | `sudo apt install docker.io docker-compose-v2`, or Docker's own apt repo |
| Google Chrome or Chromium (PDF rendering) | Chrome's .deb from google.com, or `sudo apt install chromium` / `sudo snap install chromium` |
| Run docker without sudo | `sudo usermod -aG docker $USER`, then log out and back in |

Installing Node with nvm (works on any Ubuntu version):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
exec $SHELL            # reload the shell
nvm install            # reads .nvmrc → Node 22 (bundles a current npm)
```

Notes:
- The Docker PostgreSQL listens on host port **5433** (inside the container it is still 5432), so it does not clash with a native PostgreSQL on 5432. To use another port, set `POSTGRES_PORT` in `.env` and use the same port in `DATABASE_URL`.
- The database port is bound to `127.0.0.1` on purpose: on Ubuntu, ports published by Docker bypass UFW firewall rules.
- Folder names like `src/app/(auth)` are Next.js route groups. Quote them in the shell: `cd 'src/app/(auth)'`.

## Getting started

One command (checks prerequisites, creates `.env`, installs, starts Postgres, runs migrations):

```bash
npm run setup          # or: ./scripts/setup.sh
npm run dev            # http://localhost:3000
```

Or step by step:

```bash
cp .env.example .env
npm install
npm run db:up          # start Postgres in Docker and wait until healthy
npm run db:generate    # create SQL migrations from src/server/db/schema.ts
npm run db:migrate     # apply them
npm run dev            # http://localhost:3000
```

Checks:

```bash
npm run typecheck && npm run lint && npm test
```

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `ENCRYPTION_KEY` | 32 random bytes, base64. Encrypts users' OpenAI keys (AES-256-GCM). `npm run setup` generates it. **Don't change it later**: saved API keys would become unreadable and users would have to re-enter them. |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint (default `https://api.openai.com/v1`) |
| `OPENAI_DEFAULT_MODEL` | Model used when a user hasn't chosen one (default `gpt-4.1-mini`). It must support structured outputs. |
| `CHROME_PATH` | Optional path to Chrome/Chromium for PDF rendering; common Ubuntu locations are auto-detected |
| `CHROME_NO_SANDBOX` | `true` only when running as root or in Docker |
| `LOG_LEVEL`, `TRUST_PROXY` | See `.env.example` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Sends the 6-digit sign-up code. Without `SMTP_HOST`, development logs the code to the server console instead. |

## How generation works

1. **Settings:** each user saves their own OpenAI key (checked against OpenAI, then stored encrypted), plus an optional model and custom prompt.
2. **Generate:** each job description is sent to `POST /api/generate`, 2 at a time.
3. **Prompt:** the server sends fixed rules, the user's prompt, their profile details (headline, location, skills, languages, education), their work history (companies referenced by id) and the job description, wrapped in delimiters as untrusted data. It requests a strict JSON schema.
4. **Result:** the experience bullets are mapped back to `{"Company": ["bullet", ...]}` in profile order (this is the downloadable JSON). The AI also writes a professional summary, grouped skills and optional additional information, stored as `extras`. Key terms are marked `**like this**` and printed in bold. Every attempt is stored in `generations` together with a profile snapshot.
5. **PDF:** `GET /api/generations/:id/pdf?theme=…` builds the theme's HTML from the snapshot and content, then prints it with headless Chrome. Network access is blocked, a CSP forbids scripts, and the PDF text stays selectable for applicant-tracking systems.
6. **Saving:** when a resume is ready, the browser saves `Name_Company_Role.pdf` and `.json`. In Chrome/Edge/Chromium (on `http://localhost` or https) you can choose a folder once on the Generate page; it is remembered in this browser (IndexedDB), and existing files are never overwritten (`(2)` is added). Browsers ask to re-allow folder access after a restart; generating asks automatically. Firefox and Safari, or no chosen folder, use the normal Downloads folder.

## Project layout

```
src/
  app/
    (auth)/login, register   public pages (redirect to /dashboard if signed in)
    (app)/dashboard          protected pages (layout calls requireUser())
  components/                client components
  lib/                       code shared by client, edge and server (no secrets)
  server/                    server-only code
    auth/                    sessions, passwords, validation, rate limiting, actions
    db/                      Drizzle schema + client
    env.ts                   validated environment
    logger.ts
  middleware.ts              optimistic redirect when no session cookie
tests/                       Vitest unit tests
```

## Sign-up and login

- **Register:** username, email and password. Nothing is created yet: the details wait in `pending_signups` and a 6-digit code is emailed (valid 10 minutes).
- **Verify (`/verify`):** entering the code creates the account and signs the user in. 5 wrong codes per code; "Resend" works after 60 s, up to 5 emails per sign-up. Unfinished sign-ups are dropped after an hour. Only a SHA-256 hash of the code is stored.
- **Login:** username *or* email and password. Accounts made before emails existed log in with their username.

## Security notes

- Session tokens are 256-bit random values. Only their SHA-256 hash is stored in the database.
- Logins are rate limited per IP + username (5 / 15 min) and per IP (30 / 15 min). Registration is limited to 10 / hour per IP. The limiter is in memory, so if you run several instances, back it with Redis.
- Set `TRUST_PROXY=true` only behind a reverse proxy you control. Otherwise `X-Forwarded-For` could be forged to dodge rate limits.
- Unknown usernames still run a full Argon2 check, so response timing doesn't reveal which accounts exist.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| M1 | Setup, tooling, DB, logging | done |
| M2 | Register / login / logout, sessions, rate limiting | done |
| M3 | Profile: contact details, work history, education | done |
| M4 | JD input: single form + multi-JD upload (.txt/.doc/.docx, split on `////////`) | done |
| M5 | OpenAI service (per-user encrypted key, structured JSON output) | done |
| M6 | Themes (Executive, Classic, Modern, Two-column) + PDF rendering with headless Chrome | done |
| M7 | Save to chosen folder (File System Access API) with download fallback, auto-save PDF + JSON | done |
| M8 | End-to-end tests, Dockerfile, hardening | next |
