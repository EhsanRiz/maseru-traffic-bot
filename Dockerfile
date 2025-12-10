FROM ghcr.io/puppeteer/puppeteer:23.4.0

WORKDIR /app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm ci --only=production

COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
