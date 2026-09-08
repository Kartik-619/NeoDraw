# NeoDraw — How Everything Works

A hands-on guide to NeoDraw: what each piece does, how the pieces fit together, and how
the collaboration actually works end to end. For the big-picture design, see
`architecture.md`.

---

## 1. What NeoDraw is

A collaborative whiteboard. After signing in, each user is dropped into their own
workspace room (`<userId>-workspace`) and can also create/join shared rooms. Everyone in
the same room sees a live canvas: rectangles, circles, diamonds, pencil lines and text,
and can select/move/erase any shape. All shapes are saved to PostgreSQL.

| Piece | What it does | Port / default |
|---|---|---|
| `neodraw-frontend` | The Next.js app you open in a browser | `http://localhost:3000` |
| `ws-backend` | The real-time server: rooms, presence, shape events | `ws://localhost:8080` |
| `http-backend` | Auth (signup/signin), chat history, durable shape CRUD | `http://localhost:3008` |
| PostgreSQL | Persistence for users, rooms, chats, shapes | per `DATABASE_URL` |

---

## 2. Getting started

Prerequisites: Node >= 18, pnpm 9, a running PostgreSQL.

1. **Create a `.env` at the repo root** (use `.env.example` as a template and fill in
   real values — there is no committed `.env`):
   ```
   DATABASE_URL=postgres://user:password@localhost:5432/neodraw
   JWT_SECRET=some-long-random-string
   ```

2. Install and build:
   ```
   pnpm install
   pnpm build
   ```

3. Run everything:
   ```
   pnpm dev
   ```
   Or run the three apps individually (in separate terminals):
   ```
   pnpm dev:http       # HTTP backend on :3008
   pnpm dev:ws         # WS backend on :8080
   pnpm dev:frontend   # Frontend on :3000
   ```

4. Open `http://localhost:3000`, sign up, then sign in. You are taken to
   `/canvas/<your-id>-workspace`. Share this link (or use the share button) with a
   second account/browser to collaborate.

> Tables are auto-created on first boot (`synchronize: true`). The DB package also
> listens for a `DATABASE_URL` env var; without it the backend will fail to connect.

### Environment variables

| Variable | Used by | Default |
|---|---|---|
| `DATABASE_URL` | `@repo/db` DataSource | – (required) |
| `JWT_SECRET` | `@repo/backend-common/config` | `"123123"` (dev only) |
| `NEXT_PUBLIC_HTTP_BACKEND` | frontend `config.ts` | `http://localhost:3008` |
| `NEXT_PUBLIC_WS_URL` | frontend `config.ts` | `ws://localhost:8080` |
| `FRONTEND_ORIGIN` | http-backend CORS | `http://localhost:3000` |

---

## 3. What each package/app does

### 3.1 `packages/shared-types` — the contract

Everything `@repo/shared-types` — `Tool`, `Shape`, `PersistedShape`, `ServerShapeMessage`,
and `isValidShape()` — is shared by all three runtimes. `isValidShape()` is a runtime
guard used by both backends before trusting an incoming shape, and by the frontend when
parsing server responses.

### 3.2 `packages/db` — persistence

- `src/data-source.ts` — the TypeORM `AppDataSource` (Postgres, `synchronize: true`).
- `src/entities/*` — `User`, `Room`, `Chat`, `RoomShape`.
- `src/shape-mapper.ts` — `toPersistedShape(entity)` spreads the JSONB `data` and adds
  `id` + `userId` → the `PersistedShape` sent over the wire.
- `src/index.ts` — `initializeDatabase()` (auto-runs on import) and the `db` helper:
  `db.users()`, `db.rooms()`, `db.chats()`, `db.shapes()`.

### 3.3 `packages/common` — Zod schemas

`CreateUserSchema` (email, password ≥ 8, name), `SignInSchema`, `CreateRoomSchema`.
Used by http-backend to validate request bodies.

### 3.4 `packages/backand-common`

`JWT_SECRET` resolution for both backends.

### 3.5 `packages/ui`, `eslint-config`, `typescript-config`

