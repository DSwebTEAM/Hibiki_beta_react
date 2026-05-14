# Hibiki v12 · Self-Hosting Guide

## Requirements
- Node.js 18+ 
- Any static file server

## Build
```bash
npm install
npm run build
# Output is in /dist
```

## Deploy options

### Netlify (recommended)
Push to GitHub → connect repo in Netlify → it reads netlify.toml automatically.
Or drag /dist into netlify.com/drop.

### Cloudflare Pages
Push to GitHub → connect in Cloudflare Pages → it reads wrangler.toml.
Or: `npm install -g wrangler && wrangler pages deploy dist`

### Self-host (nginx)
```nginx
server {
  listen 80;
  root /var/www/hibiki/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  gzip on;
  gzip_types text/plain text/css application/javascript application/json;
}
```

### Self-host (Docker)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## Notes
- Hibiki is 100% client-side. No server-side code required.
- All API keys are stored in browser localStorage only.
- No backend, no database, no user accounts.
