#!/bin/bash

cd "$(dirname "$0")/backend"

export FRONTEND_PORT="${FRONTEND_PORT:-5000}"

if [ "$1" = "production" ]; then
  # Production: the frontend is built ahead of time (cd frontend && npm run build)
  # and served statically by Express alongside the API.
  export NODE_ENV=production
  export PORT="${PORT:-5000}"
else
  # Development: build the backend, run it on 3001, and let it spawn the Vite dev
  # server on $FRONTEND_PORT (with HMR) which proxies /api back to the backend.
  npm run build 2>&1
  export NODE_ENV=development
  export PORT=3001
fi

exec node --enable-source-maps ./dist/index.mjs
