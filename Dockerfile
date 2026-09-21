FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=file:/data/seo.sqlite
RUN npm run db:generate && npm run build && npm prune --omit=dev && npm run db:generate

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production PORT=3000 DATABASE_URL=file:/data/seo.sqlite
EXPOSE 3000
VOLUME ["/data"]
CMD ["npm", "run", "docker-start"]
