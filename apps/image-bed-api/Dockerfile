FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/image-bed-api/package.json apps/image-bed-api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm shared:build
RUN pnpm image-bed:api:build

FROM node:22-bookworm-slim AS runtime
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/image-bed-api/package.json ./apps/image-bed-api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile --filter @woodfish-nest/image-bed-api...
COPY --from=build /app/apps/image-bed-api/dist ./apps/image-bed-api/dist
COPY --from=build /app/apps/image-bed-api/migrations ./apps/image-bed-api/migrations
COPY --from=build /app/apps/image-bed-api/package.json ./apps/image-bed-api/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
WORKDIR /app/apps/image-bed-api
ARG RELEASE_SHA
ENV MUYU_RELEASE_SHA=$RELEASE_SHA
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
