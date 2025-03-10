#!/bin/bash

# Enable buildx
docker buildx create --use

# Build and push frontend image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t talhaelmali/test-next-frontend:latest \
  -f Dockerfile.client \
  --push \
  .

# Build and push backend image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t talhaelmali/test-next-backend:latest \
  -f Dockerfile.server \
  --push \
  .