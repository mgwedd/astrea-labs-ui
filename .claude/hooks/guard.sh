#!/usr/bin/env bash
# PreToolUse guard for Bash/Edit/Write/NotebookEdit. Exit 2 blocks the call and
# shows stderr to Claude. Mirrors the hard rules in AGENTS.md.
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")

block() {
  echo "Blocked by .claude/hooks/guard.sh: $1" >&2
  exit 2
}

case "$tool" in
  Edit | Write | MultiEdit | NotebookEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
    name=$(basename "$path")
    case "$name" in
      .env.example) ;;
      .env | .env.*) block "don't write env files; secrets are set by the user (Vercel env vars)." ;;
      pnpm-lock.yaml) block "don't hand-edit the lockfile; use pnpm add/remove." ;;
      tsconfig.tsbuildinfo) block "tsbuildinfo is a build artifact; restore it with git checkout." ;;
    esac
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
    if grep -Eq '(^|[^[:alnum:]_-])--no-verify([^[:alnum:]_-]|$)' <<<"$cmd"; then
      block "don't skip git hooks (--no-verify)."
    fi
    # Only inspect the `git push …` segment, up to the next ; & or |.
    while IFS= read -r push; do
      if grep -Eq '(\s-f\b|--force\b|--force-with-lease|\s\+[[:alnum:]/_.-]+)' <<<"$push"; then
        block "force pushes need the user to run them."
      fi
      if grep -Eq '(\s|:)(refs/heads/)?main(\s|$)' <<<"$push"; then
        block "never push to main; push a feature branch and open a PR."
      fi
    done < <(grep -Eo '\bgit( -C [^ ]+)? push[^;&|]*' <<<"$cmd" || true)
    if grep -Eq '\bgit\b.*\b(add|commit)\b.*\.env(\.[[:alnum:]]+)?\b' <<<"$cmd" && ! grep -q '\.env\.example' <<<"$cmd"; then
      block "don't stage or commit env files."
    fi
    ;;
esac

exit 0
