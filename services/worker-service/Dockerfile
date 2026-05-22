FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY src ./src
EXPOSE 3003
CMD ["node", "src/index.js"]
