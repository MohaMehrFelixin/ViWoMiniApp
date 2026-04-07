FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Admin SPA talks to /api/v1/admin which is served by the same nginx host.
# No build-time API base needed — the ky client uses a relative prefix.
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback — every unknown route serves index.html so React Router
    # can handle client-side routing for /admin/*.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed static assets.
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
EXPOSE 80
