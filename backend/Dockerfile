# Backend Dockerfile
FROM node:18-alpine AS builder

# Install required system dependencies
RUN apk add --no-cache \
    curl \
    gzip \
    python3 \
    make \
    g++ \
    ffmpeg

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend/ ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Download dictionary files at build time
RUN echo "Downloading kanjidic2.xml.gz..." && \
    curl -L -o /tmp/kanjidic2.xml.gz https://www.edrdg.org/kanjidic/kanjidic2.xml.gz && \
    gunzip /tmp/kanjidic2.xml.gz && \
    mv /tmp/kanjidic2.xml /app/kanjidic2.xml && \
    echo "Downloading JMdict_e.gz..." && \
    curl -L -o /tmp/JMdict_e.gz http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz && \
    gunzip /tmp/JMdict_e.gz && \
    mv /tmp/JMdict_e /app/JMdict_e && \
    echo "Dictionary files downloaded successfully"

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/kanjidic2.xml ./kanjidic2.xml
COPY --from=builder /app/JMdict_e ./JMdict_e

# Create uploads and debug-audio directories
RUN mkdir -p /app/uploads/pronunciations /app/debug-audio

# Expose backend port
EXPOSE 3001

# Start the backend server
CMD ["node", "dist/index.js"]

