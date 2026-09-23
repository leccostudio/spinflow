FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npx prisma generate
RUN npm run build
COPY --from=web-build /app/web/dist ./web/dist

EXPOSE 3333
VOLUME ["/app/data"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
