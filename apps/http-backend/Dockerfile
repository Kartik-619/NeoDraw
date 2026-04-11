# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy root configs
    COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
    
    # Copy only required parts
    COPY apps/http-backend ./apps/http-backend
    COPY packages ./packages
    
    # Install deps
    RUN pnpm install --frozen-lockfile
    RUN pnpm --filter @repo/db build
    # Build backend
    RUN pnpm --filter http-backend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy built backend
    COPY --from=builder /app/apps/http-backend/dist ./apps/http-backend/dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    
    # Expose backend port
    EXPOSE 3008
    
    # Start backend
    CMD ["node", "apps/http-backend/dist/index.js"]