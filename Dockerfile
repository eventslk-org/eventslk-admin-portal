FROM nginx:alpine

# Copy static frontend files
COPY index.html login.html events.html users.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy and permission the entrypoint script
COPY env.sh /env.sh
RUN chmod +x /env.sh

# At startup: generate env-config.js from env vars, then start nginx
CMD ["/bin/sh", "-c", "/env.sh && nginx -g 'daemon off;'"]
