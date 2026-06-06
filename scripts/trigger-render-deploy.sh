#!/usr/bin/env bash
# Render production deploy tetikler.
# Kullanım: RENDER_API_KEY=rnd_... ./scripts/trigger-render-deploy.sh

set -euo pipefail

RENDER_SERVICE_ID="${RENDER_SERVICE_ID:-srv-d8i0fvbtqb8s73ak4v10}"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "RENDER_API_KEY gerekli."
  echo "Render Dashboard > Account Settings > API Keys"
  echo "Örnek: RENDER_API_KEY=rnd_xxx ./scripts/trigger-render-deploy.sh"
  exit 1
fi

echo "Render deploy tetikleniyor (service: $RENDER_SERVICE_ID)..."

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys" \
  -d '{}')

body=$(echo "$response" | sed '$d')
status=$(echo "$response" | tail -1)

if [[ "$status" -ge 200 && "$status" -lt 300 ]]; then
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
  echo "Deploy başlatıldı."
else
  echo "Deploy tetiklenemedi (HTTP $status):"
  echo "$body"
  exit 1
fi
