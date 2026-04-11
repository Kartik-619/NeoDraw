# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Root configs
    COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
    
    # Copy required code
    COPY apps/ws-backend ./apps/ws-backend
    COPY packages ./packages
    
    # Install deps
    RUN pnpm install --frozen-lockfile
    
    # Build shared packages first
    RUN pnpm --filter @repo/db build
    
    # Build ws backend
    RUN pnpm --filter ws-backend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy built output
    COPY --from=builder /app/apps/ws-backend/dist ./apps/ws-backend/dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    
    # Expose WS port (change if different)
    EXPOSE 8080
    
    # Start server
    CMD ["node", "apps/ws-backend/dist/index.js"]