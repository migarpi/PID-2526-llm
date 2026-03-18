# --- deps cache ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY chat-frontend/package*.json ./
RUN npm ci

# --- build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY chat-frontend/ ./
# Para producción: API base por la misma origin (usaremos proxy /api)
# Si usas NEXT_PUBLIC_API_BASE, puedes setearlo en el compose como ""
ARG NEXT_PUBLIC_API_BASE=
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_USER_ID=1
ENV NEXT_PUBLIC_USER_ID=$NEXT_PUBLIC_USER_ID
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next recomienda habilitar standalone
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]