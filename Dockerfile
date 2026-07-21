# Build stage
FROM node:24-alpine AS builder

# Install build dependencies for native modules (like better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install OpenSSL (required for Prisma) and su-exec for permissions
RUN apk add --no-cache openssl python3 make g++ su-exec

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# Install prisma CLI and its dependencies for migrations
# We use npm install to ensure all transitive dependencies (like valibot, dotenv) are present
RUN npm install prisma@7.9.0 @prisma/client@7.9.0 --no-save && \
    npm rebuild better-sqlite3 && \
    chown -R nextjs:nodejs /app/node_modules

# Copy startup script
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

# Create database directory
RUN mkdir -p /app/prisma/data && chown -R nextjs:nodejs /app/prisma/data

# USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./start.sh"]
