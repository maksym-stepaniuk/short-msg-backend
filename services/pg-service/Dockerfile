FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
COPY knex ./knex
COPY knexfile.js ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/knex ./knex
COPY --from=builder --chown=node:node /app/knexfile.js ./knexfile.js
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run knex:migrate && npm run knex:seed && node dist/index.js"]
