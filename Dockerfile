FROM nginx:alpine

# envsubst (from gettext) renders env-config.js from its template at container start
RUN apk add --no-cache gettext

# Copy static frontend files
COPY index.html login.html events.html users.html /usr/share/nginx/html/
COPY env-config.js env-config.template.js /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime config injection: nginx:alpine runs every script in /docker-entrypoint.d/
# before launching nginx. This renders env-config.js from API_BASE_URL.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-render-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-render-env-config.sh

# Default gateway URL; override with -e API_BASE_URL=... or the k8s deployment env.
ENV API_BASE_URL=http://localhost:8000

CMD ["nginx", "-g", "daemon off;"]
