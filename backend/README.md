# Backend - Nihai Muhtar

Go backend service for AI-driven urban solutions platform.

## Architecture

This backend follows Clean Architecture principles inspired by masterfabric-go:

```
backend/
├── cmd/server/           # Application entry point
├── internal/
│   ├── domain/           # Business entities & logic
│   │   ├── user/         # User domain
│   │   ├── detection/    # Detection domain (AI results)
│   │   └── report/       # Report domain
│   ├── application/      # Use cases & DTOs
│   │   ├── usecases/     # Business use cases
│   │   └── dtos/         # Data transfer objects
│   ├── infrastructure/   # External implementations
│   │   ├── postgres/     # Database implementation
│   │   ├── redis/        # Cache implementation
│   │   ├── http/         # HTTP handlers
│   │   └── ai/           # AI service integration
│   └── shared/           # Cross-cutting concerns
│       ├── config/       # Configuration
│       ├── middleware/   # HTTP middleware
│       ├── errors/       # Error handling
│       └── events/       # Event bus
└── scripts/              # Utility scripts
```

## Quick Start

### Prerequisites

- Go 1.22+
- Docker & Docker Compose

### Installation

```bash
# Copy environment file
cp .env.example .env

# Start infrastructure (PostgreSQL, Redis, Kafka)
make docker-up

# Download dependencies
make deps

# Run the server
make run
```

The server will start on `http://localhost:8080`

### Verify

```bash
# Health check
curl http://localhost:8080/health/live
# {"status":"alive"}

curl http://localhost:8080/health/ready
# {"status":"ready","services":{"postgres":"healthy","redis":"healthy"}}
```

## API Endpoints

### Health
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login

### Detections
- `POST /api/v1/detections` - Create new detection
- `GET /api/v1/detections` - List detections
- `GET /api/v1/detections/{id}` - Get detection by ID

### Reports
- `POST /api/v1/reports` - Create new report
- `GET /api/v1/reports` - List reports
- `GET /api/v1/reports/{id}` - Get report by ID

## Development

```bash
# Run with hot-reload (requires air)
air

# Run tests
make test

# Run tests with coverage
make test-cover

# Run linter
make lint

# View logs
make docker-logs
```

## Configuration

All configuration is via environment variables. See `.env.example` for available options.

## Tech Stack

- **Framework**: Chi (HTTP router)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Message Queue**: Apache Kafka
- **Auth**: JWT
- **Logging**: slog (structured JSON)

## License

MIT
