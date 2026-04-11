# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy only required root files
    COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
    
    # Copy only necessary parts of monorepo
    COPY apps/neodraw-frontend ./apps/neodraw-frontend
    COPY packages ./packages
    
    # Install dependencies
    RUN pnpm install
    
    # Build frontend
    RUN pnpm --filter neodraw-frontend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy only built app + deps
    COPY --from=builder /app/apps/neodraw-frontend ./apps/neodraw-frontend
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    
    EXPOSE 3000
    
    CMD ["pnpm", "--filter", "neodraw-frontend", "start"]