Shared React buttons/cards/code, ESLint presets, and TS config presets used by the apps.

---

## 4. The HTTP backend (`apps/http-backend`, port 3008)

Express 5 + CORS (credentials allowed for `FRONTEND_ORIGIN`) + JSON + cookie parsing.

### Auth

- **`POST /signup`** — validates body, checks email uniqueness, creates the `User`,
  returns `201 { userId }` (or `400` invalid / `409` exists).
- **`POST /signIn`** — validates, compares plaintext password, and on success:
  1. Signs a JWT `{ userId }`, sets an `httpOnly` cookie `token`.
  2. Ensures the user's default room `<userId>-workspace` exists.
  3. Returns `{ slug, token }`.

  The frontend stores `token` in `localStorage` (used for WebSocket auth) and navigates
  to `/canvas/<slug>`. The `token` cookie is used by the HTTP middleware.

### Middleware (`src/middleware.ts`)

Reads `req.cookies.token`, verifies the JWT with `JWT_SECRET`, sets `req.userId`, or
responds `403`. Applied to all mutating endpoints (`POST /room`, chat, shape writes).

### Shape CRUD endpoints

- `GET /rooms/:slug/shapes` → `{ shapes: PersistedShape[] }`, oldest first. Called by
  the frontend to preload the board.
- `POST /rooms/:slug/shapes` → body `{ shape }`; validates with `isValidShape`,
  **preserves the client-provided `id`**, persists, returns `201 { shape }`.
- `PATCH /rooms/:slug/shapes/:shapeId` → body `{ shape }`; returns 404 if the shape
  doesn't exist **or belongs to a different room** (cross-room isolation).
- `DELETE /rooms/:slug/shapes/:shapeId` → same room check, returns `{ success: true }`.
- `POST /rooms/:slug/shapes/delete-many` → body `{ shapeIds: string[] }`; bulk delete
  (used by the eraser), returns `{ success: true, removed }`.

`resolveRoomBySlug` creates a room if it never existed (first access).

### Chat endpoints (still used / legacy)

`GET /room/:slug` (resolve-or-create), `GET /rooms/:slug/chats` and legacy
`GET /chats/:roomId`, `POST /rooms/:slug/chat` (auth, appends a chat row).

---

## 5. The WebSocket backend (`apps/ws-backend`, port 8080)

A raw `ws` WebSocketServer. This is where all real-time state lives — the HTTP backend
does **not** track who is online in which room.

### Connection & auth

On connection it reads the token from the query string (`?token=...`) or from an
`httpOnly` cookie, verifies it, and either closes the socket or registers a `User`
record: `{ userId, rooms: [], ws }`. A `connection` message is sent back.

### Received messages (client → server)

All messages are one JSON object discriminated by `type`:

| `type` | What the server does |
|---|---|
| `join_room { roomId }` | Resolves/creates the room; adds it to `user.rooms`; broadcasts `user_joined` to **other** members; sends the joining peer `joined_room` with the current **member list** and the **full shape snapshot**. |
| `leave_room { roomId }` | Removes the room from `user.rooms`; broadcasts `user_left`. |
| `chat { roomId, message }` | Persists a `Chat` row, broadcasts `chat` to the room. |
| `shape_add { roomId, shape }` | Requires membership + `isValidShape`; persists with the client id; broadcasts `shape_add` to the room. |
| `shape_update { roomId, shapeId, shape }` | Requires membership; updates the row (ignored if missing); broadcasts `shape_update`. |
| `shape_delete { roomId, shapeId }` | Requires membership; deletes the row; broadcasts `shape_delete`. |
| `shape_delete_many { roomId, shapeIds }` | Requires membership; bulk deletes; broadcasts `shape_delete_many`. |

The membership guard (`!user.rooms.includes(roomSlug)`) means a socket can only mutate
rooms it explicitly joined — the basis of cross-room isolation.

### Broadcasting

`broadcastToRoom(roomSlug, payload)` iterates the connected `users` and sends only to
sockets whose `rooms` array includes the slug and whose `readyState === OPEN`. Presence
events use an `exceptUserId` so the actor is not told about its own join.

