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

## 2. Feature inventory

This section catalogs the features currently implemented in the codebase, grouped by
functional area. All capabilities below exist in the working code (see the app modules).

### 2.1 Accounts & authentication

- **Sign up / sign in** — email + password (min 8 chars) via `POST /signup` /
  `POST /signIn`; bcrypt-hashed passwords; 409 "Email already in use" on duplicates,
  401 "Invalid credentials" on bad logins.
- **JWT sessions (7-day)** — issued at sign in and carried two ways: an `httpOnly`
  cookie (`sameSite=lax`) for REST, plus a `Bearer` header for REST and a `?token=`
  query param for the WebSocket handshake. The frontend keeps the token in
  `localStorage` and authenticates with the Bearer header.
- **Current-user lookup** — `GET /user/me` returns `{id, name, email}`; the navbar
  identity chip is built from it.
- **Auto-provisioned workspace** — signing in creates a personal board
  `{userId}-workspace` if it does not exist, so every account starts with a board.

### 2.2 Boards (rooms)

- **Create a board** — the dashboard "New Canvas" button calls `POST /room`, which
  assigns a `room-<uuid>[:8]` slug and marks the caller as admin.
- **Board list** — `GET /rooms` returns the boards the user owns or is a member of
  (most recently updated first). The dashboard shows per-board icons and badges for
  "Admin only edits", "Anyone can edit", and "Shared with you", plus a loading
  skeleton and an empty state.
- **Join a board** — `/joinroom` accepts a slug or a full URL (parsed for the segment
  after `/canvas/`) and routes to `/canvas/<slug>`.
- **Access model** — a board is readable only by its admin or explicit members
  (`RoomMember`); anyone else gets 404 (HTTP) or `join_denied` (WebSocket).
- **Edit permissions** — two levels: `anyone` (every member can edit) and `admin`
  (only the owner). The owner switches it via the Share dialog / `PATCH .../permissions`.
- **Member management (owner only)** — invite by email, list members (id + email),
  and remove members; the owner cannot be removed. Non-owners receive 403.

### 2.3 Real-time collaboration

- **Live shape sync** — every shape add/update/delete/bulk-delete is persisted to
  PostgreSQL and then broadcast to the room over WebSocket; clients apply the changes
  idempotently, keyed by client-generated UUID shape ids.
- **Presence** — `user_joined` / `user_left` broadcast the deduplicated member list
  (multiple sockets from one user collapse to a single member); the toolbar shows
  "{n} online".
- **Snapshot on join** — `joined_room` delivers room info, members, and the full shape
  history; the frontend additionally pre-loads shapes over HTTP and merges them with
  live frames (idempotent by id) so reconnects never lose state.
- **Room isolation** — broadcasts only reach sockets that have joined the room; join
  requires admin/membership; shape ops from non-members, against a non-existent room,
  or without edit permission are silently ignored.
- **Reconnection** — after a socket drop the client reconnects every 2 s (up to 10
  attempts), re-joins on open, and remounts the canvas via a `connectionEpoch` key; a
  "Reconnecting… (n)" pill reports progress, and a permanent "Connection lost. Please
  refresh." screen appears after the attempts are exhausted. Denied joins surface
  "You don't have access to this canvas".

### 2.4 Drawing tools

| Tool | Behavior |
|---|---|
| `rect` | Drag to draw an axis-aligned rectangle. |
| `circle` | Drag to draw a circle from the drag's bounding box (radius = half the diagonal). |
| `diamond` | Drag to draw a diamond (rotated square). |
| `pencil` | Drag to draw a straight line segment between start and end. |
| `freehand` | Freely draw a smoothed polyline (points thinned by distance; an empty click yields a dot). |
| `text` | Click to drop an on-canvas text input at that spot (see 2.5). |
| `select` | Click a shape to select it, then drag to move it. |
| `eraser` | Click or drag to delete intersecting shapes in bulk. |

- **Stroke color** — six preset colors plus a custom HTML color picker; the color is
  persisted per shape and applies to every tool, including text.
- **Live preview** — dashed gray preview outlines while dragging rect/circle/diamond/
  pencil/freehand, and a red translucent sweep box for the eraser.

### 2.5 Text tool

- **On-canvas typing** — clicking the canvas with the text tool opens an auto-growing
  dashed-border `<textarea>` right at the click point, focused and ready to type (no
  browser prompt dialog).
- **Multiline** — Enter inserts a new line; `Ctrl`/`Cmd`+Enter commits; Escape cancels;
  clicking elsewhere commits.
