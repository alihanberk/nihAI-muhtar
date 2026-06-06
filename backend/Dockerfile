FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

FROM migrate/migrate:v4.19.1 AS migrate

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
COPY --from=migrate /usr/local/bin/migrate /usr/local/bin/migrate
COPY scripts/start.sh ./start.sh

RUN chmod +x ./start.sh

EXPOSE 8080

CMD ["./start.sh"]