On socket `close`, the server broadcast `user_left` for every room the user was in, then
removes the user.

---

## 6. The frontend (`apps/neodraw-frontend`, port 3000)

### Pages (App Router)

| Route | File | Behavior |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing page with buttons to sign in / sign up / join a room |
| `/signup` | `app/signup/page.tsx` | `AuthPage` in sign-up mode → posts `/signup`, redirects to `/signin` |
| `/signin` | `app/signin/page.tsx` | `AuthPage` in sign-in mode → stores `localStorage.token`, redirects to `/canvas/<slug>` |
| `/joinroom` | `app/joinroom/page.tsx` | Accepts a URL or slug, navigates to `/canvas/<slug>` |
| `/canvas/[roomId]` | `app/canvas/[roomId]/page.tsx` | Server component: `GET /room/:slug`, `notFound()` on bad slug, renders `RoomCanvas` |

### `components/RoomCanvas.tsx` — the WebSocket lifecycle

1. Reads `token` from `localStorage`, opens `new WebSocket(WS_URL + "?token=" + token)`.
2. On `onopen`, sends `join_room { roomId }`.
3. On `joined_room`, stores the member list (`initialMembers`), sets the socket state
   and an `connectionEpoch` counter, and renders `<Canvas key={connectionEpoch} …/>`.
4. On close → auto-reconnects up to 10 times (2s delay), showing a spinner; past the
   limit it shows an error screen with a Retry button.
5. On unmount it sends `leave_room` and closes the socket.

### `components/Canvas.tsx` — the board UI

- Owns the `<canvas>` element, the tool `Topbar` (pencil, rect, circle, diamond, text,
  select, eraser, share), and the live member count pill.
- Instantiates the `Game` engine once the canvas has real dimensions, and re-creates it
  when the socket/room/epoch changes. `game.resize()` on window resize.
- Sets the mouse cursor per tool (crosshair / cell / text / default).

### `draw/Game.ts` — the drawing engine (the heart of the client)

State kept as a `Map<string, PersistedShape>` (`byId`) plus an array, so lookups,
upserts and deletions are O(1)/fast and always in sync:
- `upsertShape(shape)` — insert or in-place replace **by id** (this makes every local
  and remote event idempotent).
- `removeShapeById / removeShapesByIds` — delete + clear selection if needed.

**Initialization** (`init()`):
1. `await getExistingShapes(roomId)` → `GET /rooms/:slug/shapes` (filtered through
   `isValidShape` in `draw/http.ts`), upserted into state.
2. Sets `isInitialized = true` and draws. A later WS `joined_room` (if it ever arrives)
   is merged on top — nothing is lost and nothing is overwritten from a stale snapshot.

**WebSocket handling** (`initHandlers`): `joined_room` (members + shapes merge),
`user_joined`/`user_left` (presence pill), then `shape_add`, `shape_update`,
`shape_delete`, `shape_delete_many` — each guarded by `isInitialized` to avoid
processing messages before the HTTP preload finishes. **Legacy chat payloads** (old
clients that sent shapes through `chat`) are still parsed: `action: "erase"` and
`shape` blobs get ids and are merged (backwards compatibility).

**Tools**:

| Tool | Mouse-down → mouse-up |
|---|---|
| `rect` / `circle` / `diamond` / `pencil` | Drag to size; on mouse-up a `PersistedShape` with a fresh `id` (`newId()`) is upserted locally, drawn, and sent via `shape_add`. |
| `text` | Drag (any drag) then `window.prompt("Enter text:")`; a text shape (`fontSize: 20`) is created and sent. |
| `select` | Hit-test to pick the top-most shape (`hitTest`); drag moves it live (`translateShape` + continuous `shape_update` broadcasts); press **Delete/Backspace** to send `shape_delete`. A dashed blue box highlights the selection. |
| `eraser` | Drag a rectangle; `computeIntersectingIds` (bounding-box overlap per type, `pointNear` margin for text) collects hit shape ids, they are removed locally and sent as one `shape_delete_many`. This is **durable**: the server deletes the rows, so the strokes are really gone. |

