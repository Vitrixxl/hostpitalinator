# Project Instructions

## Docker

- Keep Docker Compose compatible with `cdynator` deployments.
- Do not hardcode a public host port in `docker-compose.yml`; publish the app on localhost with the port provided by `CDYNATOR_PORT`.
- The application listens on port `4000` inside the container, so the Compose port mapping should use:

```yaml
ports:
  - "127.0.0.1:${CDYNATOR_PORT}:4000"
```

- Caddy is responsible for public traffic and routes the project subdomain to `127.0.0.1:${CDYNATOR_PORT}`.
- Keep persistent application data in Docker volumes or explicit data mounts; do not store runtime data only inside the container filesystem.
