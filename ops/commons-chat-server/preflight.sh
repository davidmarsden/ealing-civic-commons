#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/rsschat}"
CONFIG_PATH="${2:-$APP_DIR/config.json}"

log() {
  printf '[commons-chat-preflight] %s\n' "$*"
}

fail() {
  printf '[commons-chat-preflight] ERROR: %s\n' "$*" >&2
  exit 1
}

[ -d "$APP_DIR" ] || fail "Application directory not found: $APP_DIR"
[ -f "$CONFIG_PATH" ] || fail "Config file not found: $CONFIG_PATH"
[ -f "$APP_DIR/package.json" ] || fail "package.json not found in $APP_DIR"
command -v node >/dev/null 2>&1 || fail "node is not available on PATH"
command -v npm >/dev/null 2>&1 || fail "npm is not available on PATH"

log "Node: $(node --version)"
log "npm: $(npm --version)"

# Parse the actual production config with Node so malformed JSON stops startup.
# Commons Chat is intentionally a SQLite deployment; falling back to MySQL would
# be a dangerous configuration error rather than a supported failover path.
node - "$CONFIG_PATH" <<'NODE'
const fs = require("fs");
const configPath = process.argv[2];

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
}
catch (err) {
  console.error("[commons-chat-preflight] ERROR: config.json is not valid JSON: " + err.message);
  process.exit(1);
}

if (!config.database || config.database.flUseSqlite !== true) {
  console.error("[commons-chat-preflight] ERROR: config.database.flUseSqlite must be true for Commons Chat.");
  process.exit(1);
}

if (!config.urlServerHomePageSource || typeof config.urlServerHomePageSource !== "string") {
  console.error("[commons-chat-preflight] ERROR: urlServerHomePageSource is missing.");
  process.exit(1);
}

console.log("[commons-chat-preflight] Config JSON valid; SQLite explicitly enabled.");
console.log("[commons-chat-preflight] Client source: " + config.urlServerHomePageSource);
NODE

cd "$APP_DIR"

check_better_sqlite3() {
  node - <<'NODE'
try {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.prepare("select 1 as ok").get();
  db.close();
}
catch (err) {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}
NODE
}

if check_better_sqlite3 >/dev/null 2>&1; then
  log "better-sqlite3 loads under the current Node runtime; leaving node_modules untouched."
else
  log "better-sqlite3 cannot load under the current Node runtime."
  log "Rebuilding only better-sqlite3 for this Node runtime..."
  npm rebuild better-sqlite3

  if check_better_sqlite3 >/dev/null 2>&1; then
    log "better-sqlite3 rebuild succeeded."
  else
    fail "better-sqlite3 still cannot load after rebuild; refusing to start rss.chat."
  fi
fi

if [ -f "$APP_DIR/rssnetwork.js" ]; then
  node --check "$APP_DIR/rssnetwork.js" >/dev/null
  log "rssnetwork.js syntax check passed."
else
  fail "rssnetwork.js not found in $APP_DIR"
fi

log "Preflight passed."
