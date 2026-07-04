# --- Stage 1: Build & Dependencies ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# --- Stage 2: Production Runner ---
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
USER node

# Copy dependencies and application source
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

# Expose port
EXPOSE 5000

# Run the app
CMD ["node", "src/index.js"]
