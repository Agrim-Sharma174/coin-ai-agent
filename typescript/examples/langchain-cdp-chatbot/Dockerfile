# Use Node.js 18 Alpine base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for TypeScript)
RUN npm install

# Copy all project files
COPY . .

# Set environment variables
ENV NODE_OPTIONS=--no-warnings

# Command to run the application
CMD ["npm", "run", "start"]
