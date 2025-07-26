# Ganti base image ke Debian-based, bukan Alpine
FROM node:20

# Buat direktori kerja
WORKDIR /app

# Copy semua file
COPY . .

# Install dependencies sistem dulu (wajib buat sharp)
RUN apt-get update && apt-get install -y \
  libvips-dev \
  && rm -rf /var/lib/apt/lists/*

# Install node_modules
RUN npm install

# Jalankan bot
CMD ["node", "index.js"]
