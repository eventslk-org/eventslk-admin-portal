FROM nginx:alpine

# Copy static frontend files
COPY index.html login.html events.html users.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
