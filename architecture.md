# NeoDraw — System Architecture

NeoDraw is a real-time collaborative whiteboard. Multiple users join a room and draw
together on a shared canvas; shapes and text are persisted server-side so the board
survives reloads, and all changes are pushed to the other members of the room
immediately over WebSocket.

This document describes the high-level architecture: the components, how they are
layered, how they communicate, and the key design decisions.

---

## 1. Overview

The system is composed of three runtimes, plus a set of shared packages:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        neodraw-frontend (Next.js, :3000)               │
│   app/ pages · components/ (RoomCanvas, Canvas) · draw/ (Game engine)  │
└───────────────┬─────────────────────────────────┬──────────────────────┘
                │ WebSocket (:8080)               │ HTTP (:3008)
                ▼                                 ▼
┌─────────────────────────────┐     ┌───────────────────────────────────────┐
│       ws-backend            │     │            http-backend               │
│  real-time collaboration    │     │  auth + REST + durable shape CRUD     │
│  (join rooms, broadcast)    │     │                                       │
└───────────────┬─────────────┘     └───────────────────┬───────────────────┘
                │                                       │
                └───────────────────┬───────────────────┘
                                    ▼
                    ┌────────────────────────────────────┐
                    │    PostgreSQL  (via @repo/db)      │
                    │  user · room · chat · room_shape   │
                    └────────────────────────────────────┘
```

Cross-service communication is **event-driven over WebSocket** — there are no direct
HTTP calls between the two backends. The HTTP backend is the source of durable state
(shapes, chats, users); the WS backend is the real-time transport that fans events out
per-room.

---

## 2. Monorepo layout (pnpm workspaces + Turborepo)

```
NeoDraw/
├── apps/
│   ├── http-backend/        # REST API (Express 5, :3008)
│   ├── ws-backend/          # WebSocket server (ws, :8080)
│   └── neodraw-frontend/    # Next.js 16 app (:3000)
├── packages/
│   ├── shared-types/        # Cross-process contracts: Tool, Shape, PersistedShape, WS messages, isValidShape
│   ├── db/                  # TypeORM entities + DataSource + shape mapper
│   ├── common/              # Zod schemas (signup, signin, room validation)
│   ├── backand-common/      # Shared backend config (JWT secret)
│   ├── ui/                  # Shared React UI primitives
│   ├── eslint-config/       # Shared ESLint presets
│   └── typescript-config/   # Shared tsconfig presets
├── tests/                   # Vitest unit + integration tests (package `ny-tests`)
├── pnpm-workspace.yaml      # workspace roots: apps/*, packages/*, tests
├── turbo.json               # build/lint/test/dev task graph
└── package.json             # root scripts + turbo
```

The `@repo/shared-types` package is the **single source of truth for the wire
contract**. Both backends and the frontend import the same types and the same runtime
shape validator, so a malformed/outdated client message is rejected consistently.

---

## 3. Layering (how Clean Architecture is applied in practice)

The backends follow a lightweight Clean Architecture / SOLID structure. The pattern is
identical in `http-backend` and `ws-backend`:

```
src/
├── index.ts                    # Presentation layer — HTTP routes / WS message handlers
├── middleware.ts (http)        # Presentation concern — JWT cookie guard
├── application/
│   ├── repositories.ts         # Application layer — repository interfaces (abstractions)
│   └── container.ts            # Composition root — Dependency Injection container
└── infrastructure/
    └── repositories/index.ts   # Infrastructure — TypeORM implementations of the interfaces