**Rendering**: `clearCanvas` clears, paints the dark background, strokes every shape
(`drawShape`) and the selection box (`drawSelectionBox`); per-shape `try/catch` keeps a
bad shape from blanking the whole board.

---

## 7. Walkthrough: two people drawing together

Setup: `user-a` signs in → `/canvas/a-workspace`; `user-b` opens the shared link.

1. Both `RoomCanvas` components connect to `:8080` with their JWTs and send
   `join_room { roomId: "a-workspace" }`.
2. Each gets `joined_room` with `members` (and a preload of shapes over HTTP). The
   member pill shows **2 online**.
3. **user-a draws a rectangle**: `Game.mouseUpHandler` builds
   `{ type: "rect", id: "3f9c…", … }`, applies it locally, sends `shape_add`.
4. The ws-backend validates (`isValidShape`), persists to `room_shape`, then broadcasts
   `shape_add` to the room. **user-b's** `Game` upserts by id and redraws — the square
   appears within milliseconds, no polling.
5. **user-b erases it**: drags the eraser over the square → `computeIntersectingIds`
   returns the square's id → `shape_delete_many` → server deletes the row and broadcasts
   → **user-a** sees it disappear. It's also gone after a full page reload.
6. **user-a edits text** with `select`: hits the text shape, drags it (each mousemove
   sends `shape_update`), positions it, presses Delete to remove it.

### Multiple rooms don't interfere

- A socket only receives broadcasts for rooms in its `user.rooms`.
- A user who never joined `room-x` cannot send `shape_add/update/delete` there; the
  membership guard drops the message.
- HTTP `PATCH/DELETE` verify the shape belongs to the room in the URL, so a client can't
  mutate/destroy another room's shapes via REST either.

### What happens on reload / reconnect

- Page reload → fresh socket → `join_room` → `joined_room` + HTTP preload repopulate the
  board from PostgreSQL. Deterministic, ordered by `createdAt`.
- Transient drop → `RoomCanvas` reconnects (max 10 tries) and re-runs the same join, so
  members and shapes are refreshed.

---

## 8. Data model

| Table | Columns | Notes |
|---|---|---|
| `user` | `id` uuid PK, `email` unique, `password`, `name`, `createdAt`, `updatedAt` | |
| `room` | `id` serial PK, `slug` unique, `adminId` nullable FK, timestamps | slug is the public room identifier |
| `chat` | `id` uuid PK, `message`, `userId`, `roomId` FK, `createdAt` | |
| `room_shape` | `id` uuid PK, `roomId` FK, `userId` FK, `data` jsonb, timestamps | shape geometry lives in `data` |

The choice of JSONB for `data` means any new shape type is just new JSON — the schema
never changes.

---

## 9. Common issues & tips

- **Backend can't connect to DB** → check `DATABASE_URL` in the root `.env` and that
  Postgres is up; tables are auto-created by `synchronize: true`.
- **WS keeps closing / "Auth failed"** → the JWT is invalid or missing; sign in again so
  `localStorage.token` is refreshed.
- **Other users don't see your shapes** → confirm you're both in the *same slug* room
  and the ws-backend is running on `:8080`.
- **Shapes disappear permanently after erase** → that's the intended durable behavior.
- **Running the three apps** → `pnpm dev` handles all of them, or use
  `pnpm dev:http` / `pnpm dev:ws` / `pnpm dev:frontend` individually.

---

## 10. Command reference

```
pnpm install              # install workspace deps
pnpm build                # turbo: build all packages + apps
pnpm dev                  # turbo: run all dev servers
pnpm dev:http             # HTTP backend (:3008)
pnpm dev:ws               # WS backend (:8080)
pnpm dev:frontend         # Next.js (:3000)
pnpm test                 # turbo: unit + integration tests (Vitest)
pnpm test:unit            # unit only
pnpm test:integration     # integration only
pnpm lint                 # ESLint
pnpm check-types          # tsc --noEmit where configured
pnpm format               # Prettier
```