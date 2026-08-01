FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/companion/package.json apps/companion/tsconfig.json ./apps/companion/
COPY apps/companion/src ./apps/companion/src
COPY apps/ui/package.json apps/ui/tsconfig.json apps/ui/index.html ./apps/ui/
COPY apps/ui/src ./apps/ui/src
RUN npm install && npm run build -w @harbor/companion && npm run build -w @harbor/ui

FROM node:22-alpine
LABEL org.opencontainers.image.title="Harbor Companion" org.opencontainers.image.description="Unraid companion for Harbor"
WORKDIR /app
ENV NODE_ENV=production HARBOR_DATA_DIR=/config HARBOR_HOST=0.0.0.0 HARBOR_PORT=7331 HARBOR_UI_DIR=/app/apps/ui/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/companion/dist ./apps/companion/dist
COPY --from=build /app/apps/companion/package.json ./apps/companion/package.json
COPY --from=build /app/apps/ui/dist ./apps/ui/dist
RUN mkdir -p /config && chown -R node:node /app /config
USER node
EXPOSE 7331
VOLUME ["/config"]
CMD ["node", "apps/companion/dist/index.js"]
