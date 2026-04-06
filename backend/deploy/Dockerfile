FROM golang:1.23-alpine AS builder
RUN apk add --no-cache ca-certificates git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /mini-coupon ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /mini-coupon /usr/local/bin/mini-coupon
RUN mkdir -p /app/keys
WORKDIR /app
EXPOSE 8080
CMD ["mini-coupon"]
