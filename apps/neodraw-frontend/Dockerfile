# ---------- Stage 1: Builder ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN npm install -g pnpm
    
    # Copy ONLY what's needed for frontend
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
    COPY apps/neodraw-frontend ./apps/neodraw-frontend
    COPY packages ./packages
    
    # Install ONLY frontend deps
    RUN pnpm install --filter neodraw-frontend...
    
    # Build frontend
    RUN pnpm --filter neodraw-frontend build
    
    
    # ---------- Stage 2: Runner ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Copy standalone output ONLY
    COPY --from=builder /app/apps/neodraw-frontend/.next/standalone ./
    COPY --from=builder /app/apps/neodraw-frontend/.next/static ./.next/static
    COPY --from=builder /app/apps/neodraw-frontend/public ./public
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]