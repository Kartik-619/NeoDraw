# NeoDraw

A real-time collaborative whiteboard platform where users can draw together on shared canvases with live synchronization.

## Features

- **Real-time Collaboration** — Multiple users can draw simultaneously on the same board with live updates via WebSocket
- **Drawing Tools** — Rectangle, circle, diamond, pencil/freehand, line, eraser, and text
- **Room System** — Create, join, and manage collaborative drawing rooms
- **User Authentication** — JWT-based signup/signin with secure sessions
- **Shape Management** — Add, update, delete, and bulk delete shapes
- **Selection & History** — Multi-select shapes with undo/redo support
- **Zoom & Pan** — Navigate the canvas with mouse wheel zoom and pan controls
- **View-Only Mode** — Share boards with read-only access
- **Export** — Export your drawings as PNG or SVG
- **Chat** — Built-in chat for room participants
- **Sharing** — Generate shareable links with permission controls
- **Dark Theme** — Neon-styled dark UI with Tailwind CSS

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Strict type safety across the entire codebase |
| Next.js 15 | Frontend framework with App Router |
| React 19 | UI components |
| Tailwind CSS | Styling with neon brand theme |
| Express 5 | REST API backend |
| WebSocket (ws) | Real-time communication |
| TypeORM | Database ORM |
| PostgreSQL | Persistent data storage |
| Zod | Request validation |
| JWT + bcrypt | Authentication & password hashing |
| pnpm | Package manager |
| Turborepo | Monorepo task orchestration |
| Vitest | Unit, integration, and WebSocket tests |
| Playwright | End-to-end testing |

## Project Structure

```
NeoDraw/
├── apps/
│   ├── http-backend/          # Express REST API + WebSocket server
│   │   └── src/
│   │       ├── app.ts         # Route definitions
│   │       ├── application/   # Business logic, repositories, DI container
│   │       ├── infrastructure/# TypeORM adapters, WebSocket server
│   │       └── middleware.ts  # JWT authentication guard
│   └── neodraw-frontend/      # Next.js frontend application
│       └── src/
│           ├── app/           # Pages (signin, signup, dashboard, canvas)
│           ├── components/    # UI components
│           ├── draw/          # Canvas engine (Game.ts, History.ts)
│           ├── lib/           # Config, JWT utilities
│           └── hooks/         # React hooks
├── packages/
│   ├── shared-types/          # Wire contract types and validators
│   ├── db/                    # TypeORM entities and data source
│   ├── common/                # Zod validation schemas
│   └── backand-common/        # JWT secret and env utilities
├── tests/                     # Unit, integration, WebSocket, and E2E tests
└── scripts/
    └── start.mjs              # Production startup script
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 9
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/NeoDraw.git
cd NeoDraw

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/neodraw

# JWT secret for authentication
JWT_SECRET=your-secret-key

# Frontend URL (for CORS)
FRONTEND_ORIGIN=http://localhost:3000
```

Create a `.env` file in `apps/neodraw-frontend/`:

```env
# Backend API URL
NEXT_PUBLIC_HTTP_BACKEND=http://localhost:3008

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:3008
```

### Running the Project

```bash
# Start all services in development mode
pnpm dev

# Or start individually
pnpm dev:http      # Backend only (port 3008)
pnpm dev:frontend  # Frontend only (port 3000)
```

### Building for Production

```bash
# Build all packages
pnpm build

# Start production server
pnpm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Create a new user account |
| POST | `/signIn` | Sign in with email/password |
| GET | `/user/me` | Get current user profile |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/room` | Create a new room |
| GET | `/rooms` | List all rooms for current user |
| GET | `/rooms/:slug` | Get room details by slug |

### Shapes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/shape/:roomId` | Add a shape to a room |
| PUT | `/shape/:roomId/:shapeId` | Update a shape |
| DELETE | `/shape/:roomId/:shapeId` | Delete a shape |
| POST | `/shape/:roomId/bulk-delete` | Bulk delete shapes |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/:roomId` | Send a message |
| GET | `/chat/:roomId` | Get chat history |

## WebSocket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `join_room` | Join a room for real-time updates |
| `leave_room` | Leave a room |
| `chat` | Send a chat message |
| `shape_add` | Add a new shape |
| `shape_update` | Update an existing shape |
| `shape_delete` | Delete a shape |
| `shape_delete_many` | Bulk delete shapes |

### Server → Client
| Event | Description |
|-------|-------------|
| `room_joined` | Successfully joined a room |
| `user_joined` | A user joined the room |
| `user_left` | A user left the room |
| `shape_added` | A shape was added |
| `shape_updated` | A shape was updated |
| `shape_deleted` | A shape was deleted |
| `chat_message` | A chat message was received |

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit          # Unit tests
pnpm test:integration   # Integration tests

# Or from the tests package
pnpm --filter ny-tests test:ws         # WebSocket tests
pnpm --filter ny-tests test:load       # Load tests
pnpm --filter ny-tests test:security   # Security tests
pnpm --filter ny-tests test:frontend   # Frontend component tests
pnpm --filter ny-tests test:e2e        # Playwright E2E tests
```

## Code Quality

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check all packages
pnpm check-types
```

## Architecture

NeoDraw follows **Clean Architecture** principles with **Dependency Injection**:

- **Domain Layer** — Entities and business rules (no external dependencies)
- **Application Layer** — Use cases, repository interfaces, DI container
- **Infrastructure Layer** — TypeORM adapters, WebSocket server, external services
- **Presentation Layer** — Express routes, middleware, controllers

The **shared-types** package serves as the single source of truth for the wire contract between frontend and backend, with runtime validators ensuring type safety.

### Real-time Sync

- WebSocket connection established with JWT authentication
- Changes persist to PostgreSQL before broadcasting to ensure consistency
- Room-based isolation ensures users only receive updates for their active room
- Client-generated UUIDs make operations idempotent

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow SOLID principles
- Use dependency injection for all services
- Write tests for new features
- Run `pnpm lint` and `pnpm check-types` before committing
- Keep imports ordered: External → Domain → Application → Infrastructure

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
