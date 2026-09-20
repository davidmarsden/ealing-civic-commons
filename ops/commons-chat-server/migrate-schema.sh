#!/usr/bin/env bash
set -euo pipefail

DB="${1:-/opt/rsschat/data/data.db}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required." >&2
  exit 2
fi

if [ ! -f "$DB" ]; then
  echo "Database not found: $DB" >&2
  exit 2
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="${DB}.pre-commons-schema-${STAMP}"
cp -p "$DB" "$BACKUP"
echo "Database backup: $BACKUP"

has_column() {
  sqlite3 "$DB" "pragma table_info(items);" | awk -F'|' -v wanted="$1" '$2 == wanted { found=1 } END { exit(found ? 0 : 1) }'
}

if has_column commonsObjectUrl; then
  echo "commonsObjectUrl already exists."
else
  sqlite3 "$DB" "alter table items add column commonsObjectUrl text;"
  echo "Added commonsObjectUrl."
fi

if has_column commonsObjectType; then
  echo "commonsObjectType already exists."
else
  sqlite3 "$DB" "alter table items add column commonsObjectType text;"
  echo "Added commonsObjectType."
fi

echo
echo "Current civic-binding columns:"
sqlite3 "$DB" "pragma table_info(items);" | awk -F'|' '$2 ~ /^commonsObject/ { print "  " $2 " " $3 }'
