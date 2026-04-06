#!/bin/bash
set -euo pipefail

APP_DIR="/opt/viwo"
cd "$APP_DIR"

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Building and starting services ==="
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "=== Waiting for services to be healthy ==="
sleep 10

echo "=== Health check ==="
for i in {1..10}; do
  if curl -sf http://127.0.0.1:8080/health > /dev/null 2>&1; then
    echo "Backend is healthy!"
    break
  fi
  echo "Waiting for backend... ($i/10)"
  sleep 3
done

curl -sf http://127.0.0.1:8080/health || { echo "ERROR: Backend health check failed"; exit 1; }

echo "=== Cleaning up old images ==="
docker image prune -f

echo "=== Deploy complete ==="
