# FundRail web app — multi-stage build.
#
#   docker build -t fundrail-web .
#   docker run -p 5173:5173 fundrail-web
#
# The app reads its Convex deployment URL at build time; pass it as a build arg
# (or rely on VITE_CONVEX_URL from a .env file copied into the build context):
#
#   docker build --build-arg VITE_CONVEX_URL=https://your-deployment.convex.cloud .

# --- Build stage -----------------------------------------------------------
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Convex client URL is inlined by Vite at build time.
ARG VITE_CONVEX_URL=
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

RUN bun tsc -b --noEmit && bun run build

# --- Runtime stage ---------------------------------------------------------
FROM oven/bun:1-slim AS runtime

WORKDIR /app

# Only the built assets and the preview server are needed at runtime.
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4173

CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
