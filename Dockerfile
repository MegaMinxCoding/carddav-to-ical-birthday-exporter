FROM node:24-alpine

WORKDIR /usr/src/app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Run as unprivileged user
USER node

EXPOSE 3000

CMD ["node", "server.js"]
