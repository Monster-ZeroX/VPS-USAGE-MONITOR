FROM node:20-alpine AS base

# Production image - simpler build for low-memory systems
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files and install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Build with reduced memory usage
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
