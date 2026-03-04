# Stage 1: Build React app
FROM node:20.18.3-alpine3.21 AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for API Key
ARG VITE_API_KEY
ENV VITE_API_KEY=${VITE_API_KEY}

# Build the application
RUN npm run build

# Stage 2: Production image with Nginx
# nginx:1.27-alpine worker processes run as non-root (nginx user) by default
FROM nginx:1.27-alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template to official envsubst template directory.
# The default nginx entrypoint will render this into /etc/nginx/conf.d/default.conf.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Expose port
EXPOSE 8080
