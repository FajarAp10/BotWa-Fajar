FROM node:20

# Install system dependencies for sharp
RUN apt-get update && apt-get install -y \
  libvips-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# Reinstall sharp sesuai OS
RUN npm install --platform=linux --arch=x64 sharp

# Install other dependencies
RUN npm install

CMD ["node", "index.js"]
