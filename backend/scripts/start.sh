#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  MIGRATE_URL="$DATABASE_URL"
  case "$MIGRATE_URL" in
    *sslmode=*)
      ;;
    *)
      case "$MIGRATE_URL" in
        *\?*)
          MIGRATE_URL="${MIGRATE_URL}&sslmode=require"
          ;;
        *)
          MIGRATE_URL="${MIGRATE_URL}?sslmode=require"
          ;;
      esac
      ;;
  esac

  echo "Running database migrations..."
  migrate -path migrations -database "$MIGRATE_URL" up
fi

echo "Starting server..."
exec ./server
