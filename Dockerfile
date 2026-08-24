# Coming-soon holding page.
# Replace this file when the real application lands — nothing else in the
# repo changes, provided the app honours the container contract
# (see how_to_deploy_website.md §2).
FROM nginxinc/nginx-unprivileged:1.27-alpine

# nginx-unprivileged runs as uid 101, not root, and defaults to 8080.
ENV PORT=8080
# Substitute only $PORT; leave nginx's own $uri/$host variables intact.
ENV NGINX_ENVSUBST_FILTER="^PORT$"

COPY --chown=101:101 app/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=101:101 app/index.html          /usr/share/nginx/html/index.html

EXPOSE 8080
