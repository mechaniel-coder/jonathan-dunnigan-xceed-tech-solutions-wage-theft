FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install --omit=dev

# Create user before copying source so this layer is cached
RUN addgroup -S botgroup && adduser -S botuser -G botgroup \
    && mkdir -p /app/logs

# Copy source code
COPY . .

# Fix ownership after copy
RUN chown -R botuser:botgroup /app
USER botuser

EXPOSE 3002

CMD ["node", "src/index.js"]
