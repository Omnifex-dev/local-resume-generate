#!/usr/bin/env bash
# One-shot local setup for Ubuntu (22.04 / 24.04 / 26.04).
set -euo pipefail

cd "$(dirname "$0")/.."

info() { printf '==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# --- Node.js -----------------------------------------------------------------
command -v node >/dev/null || fail "Node.js not found. Install Node 22 (see README: 'Ubuntu prerequisites')."
node -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  process.exit(maj > 20 || (maj === 20 && min >= 9) ? 0 : 1);
' || fail "Node $(node -v) is too old; Next.js 15 needs >= 20.9. Ubuntu 22.04's apt Node is v12, so use nvm (see README)."
command -v npm >/dev/null || fail "npm not found. Run 'sudo apt install npm' or use nvm."
info "Node $(node -v), npm $(npm -v)"

# --- Docker ------------------------------------------------------------------
command -v docker >/dev/null || fail "Docker not found. Install Docker Engine: https://docs.docker.com/engine/install/ubuntu/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 missing. Run 'sudo apt install docker-compose-v2'."
docker info >/dev/null 2>&1 || fail "Cannot reach the Docker daemon. Run 'sudo usermod -aG docker \$USER', then log out and back in."

# --- .env --------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"
fi
# Generate an ENCRYPTION_KEY (encrypts users' OpenAI keys) if .env has none.
if ! grep -qE '^ENCRYPTION_KEY=.+' .env; then
  NEW_KEY=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')
  if grep -qE '^ENCRYPTION_KEY=' .env; then
    sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEW_KEY}|" .env
  else
    printf '\nENCRYPTION_KEY=%s\n' "$NEW_KEY" >> .env
  fi
  info "Generated ENCRYPTION_KEY in .env (keep it; changing it makes saved API keys unreadable)"
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# --- Port check (skip if our container already owns the port) ----------------
PORT="${POSTGRES_PORT:-5433}"
if [ -z "$(docker compose ps -q --status running db 2>/dev/null)" ]; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}$"; then
    fail "Port ${PORT} is already in use. Set POSTGRES_PORT to a free port in .env and use the same port in DATABASE_URL."
  fi
fi

# --- Install, DB, migrate ----------------------------------------------------
info "Installing npm dependencies"
npm install --no-fund --no-audit

info "Starting PostgreSQL (waits until healthy)"
docker compose up -d --wait db

info "Generating and applying database migrations"
npx drizzle-kit generate
npx drizzle-kit migrate

info "Done. Start the app with: npm run dev  ->  http://localhost:3000"
