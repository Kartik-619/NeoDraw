Y COLLABORATIVE WHITEBOARD — AGENT RULES SUMMARY

PROJECT:
- pnpm monorepo using pnpm 9, Node >=18, Turbo, TypeScript.
- Real-time multi-user collaborative drawing platform.
- Apps:
  - /http-backend → REST API
  - /ws-backend → WebSocket/collaboration server
  - /neodraw-frontend → Next.js frontend
- Architecture: Event-Driven + SOLID + Clean Architecture.

ARCHITECTURE:
- SOLID is mandatory:
  - SRP: one class = one responsibility.
  - OCP: extend without modifying existing core behavior.
  - LSP: implementations must respect interfaces.
  - ISP: use small focused interfaces.
  - DIP: depend on abstractions, not concrete classes.
- Clean Architecture layers:
  - Domain → entities + business rules; no external dependencies.
  - Application → use cases, orchestration, interfaces.
  - Infrastructure → DB, Redis/RabbitMQ, WebSocket, HTTP, EventBus.
  - Presentation → controllers, handlers, DTOs.
- Use Dependency Injection.
- Use strict TypeScript.
- Avoid God classes, circular dependencies, giant interfaces, `any`, and direct concrete dependencies.

EVENT-DRIVEN ARCHITECTURE:
- All cross-service communication MUST use the Event Bus.
- HTTP Backend → emits event → Event Bus → WebSocket Backend → broadcasts → Frontend.
- NEVER make direct HTTP calls between services.
- NEVER hardcode service URLs.
- WebSocket updates must be event-driven, not polling.
- Event payloads must include the defined structure and events must be handled asynchronously.
- Important events include:
  BOARD_CREATED, BOARD_UPDATED, BOARD_DELETED,
  SHAPE_ADDED, SHAPE_UPDATED, SHAPE_DELETED,
  SHAPE_SELECTED, SHAPE_MOVED,
  DRAWING_STARTED, DRAWING_IN_PROGRESS, DRAWING_ENDED,
  USER_JOINED, USER_LEFT, USER_CURSOR_MOVED,
  ROOM_JOINED, ROOM_LEFT.

MONOREPO STRUCTURE:
y/
├── apps/
│   ├── http-backend/
│   │   └── src/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       └── api/
│   ├── ws-backend/
│   │   └── src/
│   │       ├── domain/
│   │       ├── application/
│   │       └── infrastructure/
│   └── neodraw-frontend/
│       └── src/
│           ├── app/
│           ├── components/
│           │   ├── canvas/
│           │   ├── toolbar/
│           │   └── ui/
│           ├── hooks/
│           ├── services/
│           │   ├── api/
│           │   └── websocket/
│           ├── store/
│           ├── types/
│           └── utils/
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   └── event-schema/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json

CODING RULES:
- Use classes with clear responsibilities where applicable.
- Use constructor-based dependency injection.
- Use explicit types everywhere.
- Use specific contextual errors instead of generic `Error`.
- Keep imports ordered:
  1. External dependencies
  2. Domain
  3. Application
  4. Infrastructure
- Don't use procedural/poorly structured business logic.
- Don't use `any` unless absolutely necessary.

DESIGN PATTERNS:
- Repository → abstract database/data persistence.
- Event Bus → all cross-service communication.
- Observer → WebSocket broadcasting/subscriptions.
- Factory → complex object creation such as shapes/boards.
- Dependency Injection → all services.
- Command → WebSocket/user actions; don't process raw messages directly.

DATA/PERSISTENCE:
- Services must access persistence through repositories.
- Controllers must not access databases directly.
- No raw SQL inside services.
- Do not bypass repository abstractions.

REAL-TIME:
- WebSocket state belongs in the WebSocket backend, not HTTP backend.
- Do not use polling.
- Private events must only reach authorized users/rooms.
- Use Event Bus → WebSocket broadcasting for real-time collaboration.

FRONTEND:
- Next.js frontend lives in `/apps/neodraw-frontend`.
- Use the existing structure:
  app/ → pages/routes
  components/ → canvas/toolbar/ui
  hooks/ → reusable React logic
  services/ → API/WebSocket clients
  store/ → client state
  types/ → TypeScript types
  utils/ → utilities
- Keep frontend separated from backend domain logic.
- Follow the existing architecture rather than inventing new structures.

CRITICAL RULES:
- NEVER bypass the Event Bus.
- NEVER create direct HTTP communication between services.
- NEVER hardcode service URLs.
- NEVER create circular dependencies.
- NEVER violate Clean Architecture boundaries.
- NEVER modify existing interfaces unnecessarily.
- NEVER create God classes.
- NEVER bypass repositories.
- NEVER put database access in controllers/services directly.
- NEVER use polling for real-time collaboration.
- NEVER store WebSocket state in the HTTP backend.
- NEVER broadcast private events publicly.

BEFORE MAKING CHANGES:
1. Read agent.md completely.
2. Understand the entire monorepo.
3. Identify exactly which app/package is being modified.
4. Inspect existing implementations and patterns.
5. Consider downstream effects.
6. Follow existing architecture.
7. Avoid unnecessary refactors.

WHEN WRITING CODE:
- Follow SOLID.
- Use Dependency Injection.
- Use Event Bus for cross-service communication.
- Use strict TypeScript.
- Follow Clean Architecture.
- Keep responsibilities separated.
- Add tests for public/domain behavior.

TESTING:
- Unit tests → domain logic.
- Integration tests → services.
- E2E tests → critical user flows.
- Test Event Bus emissions and handlers.
- Preserve existing functionality and contracts.

COMMON COMMANDS:
pnpm install
pnpm dev
pnpm dev:http
pnpm dev:ws
pnpm dev:frontend
pnpm build
pnpm build:http
pnpm build:ws
pnpm build:frontend
pnpm test
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm format
pnpm check-types

CORE PRINCIPLE:
The monorepo must remain modular, strongly typed, dependency-injected, event-driven, and cleanly separated by architectural layers. Domain logic stays independent, persistence is abstracted through repositories, services communicate through the Event Bus, and real-time collaboration flows through the WebSocket backend.