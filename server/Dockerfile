FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
# generate only needs a syntactically valid URL, not a live database
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
