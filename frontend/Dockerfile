# Campus Hub student site: one Dockerfile, two ways to run (Step 19.1, frontend DOCS.md §19).
#
#   make up    → the last stage, `runner`: production. `next build` once, then the small standalone server.
#   make dev   → the `dev` stage (docker-compose.dev.yml picks it): `next dev` with hot reload on the mounted source.
#
# Stages (each starts from the same base; Docker only rebuilds the ones whose inputs changed):
#   base → deps → dev
#             └→ builder → runner

# ---------------------------------------------------------------------------------------------------------------
# base: Node 22 LTS on Alpine (small). Pinned to a major version: a new Node major is a deliberate upgrade.
FROM node:22-alpine AS base
WORKDIR /app
# Next.js collects anonymous usage data unless told not to; nothing leaves the containers.
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------------------------------------------
# deps: every dependency (dev ones too: the build needs TypeScript, Tailwind, PostCSS).
# Only the two package files are copied first, so this slow layer is reused until a dependency changes.
FROM base AS deps
# libc6-compat: some native packages (e.g. the SWC compiler) expect glibc names on Alpine's musl.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# `npm ci`, not `npm install`: installs exactly package-lock.json and fails if it doesn't match package.json,
# so every build gets the same versions.
RUN npm ci

# ---------------------------------------------------------------------------------------------------------------
# dev: what the old single-stage image did. The source is mounted from the host by docker-compose.dev.yml;
# the COPY below only matters if the dev image is ever run without the mount.
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------------------------------------------
# builder: compiles the production build. `next build` type-checks the code (a type error stops the image
# here, before it can run), bundles and minifies it, and with output: "standalone" (next.config.ts) writes
# .next/standalone: a tiny server.js plus only the node_modules files the app really uses.
FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------------------------------------------
# runner: what actually runs in production. No source code, no dev tools, no full node_modules: only the
# standalone server, the static assets and public/. About a tenth of the dev image.
FROM base AS runner
# HOSTNAME=0.0.0.0: listen on every interface of the container, so nginx (another container) can reach it.
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user: if the app were ever compromised, the attacker is not root in the container.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# public/ (logos, campus photo) and .next/static (hashed JS/CSS) are not part of standalone by design (a CDN
# usually serves them); copied next to server.js, the server serves them itself.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Docker marks the container unhealthy if the site stops answering. /privacy: a real page through the whole
# stack (layout, session, translations) that never calls Django, so a Django outage doesn't flag the frontend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/privacy').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Stopping cleanly. `docker compose down` sends SIGTERM to process 1, here node itself (`node server.js`, not
# `npm start`, which would sit in between and swallow the signal). Next.js installs its own SIGTERM handler: it
# stops accepting connections, lets open requests finish, then exits (measured: 0.14 s with no open connection).
# No init process (tini) is needed for that. Connections that stay open (browser tabs kept alive through nginx)
# are waited for until Docker's 10 s limit (DOCS.md §19, TEAM_NEEDS M11).
CMD ["node", "server.js"]
