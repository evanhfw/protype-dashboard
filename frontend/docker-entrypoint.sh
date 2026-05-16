#!/bin/sh
set -e

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_KEY: "${VITE_API_KEY:-}"
};
EOF

exec /docker-entrypoint.sh "$@"
