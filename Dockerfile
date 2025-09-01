FROM node:20-slim

# Install dependency ringan (untuk build text-to-image, sharp, dsb)
RUN apt-get update && apt-get install -y \
    libvips-dev build-essential python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
