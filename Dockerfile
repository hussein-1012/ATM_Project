# syntax=docker/dockerfile:1
# Debian-slim base (glibc) because argon2 ships prebuilt binaries for
# linux-x64/arm64 glibc but not musl (alpine).
FROM node:22-slim AS base
RUN npm i -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# data is bind-mounted by docker-compose; baked in as a fallback
COPY data ./data
EXPOSE 3000
CMD ["node", "dist/main.js"]
