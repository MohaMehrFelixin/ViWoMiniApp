#!/usr/bin/env bash
# =============================================================================
# run-migrations.sh — apply backend SQL migrations against the running DB
# =============================================================================
#
# Why this exists:
#   Postgres's docker-entrypoint-initdb.d only runs scripts the FIRST time
#   the data volume is initialised. Once viwo-postgres-1 has data, any new
#   *.sql file added to backend/migrations/ is silently ignored. That caused
#   a production outage where backend startup failed because the SettingsService
#   couldn't find the system_settings table created in 011_admin_completeness.sql.
#
# What this does:
#   - Ensures a `schema_migrations` tracking table exists.
#   - Iterates backend/migrations/*.sql in lexical order.
#   - For each file, skips it if already recorded; otherwise applies it inside
#     a transaction with ON_ERROR_STOP=1 and records the filename on success.
#   - Exits non-zero on the first failure so the deploy aborts before health
#     checks pass over a half-migrated DB.
#
# How to run:
#   From /opt/viwo on the host (CI deploy step does this automatically):
#     bash deploy/run-migrations.sh
#
# Idempotency:
#   Migrations themselves should be idempotent where possible (IF NOT EXISTS,
#   ON CONFLICT DO NOTHING, etc.) so manual re-runs are safe even if the
#   tracking row was lost. The schema_migrations table is the primary skip
#   mechanism for performance and clarity.

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-viwo-postgres-1}"
DB_USER="${DB_USER:-viwo}"
DB_NAME="${DB_NAME:-viwo_coupon}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-backend/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory '$MIGRATIONS_DIR' not found" >&2
  exit 1
fi

# Wait for postgres to accept connections (compose health check should
# already guarantee this, but be defensive against race conditions).
echo "Waiting for postgres in container '$DB_CONTAINER'..."
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: postgres did not become ready in 30s" >&2
    exit 1
  fi
  sleep 1
done

# Bootstrap the tracking table (idempotent).
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

applied_count=0
skipped_count=0

# Iterate in lexical order (001_, 002_, ...). Use printf+sort to be explicit
# about ordering rather than relying on shell glob behaviour.
for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$migration")

  # Has this migration already been applied?
  already=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '$filename';" 2>/dev/null || echo "")

  if [ -n "$already" ]; then
    skipped_count=$((skipped_count + 1))
    continue
  fi

  echo "→ applying $filename"
  if ! docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
       -v ON_ERROR_STOP=1 --single-transaction < "$migration"; then
    echo "ERROR: migration $filename failed — deploy aborted" >&2
    exit 1
  fi

  # Record success only after the SQL transaction committed.
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');" >/dev/null
  applied_count=$((applied_count + 1))
done

echo "Migrations done — applied $applied_count, skipped $skipped_count (already applied)"
