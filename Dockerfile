# syntax=docker/dockerfile:1

FROM oven/bun:1.3.0 AS web-builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY build.ts bunfig.toml components.json eslint.config.js index.html tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN bun run build

FROM rust:1-bookworm AS api-builder
WORKDIR /app/api

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY api/Cargo.toml api/Cargo.lock ./
COPY api/migrations ./migrations
COPY api/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=api-builder /app/api/target/release/hospitalinator-api /usr/local/bin/hospitalinator-api
COPY --from=web-builder /app/dist ./public

ENV API_HOST=0.0.0.0 \
    API_PORT=4000 \
    DATABASE_URL=sqlite:///data/hospitalinator.sqlite \
    FILE_STORAGE_DIR=/data/documents \
    WEB_DIST_DIR=/app/public \
    RUST_LOG=hospitalinator_api=info,tower_http=info

VOLUME ["/data"]
EXPOSE 4000

CMD ["hospitalinator-api"]
