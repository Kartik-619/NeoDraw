FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/ws-backend ./apps/ws-backend
COPY packages ./packages

RUN pnpm install --frozen-lockfile --shamefully-hoist

RUN pnpm --filter @repo/db build
RUN pnpm --filter ws-backend build

ENV NODE_PATH=/app/node_modules

EXPOSE 8080

RUN echo "=== Checking for ws ===" && ls -la /app/node_modules/ | grep ws || echo "WS not found in root node_modules"

CMD ["node", "apps/ws-backend/dist/index.js"]