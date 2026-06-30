#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/cli-ui.sh
source "$ROOT_DIR/scripts/lib/cli-ui.sh"

HEROKU_APP="${HEROKU_APP:-mykosherdelivery}"
HEROKU_REMOTE="${HEROKU_REMOTE:-heroku}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
RUN_MIGRATE=false
SKIP_PREFLIGHT=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Deploy the current repo to Heroku with formatted CLI output.

Options:
  --migrate          Run production migrations after a successful deploy
  --branch <name>    Git branch to push (default: main)
  --app <name>       Heroku app name (default: mykosherdelivery)
  --remote <name>    Git remote (default: heroku)
  --skip-preflight   Skip local git status checks
  -h, --help         Show this help

Examples:
  npm run deploy
  npm run deploy -- --migrate
  bash scripts/deploy-heroku.sh --branch main --migrate

After deploy, migrations run via:
  heroku run npm run migrate --app mykosherdelivery
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate) RUN_MIGRATE=true; shift ;;
    --branch) DEPLOY_BRANCH="$2"; shift 2 ;;
    --app) HEROKU_APP="$2"; shift 2 ;;
    --remote) HEROKU_REMOTE="$2"; shift 2 ;;
    --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) mkd_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  mkd_error "git is required."
  exit 1
fi

if ! git remote get-url "$HEROKU_REMOTE" >/dev/null 2>&1; then
  mkd_error "Git remote '$HEROKU_REMOTE' not found."
  exit 1
fi

START_TS=$(date +%s)
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"
HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
HEAD_MSG="$(git log -1 --pretty=format:'%s' 2>/dev/null || echo unknown)"

mkd_header "My Kosher Delivery" "Heroku deploy"
mkd_section "Deploy target"
mkd_kv "App" "$HEROKU_APP"
mkd_kv "Remote" "$HEROKU_REMOTE"
mkd_kv "Branch" "$DEPLOY_BRANCH"
mkd_kv "Commit" "$HEAD_SHA"
mkd_kv "Message" "$HEAD_MSG"
mkd_kv "Local branch" "$CURRENT_BRANCH"

if [[ "$SKIP_PREFLIGHT" == false ]]; then
  mkd_section "Preflight"
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    mkd_warn "Working tree has uncommitted changes."
    git status -sb
    echo ""
    read -r -p "Continue deploy anyway? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      mkd_dim "Deploy cancelled."
      exit 1
    fi
  else
    mkd_success "Working tree clean"
  fi
fi

mkd_section "Pushing to Heroku"
mkd_dim "Streaming build output..."
echo ""

set +e
set -o pipefail
git push "$HEROKU_REMOTE" "${DEPLOY_BRANCH}:main" 2>&1 | mkd_format_heroku_stream
PUSH_EXIT=${PIPESTATUS[0]}
set -e
set +o pipefail

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

echo ""
if [[ "$PUSH_EXIT" -ne 0 ]]; then
  mkd_header "Deploy failed" "Fix the errors above and try again"
  mkd_error "git push exited with code $PUSH_EXIT (${ELAPSED}s)"
  exit "$PUSH_EXIT"
fi

mkd_header "Deploy complete" "${ELAPSED}s elapsed"
mkd_success "Backend live on Heroku"
WEB_URL=$(heroku apps:info --app "$HEROKU_APP" -j 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('app',{}).get('web_url','').rstrip('/'))" 2>/dev/null || true)
mkd_kv "App URL" "${WEB_URL:-https://${HEROKU_APP}.herokuapp.com}"
mkd_kv "Release" "Check output above for version (Released v...)"
mkd_kv "Branch pushed" "$DEPLOY_BRANCH → main"

if [[ "$RUN_MIGRATE" == true ]]; then
  echo ""
  bash "$ROOT_DIR/scripts/migrate-heroku.sh" --app "$HEROKU_APP"
fi

echo ""
mkd_dim "Tip: npm run deploy:migrate  ·  npm run logs:heroku  ·  npm run migrate:heroku"
echo ""
