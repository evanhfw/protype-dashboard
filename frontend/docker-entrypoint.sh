#!/bin/sh
set -e

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_KEY: "${VITE_API_KEY:-}"
};
EOF

if [ -x /docker-entrypoint.d/20-envsubst-on-templates.sh ]; then
    /docker-entrypoint.d/20-envsubst-on-templates.sh
fi

if ! nginx -t; then
    echo "ERROR: nginx configuration test failed"
    cat /etc/nginx/conf.d/default.conf 2>/dev/null || true
    exit 1
fi

exec nginx -g 'daemon off;'
