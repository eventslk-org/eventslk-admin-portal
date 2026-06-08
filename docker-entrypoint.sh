#!/bin/sh
# Rendered as /docker-entrypoint.d/40-render-env-config.sh inside the nginx:alpine
# image, whose default entrypoint runs every script in /docker-entrypoint.d/ before
# starting nginx. This injects the runtime gateway URL into env-config.js so the
# same image can be repointed via the API_BASE_URL env var (docker -e or the k8s
# deployment) with no rebuild.
set -e

: "${API_BASE_URL:=http://localhost:30080}"
export API_BASE_URL

TEMPLATE=/usr/share/nginx/html/env-config.template.js
OUTPUT=/usr/share/nginx/html/env-config.js

if [ -f "$TEMPLATE" ]; then
  envsubst '${API_BASE_URL}' < "$TEMPLATE" > "$OUTPUT"
  echo "[entrypoint] env-config.js generated with API_BASE_URL=${API_BASE_URL}"
fi
