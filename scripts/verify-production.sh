#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://nihai-muhtar-api.onrender.com}"
FRONTEND_URL="${FRONTEND_URL:-}"

echo "=== Backend ==="
curl -sf "${BACKEND_URL}/health/live" && echo "" || echo "FAIL: /health/live"
curl -sf "${BACKEND_URL}/health/ready" && echo "" || echo "FAIL: /health/ready"

if [[ -n "$FRONTEND_URL" ]]; then
  echo ""
  echo "=== Frontend ==="
  code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
  echo "HTTP $code — $FRONTEND_URL"
fi
