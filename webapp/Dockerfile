# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy sources
COPY . .

# ✅ Defaults a localhost para desarrollo local
ARG VITE_API_URL="http://localhost:3000"
ARG VITE_GAMEY_URL="http://localhost:4000"

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GAMEY_URL=${VITE_GAMEY_URL}
RUN npm run build

# Production image
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# ✅ Config nginx para SPA (evita 404 al recargar rutas)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
