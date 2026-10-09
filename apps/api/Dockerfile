# Serveur du classement sur un serveur Docker. Depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile -t circuit-du-jour-api .
#   docker run -d -p 8787:8787 -v cdj-data:/data -e TRUST_PROXY=1 -e RATE_SALT=<une-valeur-secrete> circuit-du-jour-api
# Le Salon (lot 27) est servi par le même conteneur, sans rien de plus : sessions de 10 minutes, circuits préparés par une tâche interne.
# Ne jamais régler SALON_MINUTES en production (tests et essais locaux seulement).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/sim/package.json packages/sim/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/sim packages/sim
COPY apps/api apps/api
RUN npm run build:node -w @cdj/api

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/apps/api/dist/server.mjs ./server.mjs
ENV PORT=8787 DB_PATH=/data/cdj.sqlite NODE_NO_WARNINGS=1
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "server.mjs"]
