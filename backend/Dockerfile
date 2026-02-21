FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including nodemon for dev)
RUN npm ci

# Copy source code
COPY . .

# Create uploads directory for images
RUN mkdir -p uploads

# Expose backend port
EXPOSE 4000

# Start server with nodemon for hot reload
CMD ["npm", "run", "server"]