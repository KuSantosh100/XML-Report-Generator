# SQA Report Studio Backend Container
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure generated_reports directory exists
RUN mkdir -p public/generated_reports

# Expose backend API port
EXPOSE 1500

# Environment variables
ENV NODE_ENV=production
ENV PORT=1500

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:1500/api/health || exit 1

# Start the API server
CMD ["node", "server.js"]
