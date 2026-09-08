# NeoDraw — TODO & How to Run

## How to Run

### Prerequisites
- Node >= 18
- pnpm 9
- PostgreSQL running locally

### Setup
```bash
# 1. Create .env from template
cp .env.example .env
# Edit .env with your real DATABASE_URL and JWT_SECRET

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run all apps
pnpm dev

# Or run individually (in separate terminals):
pnpm dev:http       # HTTP backend on :3008
pnpm dev:ws         # WS backend on :8080
pnpm dev:frontend   # Next.js on :3000
```

### Testing & Quality (all verified passing)
```bash
pnpm test           # 32 tests across 5 files (unit + integration)
pnpm test:unit      # Unit tests only
pnpm test:integration  # Integration tests only
pnpm lint           # ESLint (9 targets, clean)
pnpm check-types    # TypeScript type checking (13 targets, clean)
pnpm format         # Prettier formatting
```

---

## What's Built (Phases 1–6)

### Phase 1: Monorepo Scaffold
- [x] Root `package.json` with turbo scripts
- [x] `pnpm-workspace.yaml`
- [x] `turbo.json` task graph
- [x] `tsconfig.base.json`
- [x] `.env.example`

### Phase 2: Shared Packages
- [x] `@repo/shared-types` — Tool, Shape, PersistedShape, WS messages, isValidShape, newId
- [x] `@repo/db` — TypeORM entities (User, Room, Chat, RoomShape), DataSource, shape-mapper
- [x] `@repo/common` — Zod schemas (CreateUser, SignIn, CreateRoom)
- [x] `@repo/backend-common` — JWT_SECRET config
- [x] `@repo/eslint-config` — ESLint presets
- [x] `@repo/typescript-config` — TS config presets

### Phase 3: HTTP Backend (port 3008)
- [x] Express 5 + CORS + cookie-parser
- [x] POST /signup, POST /signIn (JWT cookie)
- [x] POST /room, GET /room/:slug
- [x] Shape CRUD: GET/POST/PATCH/DELETE /rooms/:slug/shapes
- [x] POST /rooms/:slug/shapes/delete-many (bulk erase)
- [x] Chat: GET /rooms/:slug/chats, POST /rooms/:slug/chat
- [x] Auth middleware (JWT verification)
- [x] DI container (TypeORM repositories)

### Phase 4: WebSocket Backend (port 8080)
- [x] ws WebSocketServer with JWT auth
- [x] join_room / leave_room with presence broadcast
- [x] shape_add / shape_update / shape_delete / shape_delete_many
- [x] Chat broadcasting
- [x] Room isolation (membership guard)
- [x] broadcastToRoom with room scoping
- [x] Cleanup on socket close

### Phase 5: Frontend (port 3000)
- [x] Next.js App Router pages: /, /signin, /signup, /joinroom, /canvas/[roomId]
- [x] AuthPage component (sign up / sign in)
- [x] RoomCanvas (WS lifecycle, reconnect, presence)
- [x] Canvas (toolbar, member count, share link)
- [x] IconButton
- [x] Game engine (full drawing engine):
  - [x] rect, circle, diamond, pencil, text tools
  - [x] select tool (hit test + drag + delete)
  - [x] eraser tool (intersection + bulk delete)
  - [x] HTTP preload + WS event handling
  - [x] Render loop with selection box
  - [x] Stable event listener binding

### Phase 6: Tests
- [x] Vitest config with path aliases
- [x] In-memory repository implementations
- [x] Unit tests: shapes, schemas, auth, newId
- [x] Integration tests: shape CRUD, room creation, user creation
- [ ] **WebSocket integration test** with a real `WebSocketServer` on an ephemeral port (snapshots, isolation, presence, shape ops) — moved to Phase 10

---

## Up Next (Future Phases)

### Phase 7: Polish & Production
- [x] Add `.gitignore` for node_modules, dist, .next, .env
- [x] Add Tailwind CSS configuration to frontend (tailwind.config.ts + postcss.config.mjs + deps)
- [x] Add proper error boundaries in frontend (app/error.tsx, canvas error.tsx, ErrorBoundary component)
- [x] Add loading skeletons / better UX states (CanvasSkeleton, loading.tsx, Spinner in auth/join)
- [x] Add WebSocket reconnection indicator (Reconnecting badge + attempt count)
- [x] Add undo/redo support (OperationHistory + Ctrl/Cmd+Z/Y + toolbar buttons)
- [x] Add zoom/pan to canvas (wheel zoom around cursor, space/middle-drag pan, toolbar %, Ctrl+=/-/0)
- [x] Add shape color picker (color input + presets, per-shape color persisted)
- [x] Add export to PNG/SVG (toolbar buttons + shapesToSvg)
- [x] Add room sharing with permissions (editPermission: anyone/admin, share dialog, HTTP + WS enforcement)

### Phase 8: Database & Deployment
- [ ] Replace `synchronize: true` with proper migrations
- [ ] Add connection pooling (PgBouncer)
- [ ] Add Redis for WebSocket session store
- [ ] Add health check endpoints
- [ ] Add Docker Compose (postgres + both backends + frontend)
- [ ] Add CI/CD pipeline
- [ ] Add rate limiting
- [ ] Add request logging

### Phase 9: Advanced Features
- [ ] Layer groups / z-ordering
- [ ] Image upload to canvas
- [ ] Sticky notes
- [ ] Arrow connectors
- [ ] Curved pencil paths (freehand)
- [ ] Grid snapping
- [ ] Keyboard shortcuts
- [ ] Collaborative cursors (show other users' cursor positions)
- [ ] Board templates
- [ ] PDF export

### Phase 10: Testing & Quality
- [ ] E2E tests (Playwright) for critical flows
- [ ] WebSocket integration test with real ws server
- [ ] Frontend component tests (React Testing Library)
- [ ] Load testing (WebSocket concurrent connections)
- [ ] Security audit (XSS, CSRF, JWT rotation)
- [ ] Accessibility audit (WCAG 2.1 AA)
