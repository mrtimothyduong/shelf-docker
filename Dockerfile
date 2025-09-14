FROM node:18-alpine

# Install build dependencies for native packages (like Sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S shelf -u 1001 -G nodejs

# Copy application code
COPY src/ ./src/
COPY public/ ./public/
COPY views/ ./views/
COPY scripts/ ./scripts/

# Create necessary directories
RUN mkdir -p public/images/{records,board-games,books} && \
    chown -R shelf:nodejs /app

# Switch to non-root user
USER shelf

# Expose port
EXPOSE 3008

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3008/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/app.js"]