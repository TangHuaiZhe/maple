#!/usr/bin/env bash
set -euo pipefail

ENV_ID="${1:-}"
TARGET="${2:-app}"
SOURCE_DIR="${3:-dist}"

if [[ -z "$ENV_ID" ]]; then
  echo "Usage: bash ./scripts/deploy-cloudbase-incremental.sh <env-id> <app|assets|data|user-images> [source-dir]" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

deploy_dir() {
  local local_path="$1"
  local remote_path="$2"

  if [[ ! -e "$local_path" ]]; then
    echo "Deploy source not found: $local_path" >&2
    exit 1
  fi

  tcb hosting deploy "$local_path" "$remote_path" -e "$ENV_ID"
}

deploy_root_files() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  find "$SOURCE_DIR" -maxdepth 1 -type f -exec cp "{}" "$tmp_dir"/ \;

  if find "$tmp_dir" -maxdepth 1 -type f | grep -q .; then
    deploy_dir "$tmp_dir" /
  fi
}

case "$TARGET" in
  app)
    deploy_root_files
    deploy_dir "$SOURCE_DIR/assets" /assets
    ;;
  assets)
    deploy_dir "$SOURCE_DIR/assets" /assets
    ;;
  data)
    deploy_dir "$SOURCE_DIR/data" /data
    ;;
  user-images)
    deploy_dir "$SOURCE_DIR/user-images" /user-images
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Expected one of: app, assets, data, user-images" >&2
    exit 1
    ;;
esac
