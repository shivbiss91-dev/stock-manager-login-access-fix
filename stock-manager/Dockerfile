# ==============================================================================
# StockVista Dockerfile
# Base image: Node.js 22 Alpine (Lightweight & includes native node:sqlite)
# ==============================================================================
FROM node:22-alpine

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install clean production dependencies
RUN npm ci

# Copy application source files
COPY . .

# Build the production frontend into /app/dist
RUN npm run build

# Create persistent storage folder for SQLite database
RUN mkdir -p /app/data

# Environment settings
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Expose unified application and API port
EXPOSE 3001

# Start the Node.js SQLite server
CMD ["node", "server.js"]
