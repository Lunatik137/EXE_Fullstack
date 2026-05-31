FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create uploads directory for images
RUN mkdir -p uploads

# Expose backend port
EXPOSE 4000

CMD ["node", "server.js"]