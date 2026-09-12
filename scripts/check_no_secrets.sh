#!/usr/bin/env bash

set -euo pipefail

mode="${1:-all}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must run inside a git repository." >&2
  exit 2
fi

case "$mode" in
  all)
    files_command=(git ls-files -z)
    ;;
  staged)
    files_command=(git diff --cached --name-only -z --diff-filter=ACMR)
    ;;
  *)
    echo "Usage: $0 [all|staged]" >&2
    exit 2
    ;;
esac

patterns=(
  'OPENAI_API_KEY[[:space:]]*=[[:space:]]*["'\'']?sk-'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{32,}'
  'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*='
  'service_role[^[:space:]]*eyJ[A-Za-z0-9_-]+'
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'RESEND_API_KEY[[:space:]]*=[[:space:]]*["'\'']?re_[A-Za-z0-9_-]+'
  'AIza[0-9A-Za-z_-]{30,}'
  'GITHUB_TOKEN[[:space:]]*=[[:space:]]*["'\'']?gh[pousr]_[A-Za-z0-9_]+'
  'gh[pousr]_[A-Za-z0-9_]{30,}'
  'Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{20,}'
  '-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----'
)

allowed_files_regex='(^|/)(README\.md|SECURITY\.md|AGENTS\.md|scripts/check_no_secrets\.sh)$'
found=0
scanned=0

while IFS= read -r -d '' file; do
  [ -f "$file" ] || continue
  scanned=$((scanned + 1))

  if [[ "$file" =~ $allowed_files_regex ]]; then
    continue
  fi

  if ! grep -Iq . "$file"; then
    continue
  fi

  for pattern in "${patterns[@]}"; do
    if grep -En "$pattern" "$file" >/tmp/induradar-secret-scan-match 2>/dev/null; then
      echo "Potential secret detected in $file:" >&2
      sed 's/^/  /' /tmp/induradar-secret-scan-match >&2
      found=1
    fi
  done
done < <("${files_command[@]}")

rm -f /tmp/induradar-secret-scan-match

if [ "$found" -ne 0 ]; then
  cat >&2 <<'MESSAGE'

Secret scan failed.

Do not commit API keys, Supabase service_role keys, private keys, tokens, or
provider credentials. Store them in GitHub Actions Secrets, Supabase secrets,
or local .env files ignored by git. If a real secret was committed, rotate it.
MESSAGE
  exit 1
fi
