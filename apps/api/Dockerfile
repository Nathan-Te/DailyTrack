# Serveur de l'API de la plateforme (DailyTrack : classement, planning, Salon ; DailyJump : `/api/jump/`). Depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile -t circuit-du-jour-api .
# Cloud Run (production) : voir docs/mise-en-ligne.md. Il fournit PORT ; la base est Turso (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN en secret),
# les origines autorisées sont ALLOWED_ORIGINS. Essai local avec un serveur libSQL :
#   docker run -p 8081:8080 ghcr.io/tursodatabase/libsql-server
#   docker run -p 8080:8080 -e TURSO_DATABASE_URL=http://host.docker.internal:8081 -e ALLOWED_ORIGINS='*' circuit-du-jour-api
# Sur un serveur à soi, sans Turso : SQLite dans le volume /data (`-v cdj-data:/data -e ALLOWED_ORIGINS=… -e TRUST_PROXY=1 -e RATE_SALT=…`).
# SALON_MINUTES : jamais en production (le serveur refuse de démarrer avec elle).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/sim/package.json packages/sim/
COPY packages/clock/package.json packages/clock/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/jump-sim/package.json packages/jump-sim/
COPY packages/profile/package.json packages/profile/
# DailyJump (lot 0) : le jeu lui-même n'entre pas dans l'image, mais le verrou (package-lock.json) liste son espace de travail.
COPY apps/jump/package.json apps/jump/
# Seulement ce dont l'API a besoin (pas Three.js, pas Playwright) : une construction rapide.
RUN npm ci -w @cdj/api --ignore-scripts
COPY packages/core packages/core
COPY packages/sim packages/sim
COPY packages/clock packages/clock
# Lot P0 (plateforme) : la simulation de DailyJump (le serveur calcule le niveau du jour par la même règle que le jeu), ses niveaux figés
# (inclus dans le paquet par scripts/build-node.mjs : `/api/jump/info` les liste) et le module de profil commun (côté client aujourd'hui ;
# copié pour que l'image suive l'espace de travail de la plateforme).
COPY packages/jump-sim packages/jump-sim
COPY packages/profile packages/profile
COPY apps/jump/public/levels apps/jump/public/levels
COPY apps/api apps/api
RUN npm run build:node -w @cdj/api

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/apps/api/dist/server.mjs ./server.mjs
# Un seul fichier JavaScript : pas de node_modules à charger au réveil. Pas de variable GIT_SHA ici : le déploiement la pose.
ENV NODE_ENV=production NODE_NO_WARNINGS=1 PORT=8080 DB_PATH=/data/cdj.sqlite
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
