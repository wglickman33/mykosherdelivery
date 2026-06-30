#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/cli-ui.sh
source "$ROOT_DIR/scripts/lib/cli-ui.sh"

HEROKU_APP="${HEROKU_APP:-mykosherdelivery}"
TAIL_LINES=200

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) HEROKU_APP="$2"; shift 2 ;;
    --tail) TAIL_LINES="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--app name] [--tail lines]"
      exit 0
      ;;
    *) mkd_error "Unknown option: $1"; exit 1 ;;
  esac
done

if ! command -v heroku >/dev/null 2>&1; then
  mkd_error "Heroku CLI is required."
  exit 1
fi

mkd_header "My Kosher Delivery" "Heroku logs"
mkd_kv "App" "$HEROKU_APP"
mkd_kv "Tail" "$TAIL_LINES lines"
mkd_dim "Press Ctrl+C to stop"
echo ""

heroku logs --tail --num "$TAIL_LINES" --app "$HEROKU_APP"
