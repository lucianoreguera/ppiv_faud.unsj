# SPA Frontend — Sistema de Préstamo Digital Interdepartamental (FAUD-UNSJ)
# Etapa 1: build de producción con pnpm · Etapa 2: nginx sirve la SPA y hace de proxy de /api hacia el Backend NestJS

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# La SPA llama a /api/v1 en su mismo origen: nginx reenvía al Backend, sin CORS de por medio
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN pnpm run build

FROM nginx:1.27-alpine
# La imagen oficial aplica envsubst a /etc/nginx/templates/*.template al arrancar
ENV API_UPSTREAM=http://host.docker.internal:3000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