```

| Layer | Responsibility | Examples |
|---|---|---|
| **Domain contracts** | Wire types + validation rules shared everywhere | `@repo/shared-types` (`Shape`, `PersistedShape`, `Tool`, `isValidShape`) |
| **Application** | Business rules / orchestration through interfaces, no DB knowledge | `ShapeRepository`, `RoomRepository`, `ChatRepository`, `UserRepository` interfaces |
| **Infrastructure** | Concrete DB access, real transports | `TypeOrmShapeRepository`, `WebSocketServer`, `AppDataSource` |
| **Presentation** | Parsing/validating input, responding over HTTP or WS | Express routes in `http-backend/src/index.ts`, WS handlers in `ws-backend/src/index.ts` |

**Dependency Injection**: each backend exports a `container` singleton built in
`application/container.ts` that supplies every repository to the handlers. Handlers
never touch TypeORM directly — they go through `container.shapes`, `container.rooms`,
etc. This is what allows the test suite to substitute in-memory repositories.

**Interfaces (port/adapter)**: `application/repositories.ts` defines small, focused
interfaces (ISP); `infrastructure/repositories/index.ts` implements them with TypeORM
(adapter). Swapping the DB engine later only requires a new adapter.

---

## 4. Persistence (`@repo/db`)

Four entities, auto-synced on startup (`synchronize: true`, no migration files):

```
user 1 ───< room (admin, nullable)
user 1 ───< chat          room 1 ───< chat
user 1 ───< room_shape    room 1 ───< room_shape
```

| Entity | Fields | Purpose |
|---|---|---|
| `User` | `id` (uuid), `email` (unique), `password`, `name` | Accounts for auth |
| `Room` | `id` (serial), `slug` (unique URL id), `adminId` | A collaborative board, addressed everywhere by its **slug** |
| `Chat` | `id` (uuid), `message`, `userId`, `roomId` | Historical chat messages |
| `RoomShape` | `id` (uuid), `roomId`, `userId`, `data` (jsonb) | A first-class persisted shape |

The key design choice: shape geometry is stored as structured **JSONB** in the `data`
column (`packages/db/src/entities/RoomShape.ts`). Adding a new shape type (e.g. an
arrow or curve) requires **zero schema changes** — just extend the `Shape` union in
`@repo/shared-types`, the renderer, and `isValidShape`.

`packages/db/src/shape-mapper.ts` converts an entity into the wire format:

```ts
function toPersistedShape(shape: RoomShape): PersistedShape {
  return { ...shape.data, id: shape.id, userId: shape.userId };
}
```

---

## 5. Wire contracts (`@repo/shared-types`)

Client ↔ WS-backend messaging (also used by the HTTP shape endpoints):

```ts
type Tool = "circle" | "rect" | "pencil" | "diamond" | "text" | "eraser" | "select";

type Shape =
  | { type: "rect"; x; y; width; height }
  | { type: "circle"; centerX; centerY; radius }
  | { type: "pencil"; startX; startY; endX; endY }
  | { type: "diamond"; centerX; centerY; width; height }
  | { type: "text"; x; y; text; fontSize; color? };

type PersistedShape = Shape & { id: string; userId: string };
```

Every shape that crosses the network carries an `id`. `isValidShape()` is a runtime
guard shared by both backends and used by the frontend when parsing HTTP responses.

### WebSocket protocol (WS-backend, `:8080`)

**Client → Server** (`{ type: ... }`):

| type | payload |
|---|---|
| `join_room` | `{ roomId }` |
| `leave_room` | `{ roomId }` |
| `chat` | `{ roomId, message }` |
| `shape_add` | `{ roomId, shape: PersistedShape }` |
| `shape_update` | `{ roomId, shapeId, shape }` |
| `shape_delete` | `{ roomId, shapeId }` |
| `shape_delete_many` | `{ roomId, shapeIds: string[] }` |

**Server → Client** (broadcast to a single room, with `type` discriminator):

| type | delivered to | payload |
|---|---|---|
| `connection` | sender | `{ userId }` |
| `joined_room` | sender | `{ roomId, room, members, shapes }` — full snapshot |
| `user_joined` | other members | `{ userId, roomId }` |
| `user_left` | remaining members | `{ userId, roomId }` |
| `chat` | all members | `{ message, roomId, userId, createdAt }` |
| `shape_add` | all members | `{ roomId, shape: PersistedShape }` |
| `shape_update` | all members | `{ roomId, shape: PersistedShape }` |
| `shape_delete` | all members | `{ roomId, shapeId }` |
| `shape_delete_many` | all members | `{ roomId, shapeIds }` |

### HTTP API (HTTP-backend, `:3008`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /signup` | – | Create account → `{ userId }` |
| `POST /signIn` | – | Login → sets `token` cookie, returns `{ slug, token }` |
| `POST /room` | cookie | Create a (legacy) room → `{ roomId }` |
| `GET /room/:slug` | – | Resolve a room by slug (creates it on first access) |
| `GET /rooms/:slug/shapes` | – | Full shape history sent to clients and listed here |
| `POST /rooms/:slug/shapes` | cookie | Persist one shape (accepts client id) |
| `PATCH /rooms/:slug/shapes/:shapeId` | cookie | Update a shape (404 if not in this room) |
| `DELETE /rooms/:slug/shapes/:shapeId` | cookie | Delete a shape (404 if not in this room) |
| `POST /rooms/:slug/shapes/delete-many` | cookie | Bulk delete (eraser) → `{ removed }` |
| `GET /rooms/:slug/chats` / `GET /chats/:roomId` | – | Chat history (slug and legacy numeric) |
| `POST /rooms/:slug/chat` | cookie | Append a chat message |

---

## 6. Frontend architecture

```
apps/neodraw-frontend/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Marketing / landing
│   ├── signin/page.tsx            # → AuthPage(isSignin)
│   ├── signup/page.tsx            # → AuthPage
│   ├── joinroom/page.tsx          # Paste-a-link → /canvas/<slug>
│   └── canvas/[roomId]/page.tsx   # Server component: validates room, renders RoomCanvas
├── components/
│   ├── RoomCanvas.tsx             # WS lifecycle: connect, join, reconnect, presence
│   ├── Canvas.tsx                 # <canvas> + tool Topbar + Game instantiation
│   ├── AuthPage.tsx               # Sign up / sign in form
│   └── IconButton.tsx             # Toolbar button
└── draw/
    ├── Game.ts                    # The drawing engine (all tools, WS send/recv, render)
    └── http.ts                    # getExistingShapes → GET /rooms/:slug/shapes
```

