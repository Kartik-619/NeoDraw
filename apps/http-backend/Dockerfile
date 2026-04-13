FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/http-backend ./apps/http-backend
COPY packages ./packages

# Install with shamefully-hoist to make modules accessible at root
RUN pnpm install --frozen-lockfile --shamefully-hoist

RUN pnpm --filter @repo/db build
RUN pnpm --filter http-backend build

# Set NODE_PATH to help Node find pnpm's hoisted modules
ENV NODE_PATH=/app/node_modules

EXPOSE 3008

# Debug: List node_modules before running
RUN echo "=== Checking for express ===" && ls -la /app/node_modules/ | grep express || echo "Express not found in root node_modules"

CMD ["node", "apps/http-backend/dist/index.js"]