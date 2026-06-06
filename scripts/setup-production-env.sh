#!/usr/bin/env bash
# Production ortam değişkenlerini Render + Vercel'e yazar.
# Kullanım: RENDER_API_KEY=... VERCEL_TOKEN=... ./scripts/setup-production-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ENV="$ROOT/backend/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

read_env() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}

GOOGLE_KEY="$(read_env GOOGLE_API_KEY "$BACKEND_ENV")"
HF_KEY="$(read_env HUGGINGFACE_API_KEY "$BACKEND_ENV")"
MAPBOX="$(read_env NEXT_PUBLIC_MAPBOX_TOKEN "$FRONTEND_ENV")"
GOOGLE_PUBLIC="$(read_env NEXT_PUBLIC_GOOGLE_API_KEY "$FRONTEND_ENV")"

RENDER_SERVICE_ID="${RENDER_SERVICE_ID:-}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-}"
FRONTEND_URL="${FRONTEND_URL:-}"

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "RENDER_API_KEY gerekli. Render Dashboard > Account Settings > API Keys"
  exit 1
fi

if [[ -z "$RENDER_SERVICE_ID" ]]; then
  echo "Render servis listesi:"
  curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services?limit=20" | python3 -m json.tool 2>/dev/null || true
  echo ""
  echo "RENDER_SERVICE_ID=... olarak export edin"
  exit 1
fi

if [[ -n "$FRONTEND_URL" ]]; then
  CORS_ORIGINS="$FRONTEND_URL,http://localhost:3000"
else
  CORS_ORIGINS="http://localhost:3000"
fi

echo "Render env güncelleniyor (service: $RENDER_SERVICE_ID)..."

patch_render_env() {
  local key="$1"
  local value="$2"
  local payload
  payload="$(KEY="$key" VAL="$value" python3 -c 'import json,os; print(json.dumps({"envVarKey":os.environ["KEY"],"value":os.environ["VAL"]}))')"
  curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars" \
    -d "$payload" >/dev/null
}

[[ -n "$GOOGLE_KEY" ]] && patch_render_env "GOOGLE_API_KEY" "$GOOGLE_KEY"
[[ -n "$HF_KEY" ]] && patch_render_env "HUGGINGFACE_API_KEY" "$HF_KEY"
patch_render_env "CORS_ALLOWED_ORIGINS" "$CORS_ORIGINS"
patch_render_env "DB_SSLMODE" "require"
patch_render_env "KAFKA_ENABLED" "false"

echo "Render deploy tetikleniyor..."
curl -s -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys" \
  -d '{}' | python3 -m json.tool 2>/dev/null || echo "Deploy tetiklendi"

if [[ -n "${VERCEL_TOKEN:-}" && -n "$VERCEL_PROJECT_ID" ]]; then
  API_URL="https://nihai-muhtar-api.onrender.com/api/v1"
  echo "Vercel env güncelleniyor..."
  for pair in \
    "NEXT_PUBLIC_API_URL=$API_URL" \
    "NEXT_PUBLIC_MAPBOX_TOKEN=$MAPBOX" \
    "NEXT_PUBLIC_GOOGLE_API_KEY=$GOOGLE_PUBLIC"; do
    KEY="${pair%%=*}"
    VAL="${pair#*=}"
    [[ -z "$VAL" ]] && continue
    curl -s -X POST \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      "https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env" \
      -d "{\"key\":\"$KEY\",\"value\":\"$VAL\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" >/dev/null
  done
  echo "Vercel production deploy tetikleniyor..."
  curl -s -X POST \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&target=production" >/dev/null || true
fi

echo "Tamamlandı."
echo "Backend: https://nihai-muhtar-api.onrender.com/health/live"
echo "Frontend: ${FRONTEND_URL:-Vercel dashboard'dan kontrol edin}"
