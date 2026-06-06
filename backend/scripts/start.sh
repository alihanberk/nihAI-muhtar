#!/bin/sh
set -e

prepare_migrate_url() {
  url="$1"

  # golang-migrate expects postgres:// scheme
  case "$url" in
    postgresql://*) url="postgres://${url#postgresql://}" ;;
  esac

  case "$url" in
    *sslmode=*)
      ;;
    *)
      case "$url" in
        *\?*)
          url="${url}&sslmode=require"
          ;;
        *)
          url="${url}?sslmode=require"
          ;;
      esac
      ;;
  esac

  printf '%s' "$url"
}

if [ -n "$DATABASE_URL" ]; then
  MIGRATE_URL="$(prepare_migrate_url "$DATABASE_URL")"

  echo "Waiting for PostgreSQL to become available..."
  attempt=0
  max_attempts=36

  while [ "$attempt" -lt "$max_attempts" ]; do
    attempt=$((attempt + 1))
    echo "Migration attempt ${attempt}/${max_attempts}..."

    if migrate -path migrations -database "$MIGRATE_URL" up; then
      echo "Migrations completed successfully."
      break
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "Migration failed after ${max_attempts} attempts."
      exit 1
    fi

    echo "Database not ready yet, retrying in 10s..."
    sleep 10
  done
fi

echo "Starting server..."
exec ./server