The drawing engine is a plain class (`Game`, not a React component) that owns the
canvas:

- **Local render loop** (`clearCanvas` → `drawShape`) — draws the full shape list,
  plus a dashed selection box for the selected shape.
- **Mouse handlers** are class arrow-function fields, so add/removeEventListener
  binding stays stable and `destroy()` is safe on unmount.
- **WS handlers** (`initHandlers`) subscribe to `shape_add/update/delete/delete_many`
  and presence events, all idempotent keyed by shape `id` (a `Map<string, PersistedShape>
  index with a parallel array).
- **Tools** map select→hit-test + drag, `eraser`→intersection compute + bulk delete,
  `text`→prompt + add, the rest→drag-to-commit shapes.

**Critical init ordering**: `RoomCanvas` consumes `joined_room` *before* `Game` mounts
(it is what triggers the render). `Game.init()` therefore pre-loads the authoritative
snapshot over HTTP (`getExistingShapes`) and sets `isInitialized`; a `joined_room`
arriving later via WS is still merged on top (idempotent by id).

---

## 7. Event flow and guarantees

The collaboration model is **CRDT-in-spirit**: the client generates a UUID per shape,
the server persists it with that id, and every mutation (`add/update/delete/delete-many`)
is a room-scoped broadcast. Because operations are keyed by id:

- Senders are idempotent against their own echo (they already applied the change).
- Late joiners get the full snapshot in `joined_room`.
- No client ever replaces the whole list from a peer message, so concurrent sessions
  cannot clobber each other.

Correctness guarantees enforced in code:

| Guarantee | Where enforced |
|---|---|
| Room isolation (no cross-room leakage) | `broadcastToRoom` only targets sockets whose `user.rooms` includes the slug (`ws-backend/src/index.ts`) |
| Membership guard — cannot mutate a room you haven't joined | `!user.rooms.includes(roomSlug)` early-return on every shape mutation |
| Shape validation at the boundary | `isValidShape` before persistence in both backends |
| HTTP cross-room access blocked | `PATCH/DELETE` verify `existing.roomId === room.id` → 404 |
| Presence is accurate | `user_joined`/`user_left` on join/leave/close; member list computed from live sockets |
| Durability | every mutation is written to PostgreSQL before broadcasting |
| No polling | real-time push only |

---

## 8. Testing strategy (`tests/`)

Vitest, two suites under `tests/` (package `ny-tests`):

- **`unit/`** — pure logic: `eraser.test.ts` (intersection math incl. text),
  `shapes.test.ts` + `shapeParsing.test.ts` (validator + HTTP payload filtering),
  `schemas.test.ts`, `auth.test.ts`.
- **`integration/`** — full flows with in-memory repositories
  (`helpers/memoryRepositories.ts` implements the same interfaces the backends use,
  via `createMemoryContainer`): `rooms.test.ts` (REST incl. shape CRUD over HTTP) and
  `websocket.test.ts` (a real `WebSocketServer` on an ephemeral port with a buffered
  test client, covering snapshots, isolation, presence, and every shape operation).

`tests/vitest.config.ts` aliases `@repo/*` packages to their sources, so tests run
against the shared types directly.

---

## 9. Extensibility

The architecture is deliberately easy to extend:

- **New shape type**: add a variant to `Shape` in `@repo/shared-types`, extend
  `isValidShape`, draw it in `Game.drawShape`/`drawSelectionBox`/hit-testing, and give
  it a toolbar tool. No DB migration, no new endpoints.
- **New real-time event**: add a discriminated union member in `shared-types`, a
  handler in `ws-backend/src/index.ts`, and a branch in `Game.initHandlers`.
- **New persistence backend**: implement the `ShapeRepository`/`RoomRepository`/
  `ChatRepository`/`UserRepository` interfaces (already required by `container.ts`).
- **New app**: add it under `apps/`, import the shared packages, and wire it into
  `turbo.json`'s task graph.

---

## 10. Common commands

| Command | Meaning |
|---|---|
| `pnpm install` | Install all workspace deps |
| `pnpm build` | Turbo build all packages/apps |
| `pnpm dev` | Turbo dev (builds deps, then runs all dev servers) |
| `pnpm dev:http` / `pnpm dev:ws` / `pnpm dev:frontend` | Run one app |
| `pnpm test` | Turbo test (unit + integration) |
| `pnpm lint` / `pnpm check-types` | Static checks |

See `doc.md` for full setup and the "how it works" walkthrough.