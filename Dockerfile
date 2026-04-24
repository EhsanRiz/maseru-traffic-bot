FROM node:20-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
