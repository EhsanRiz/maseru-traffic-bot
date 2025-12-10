FROM ghcr.io/puppeteer/puppeteer:23.4.0

USER root
WORKDIR /app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm install --only=production

COPY . .

RUN chown -R pptruser:pptruser /app
USER pptruser

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