- **Visual fidelity** — the editor uses the current stroke color, stays anchored to the
  world coordinate where you clicked, scales its font with zoom, and repositions while
  panning/zooming. The committed text renders as multiple canvas `fillText` lines
  (font-size 20, line-height 1.2×); selection and eraser bounds account for line count.

### 2.6 Selection, editing & history

- **Hit-testing** — the select tool finds the topmost shape under the pointer via
  bounding-box tests in reverse z-order.
- **Drag to move** — movement is applied per shape type (rect/text shift `x`/`y`,
  circle/diamond shift center, pencil shifts both endpoints, freehand shifts all points);
  a history entry is recorded only when the geometry actually changed.
- **Delete** — `Delete` or `Backspace` removes the selected shape.
- **Undo / redo** — toolbar buttons plus `Ctrl`/`Cmd`+Z (undo), `Ctrl`/`Cmd`+Shift+Z and
  `Ctrl`/`Cmd`+Y (redo); capacity 100 operations (FIFO), redo stack cleared by any new
  action. History is collaboration-aware: undoing/redoing replays the compensating
  operation over WebSocket so other members see the effect.

### 2.7 Viewport navigation

- **Zoom** — toolbar +/− buttons (×1.25 around the canvas center), mouse-wheel zoom
  anchored at the cursor, `Ctrl`/`Cmd`+0 or the % button to reset; range 0.1×–4× with
  the current value shown in the toolbar.
- **Pan** — middle-mouse drag or Space + left-drag.

### 2.8 View-only mode

- When a board's edit permission is `admin` and the viewer is not the owner, the board
  opens in **view-only**: editing tools, undo/redo and color controls are disabled while
  zoom and pan still work; "View only" and hint pills are shown.

### 2.9 Sharing

- **Copy Link** — copies the current board URL to the clipboard with a temporary
  "Copied!" state.
- **Share dialog** — shows a copyable room URL and, for the admin, an invite-by-email
  field, a member list with "Remove" per member, and permission radios ("All members can
  edit" ↔ "Only the owner can edit") with a "Saving…" indicator. Non-admins get a
  read-only notice.

### 2.10 Export

- **PNG** — current canvas frame via `canvas.toBlob`, downloaded as `<slug>.png`.
- **SVG** — hand-generated SVG with an auto-computed viewBox (bounds + 20 px padding),
  one element per shape (multiline text exported as `<tspan>` runs, XML-escaped),
  downloaded as `<slug>.svg`.

### 2.11 Chat

- Backend-supported end to end: messages are created over REST
  (`POST /rooms/:slug/chat`), broadcast live over WebSocket, and persisted for history
  (`GET` endpoints). *Note: the frontend currently ships no chat UI wired to these
  endpoints.*

### 2.12 Persistence & resilience

- All state is durable in PostgreSQL: `User`, `Room`, `Chat`, `RoomShape` (shape bodies
  as jsonb), and `RoomMember`.
- Client-generated UUID shape ids make add/update/delete operations idempotent and safe
  against reconnects and concurrent sessions.
- REST and WebSocket stay consistent because the WebSocket server persists through the
  same repositories the REST app uses (persistence-before-broadcast).

### 2.13 Page & navigation chrome

- Marketing landing page — animated canvas mockup hero, marquee ticker, feature cards,
  stats band, "how it works" timeline, and CTAs.
- Auth pages (sign in/sign up with tabs and a password-visibility toggle), dashboard,
  and join-room page.
- Scene-fade SPA navigation driven by `neodraw:fade` custom events (navbar + landing
  CTAs), a sticky responsive navbar with auth state and a mobile menu.
- Per-page loading skeletons and error boundaries with "Try again" recovery.

---

## 3. Monorepo layout (pnpm workspaces + Turborepo)

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

## 4. Layering (how Clean Architecture is applied in practice)

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

## 5. Persistence (`@repo/db`)

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

## 6. Wire contracts (`@repo/shared-types`)

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

## 7. Frontend architecture

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

## 8. Event flow and guarantees

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

## 9. Testing strategy (`tests/`)

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

## 10. Extensibility

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

## 11. Common commands

| Command | Meaning |
|---|---|
| `pnpm install` | Install all workspace deps |
| `pnpm build` | Turbo build all packages/apps |
| `pnpm dev` | Turbo dev (builds deps, then runs all dev servers) |
| `pnpm dev:http` / `pnpm dev:ws` / `pnpm dev:frontend` | Run one app |
| `pnpm test` | Turbo test (unit + integration) |
| `pnpm lint` / `pnpm check-types` | Static checks |

See `doc.md` for full setup and the "how it works" walkthrough.