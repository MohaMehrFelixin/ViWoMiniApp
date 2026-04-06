.PHONY: build test run-dev docker-up docker-down migrate-up lint

build:
	go build -o bin/mini-coupon ./cmd/server

test:
	go test ./... -v -count=1

lint:
	golangci-lint run ./...

run-dev:
	go run ./cmd/server

docker-up:
	cd deploy && docker compose up -d postgres redis

docker-down:
	cd deploy && docker compose down

docker-all:
	cd deploy && docker compose up --build

migrate-up:
	psql "postgresql://viwo:viwo@localhost:5432/viwo_coupon?sslmode=disable" -f migrations/001_create_coupon_system.sql

deploy:
	cd deploy/terraform && terraform apply -auto-approve
