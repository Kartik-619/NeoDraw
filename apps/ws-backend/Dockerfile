# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Root configs
    COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
    
    # Copy only required code
    COPY apps/ws-backend ./apps/ws-backend
    COPY packages ./packages
    
    # Install ONLY required deps
    RUN pnpm install --filter ws-backend... --frozen-lockfile
    
    # Build dependencies
    RUN pnpm --filter @repo/db build
    
    # Build ws backend
    RUN pnpm --filter ws-backend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Copy minimal package setup
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    COPY apps/ws-backend/package.json ./apps/ws-backend/package.json
    
    # Install ONLY production deps
    RUN npm install -g pnpm && pnpm install --prod --filter ws-backend...
    
    # Copy built output
    COPY --from=builder /app/apps/ws-backend/dist ./apps/ws-backend/dist
    
    # Expose WS port
    EXPOSE 8080
    
    # Start server
    CMD ["node", "apps/ws-backend/dist/index.js"]