# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Root configs
    COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
    
    # Copy only required parts
    COPY apps/http-backend ./apps/http-backend
    COPY packages ./packages
    
    # Install ONLY needed deps
    RUN pnpm install --filter http-backend... --frozen-lockfile
    
    # Build dependencies
    RUN pnpm --filter @repo/db build
    
    # Build backend
    RUN pnpm --filter http-backend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # ❌ no pnpm needed in production
    
    # Copy package.json for prod install
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    COPY apps/http-backend/package.json ./apps/http-backend/package.json
    
    # Install ONLY production deps
    RUN npm install -g pnpm && pnpm install --prod --filter http-backend...
    
    # Copy built files
    COPY --from=builder /app/apps/http-backend/dist ./apps/http-backend/dist
    
    EXPOSE 3008
    
    CMD ["node", "apps/http-backend/dist/index.js"]