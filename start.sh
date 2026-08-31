#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install it and run this script again."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
echo
echo "VOID.LINK is starting at http://localhost:3000"
echo "Founder: http://localhost:3000/founder"
echo
npm start
