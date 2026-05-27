#!/usr/bin/env bash
set -euo pipefail

# Usage: ./set-vercel-env.sh <projectId> <ENV_NAME> <ENV_VALUE> [target] [--redeploy]
# Example: ./set-vercel-env.sh pj_123456 VITE_API_URL https://payroll-api.onrender.com production --redeploy
# Requirements: set VERCEL_TOKEN env var (personal token) and have `vercel` CLI installed if using --redeploy

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERROR: VERCEL_TOKEN environment variable must be set (create a personal token at https://vercel.com/account/tokens)"
  exit 1
fi

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <projectId> <ENV_NAME> <ENV_VALUE> [target] [--redeploy]"
  exit 1
fi

PROJECT_ID="$1"
ENV_NAME="$2"
ENV_VALUE="$3"
TARGETS="${4:-production}"
REDEPLOY=false
if [ "${5:-}" = "--redeploy" ]; then
  REDEPLOY=true
fi

echo "Setting environment variable '$ENV_NAME' for project '$PROJECT_ID' (target: $TARGETS)"

resp=$(curl -s -X POST "https://api.vercel.com/v9/projects/${PROJECT_ID}/env" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"${ENV_NAME}\",\"value\":\"${ENV_VALUE}\",\"target\":[\"${TARGETS}\"],\"type\":\"encrypted\"}")

if echo "$resp" | grep -q 'error'; then
  echo "Failed to set env var: $resp"
  exit 1
fi

echo "Env var set successfully. API response: $resp"

if [ "$REDEPLOY" = true ]; then
  if command -v vercel >/dev/null 2>&1; then
    echo "Triggering redeploy using vercel CLI..."
    vercel --prod --token "$VERCEL_TOKEN" --confirm
  else
    echo "vercel CLI not found — install it to enable automatic redeploy (npm i -g vercel)"
  fi
fi
