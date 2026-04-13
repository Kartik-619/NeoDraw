FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/neodraw-frontend ./apps/neodraw-frontend
COPY packages ./packages

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter neodraw-frontend build

# For Next.js standalone output
ENV NEXT_PUBLIC_HTTP_BACKEND=http://backend:3008
ENV NEXT_PUBLIC_WS_URL=ws://ws:8080

EXPOSE 3000

# Use the standalone server if it exists, otherwise use next start
CMD ["sh", "-c", "if [ -f apps/neodraw-frontend/.next/standalone/server.js ]; then cd apps/neodraw-frontend/.next/standalone && node server.js; else cd apps/neodraw-frontend && npx next start -p 3000; fi"]