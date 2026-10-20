# SQA Report Studio Container
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

# Expose web port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV WEB_PORT=3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the web server
CMD ["node", "server.js"]
