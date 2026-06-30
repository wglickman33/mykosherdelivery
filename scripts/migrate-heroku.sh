#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/cli-ui.sh
source "$ROOT_DIR/scripts/lib/cli-ui.sh"

HEROKU_APP="${HEROKU_APP:-mykosherdelivery}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Run production database migrations on Heroku.

Options:
  --app <name>   Heroku app name (default: mykosherdelivery)
  -h, --help     Show this help

Examples:
  heroku run npm run migrate --app mykosherdelivery
  npm run migrate:heroku
  bash scripts/migrate-heroku.sh --app mykosherdelivery
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) HEROKU_APP="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) mkd_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if ! command -v heroku >/dev/null 2>&1; then
  mkd_error "Heroku CLI is required. Install: https://devcenter.heroku.com/articles/heroku-cli"
  exit 1
fi

START_TS=$(date +%s)

mkd_header "My Kosher Delivery" "Production migrations"
mkd_section "Target"
mkd_kv "App" "$HEROKU_APP"
mkd_kv "Command" "heroku run npm run migrate --app $HEROKU_APP"

echo ""
set +e
heroku run npm run migrate --app "$HEROKU_APP" 2>&1 | mkd_format_heroku_stream
MIGRATE_EXIT=${PIPESTATUS[0]}
set -e

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
echo ""

if [[ "$MIGRATE_EXIT" -ne 0 ]]; then
  mkd_error "Migration failed (${ELAPSED}s)"
  exit "$MIGRATE_EXIT"
fi

mkd_success "Migrations finished (${ELAPSED}s)"
