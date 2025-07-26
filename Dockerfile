FROM node:20-slim

# Install lib yang dibutuhkan sharp (kalau pakai)
RUN apt-get update && apt-get install -y \
    libvips-dev build-essential python3

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"]
