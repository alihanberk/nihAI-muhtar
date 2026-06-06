.PHONY: help build run test clean docker-up docker-down migrate

# Ensure homebrew Go (Apple Silicon / Intel) is always on PATH
export PATH := /opt/homebrew/bin:/usr/local/go/bin:$(HOME)/go/bin:$(PATH)

# Load .env file and export all variables so Make targets can use them
ifneq (,$(wildcard .env))
  include .env
  export
endif

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	@echo "Building..."
	@go build -o bin/server ./cmd/server

run: ## Run the application
	@echo "Running server..."
	@go run ./cmd/server/main.go

test: ## Run tests
	@echo "Running tests..."
	@go test -v ./...

test-cover: ## Run tests with coverage
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html

docker-up: ## Start Docker services
	@echo "Starting Docker services..."
	@cd .. && docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5

docker-down: ## Stop Docker services
	@echo "Stopping Docker services..."
	@cd .. && docker-compose down

docker-logs: ## Show Docker logs
	@cd .. && docker-compose logs -f

migrate-up: ## Run database migrations up
	@echo "Running migrations up..."
	@migrate -path migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable" up

migrate-down: ## Rollback database migrations
	@echo "Rolling back migrations..."
	@migrate -path migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable" down 1

migrate-force: ## Force migration version (usage: make migrate-force VERSION=1)
	@migrate -path migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable" force $(VERSION)

migrate-create: ## Create new migration (usage: make migrate-create NAME=create_something)
	@migrate create -ext sql -dir migrations -seq $(NAME)

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download
	@go mod tidy

lint: ## Run linter
	@echo "Running linter..."
	@golangci-lint run || echo "golangci-lint not installed. Run: brew install golangci-lint"

dev: docker-up ## Start development environment
	@echo "Starting development environment..."
	@sleep 3
	@make run
