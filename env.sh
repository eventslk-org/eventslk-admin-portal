#!/bin/sh
# Runs at container startup — writes runtime environment variables into a JS file
# that the browser can read as window._env_ before api.js initialises.
cat > /usr/share/nginx/html/env-config.js << EOF
window._env_ = {
  API_BASE_URL: "${API_BASE_URL:-http://localhost:8080}"
};
EOF
