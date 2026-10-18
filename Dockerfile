# --- Build: Abhängigkeiten, Tests-frei bauen -------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/games/package.json packages/games/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY packages ./packages
RUN npm run build

# --- Laufzeit: eine Datei Server plus die gebaute Web-App, keine Pakete ----------------------
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/packages/server/dist/server.mjs ./server.mjs
COPY --from=build /app/packages/server/dist/public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "server.mjs"]
