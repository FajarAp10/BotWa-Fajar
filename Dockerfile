# Gunakan image Node.js resmi yang ringan
FROM node:20-alpine

# Buat folder kerja
WORKDIR /app

# Salin semua file dari repo ke folder kerja di container
COPY . .

# Install semua dependencies dari package.json
RUN npm install

# Jalankan bot (ganti index.js jika nama file utama berbeda)
CMD ["node", "index.js"]
