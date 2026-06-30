#!/usr/bin/env bash
# Shared terminal styling for MKD scripts.

if [[ -t 1 ]]; then
  MKD_BOLD=$'\033[1m'
  MKD_DIM=$'\033[2m'
  MKD_RESET=$'\033[0m'
  MKD_NAVY=$'\033[38;5;17m'
  MKD_BLUE=$'\033[38;5;39m'
  MKD_CYAN=$'\033[38;5;45m'
  MKD_GREEN=$'\033[32m'
  MKD_YELLOW=$'\033[33m'
  MKD_RED=$'\033[31m'
  MKD_MAGENTA=$'\033[35m'
  MKD_WHITE=$'\033[97m'
else
  MKD_BOLD='' MKD_DIM='' MKD_RESET='' MKD_NAVY='' MKD_BLUE='' MKD_CYAN=''
  MKD_GREEN='' MKD_YELLOW='' MKD_RED='' MKD_MAGENTA='' MKD_WHITE=''
fi

mkd_rule() {
  local char="${1:-─}"
  local width="${2:-62}"
  printf '%*s\n' "$width" '' | tr ' ' "$char"
}

mkd_header() {
  local title="$1"
  local subtitle="${2:-}"

  echo ""
  printf "${MKD_NAVY}${MKD_BOLD}"
  mkd_rule '═'
  printf "  %s\n" "$title"
  if [[ -n "$subtitle" ]]; then
    printf "${MKD_DIM}  %s${MKD_RESET}\n" "$subtitle"
  else
    echo -n "$MKD_RESET"
  fi
  printf "${MKD_NAVY}${MKD_BOLD}"
  mkd_rule '═'
  printf "${MKD_RESET}\n"
}

mkd_section() {
  echo ""
  printf "${MKD_CYAN}${MKD_BOLD}▸ %s${MKD_RESET}\n" "$1"
  printf "${MKD_DIM}"
  mkd_rule '─' 48
  printf "${MKD_RESET}\n"
}

mkd_kv() {
  printf "  ${MKD_DIM}%-14s${MKD_RESET} %s\n" "$1" "$2"
}

mkd_success() {
  printf "${MKD_GREEN}${MKD_BOLD}✓ %s${MKD_RESET}\n" "$1"
}

mkd_warn() {
  printf "${MKD_YELLOW}${MKD_BOLD}! %s${MKD_RESET}\n" "$1"
}

mkd_error() {
  printf "${MKD_RED}${MKD_BOLD}✗ %s${MKD_RESET}\n" "$1" >&2
}

mkd_dim() {
  printf "${MKD_DIM}%s${MKD_RESET}\n" "$1"
}

mkd_format_heroku_line() {
  local line="$1"
  local body="${line#remote: }"

  if [[ "$line" == remote:\ -----\>* ]]; then
    printf "${MKD_CYAN}${MKD_BOLD}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == remote:\ \!* ]]; then
    printf "${MKD_YELLOW}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == *"Released v"* ]] || [[ "$line" == *"deployed to Heroku"* ]]; then
    printf "${MKD_GREEN}${MKD_BOLD}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == *"Verifying deploy"* ]]; then
    printf "${MKD_BLUE}${MKD_BOLD}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == remote:\ Building* ]] || [[ "$line" == remote:\ Compressing* ]] || [[ "$line" == remote:\ Launching* ]]; then
    printf "${MKD_DIM}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == *"ERROR:"* ]] || [[ "$line" == *"error:"* && "$line" == remote:* ]]; then
    printf "${MKD_RED}${MKD_BOLD}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == *"npm fund"* ]] || [[ "$line" == *"packages are looking for funding"* ]]; then
    printf "${MKD_DIM}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == *"vulnerabilit"* && "$line" == remote:* ]]; then
    printf "${MKD_YELLOW}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == Enumerating* ]] || [[ "$line" == Counting* ]] || [[ "$line" == Compressing\ objects* ]] || [[ "$line" == Writing\ objects* ]]; then
    printf "${MKD_DIM}  %s${MKD_RESET}\n" "$line"
  elif [[ "$line" == To\ https://git.heroku.com/* ]]; then
    printf "${MKD_GREEN}  %s${MKD_RESET}\n" "$line"
  elif [[ "$line" == remote:\ Updated\ * ]]; then
    printf "${MKD_BLUE}  %s${MKD_RESET}\n" "$body"
  elif [[ "$line" == remote:* ]]; then
    printf "  %s\n" "$body"
  else
    printf "%s\n" "$line"
  fi
}

mkd_format_heroku_stream() {
  while IFS= read -r line || [[ -n "$line" ]]; do
    mkd_format_heroku_line "$line"
  done
}
