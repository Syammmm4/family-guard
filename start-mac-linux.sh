#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer from https://nodejs.org/"
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; fi
if [ ! -d node_modules ]; then npm ci; fi
npm start
