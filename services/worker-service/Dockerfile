FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN node --check src/index.js

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/src ./src
USER node
EXPOSE 3003
CMD ["node", "src/index.js"]
