#!/usr/bin/env bash
set -euo pipefail

ENV_ID="${1:-}"
CLOUD_PATH="${2:-/}"
SOURCE_DIR="${3:-dist}"
MAX_RETRIES="${MAX_RETRIES:-3}"
ONLY_IMAGES="${ONLY_IMAGES:-0}"

if [[ -z "$ENV_ID" ]]; then
  echo "Usage: bash ./scripts/deploy-cloudbase-hosting.sh <env-id> [cloud-path] [source-dir]"
  echo "Example: bash ./scripts/deploy-cloudbase-hosting.sh cloud1-xxxx / dist"
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

normalize_cloud_path() {
  local raw="${1:-/}"
  if [[ "$raw" == "/" || -z "$raw" ]]; then
    echo "/"
    return
  fi

  raw="${raw#/}"
  raw="${raw%/}"
  echo "/$raw"
}

join_cloud_path() {
  local base
  local name

  base="$(normalize_cloud_path "${1:-/}")"
  name="${2#/}"
  name="${name%/}"

  if [[ -z "$name" ]]; then
    echo "$base"
    return
  fi

  if [[ "$base" == "/" ]]; then
    echo "/$name"
    return
  fi

  echo "$base/$name"
}

deploy_with_retry() {
  local local_path="$1"
  local remote_path="$2"
  local attempt=1

  while true; do
    echo "Deploying $local_path -> $remote_path (attempt $attempt/$MAX_RETRIES)"
    if tcb hosting deploy "$local_path" "$remote_path" -e "$ENV_ID"; then
      return 0
    fi

    if (( attempt >= MAX_RETRIES )); then
      echo "Deploy failed after $MAX_RETRIES attempts: $local_path -> $remote_path" >&2
      return 1
    fi

    sleep $(( attempt * 5 ))
    attempt=$(( attempt + 1 ))
  done
}

BASE_CLOUD_PATH="$(normalize_cloud_path "$CLOUD_PATH")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

find "$SOURCE_DIR" -maxdepth 1 -type f -exec cp "{}" "$TMP_DIR"/ \;

if find "$TMP_DIR" -maxdepth 1 -type f | grep -q .; then
  deploy_with_retry "$TMP_DIR" "$BASE_CLOUD_PATH"
fi

if [[ "$ONLY_IMAGES" != "1" ]]; then
  for dir_name in assets data; do
    if [[ -d "$SOURCE_DIR/$dir_name" ]]; then
      deploy_with_retry "$SOURCE_DIR/$dir_name" "$(join_cloud_path "$BASE_CLOUD_PATH" "$dir_name")"
    fi
  done
fi

for dir_name in mrmaple-images rhs-images herter-images ncsu-images coniferkingdom-images jmac-images user-images; do
  if [[ ! -d "$SOURCE_DIR/$dir_name" ]]; then
    continue
  fi

  parent_cloud_path="$(join_cloud_path "$BASE_CLOUD_PATH" "$dir_name")"
  echo "Deploying directory in chunks: $SOURCE_DIR/$dir_name -> $parent_cloud_path"

  while IFS= read -r -d '' entry_path; do
    entry_name="$(basename "$entry_path")"
    deploy_with_retry "$entry_path" "$(join_cloud_path "$parent_cloud_path" "$entry_name")"
  done < <(find "$SOURCE_DIR/$dir_name" -mindepth 1 -maxdepth 1 -print0)
done

echo "CloudBase hosting deploy completed."
