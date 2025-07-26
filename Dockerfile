FROM node:18-slim

# Install dependencies untuk sharp
RUN apt-get update && apt-get install -y \
    libvips-dev build-essential python3

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"]
