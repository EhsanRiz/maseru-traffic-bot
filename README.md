# 🌉 Maseru Bridge Traffic Bot

An AI-powered chatbot that analyzes live camera feeds from the Maseru Bridge border crossing between Lesotho and South Africa, providing real-time traffic information to travelers.

## Features

- **Live Camera Capture**: Uses Puppeteer to capture frames from the ETL Webcast camera feed
- **AI Vision Analysis**: Claude analyzes images to assess traffic conditions, queue lengths, and wait times
- **Conversational Interface**: Natural language chat for asking specific questions about the border
- **Auto-refresh**: Periodic capture and caching for fast responses
- **Mobile-friendly**: Responsive design works on phones and desktops

## Prerequisites

- Node.js 18 or higher
- An Anthropic API key ([get one here](https://console.anthropic.com/))
- Access to the ETL Webcast (may require Econet internet in Lesotho)

## Quick Start

### 1. Clone and Install

```bash
cd maseru-traffic-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-api...
```

### 3. Run the Server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

### 4. Open in Browser

Navigate to `http://localhost:3000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Chat interface |
| `/api/status` | GET | Get current traffic analysis |
| `/api/chat` | POST | Send a question, get AI response |
| `/api/screenshot` | GET | Get latest camera image (PNG) |
| `/api/health` | GET | Server health check |

### Example API Usage

```bash
# Get current traffic status
curl http://localhost:3000/api/status

# Ask a specific question
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Are there any trucks in the queue?"}'
```

## Deployment Options

### Option 1: VPS/Cloud Server (Recommended)

Deploy to a Linux VPS (DigitalOcean, Linode, Vultr, etc.):

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium dependencies for Puppeteer
sudo apt-get install -y \
  ca-certificates fonts-liberation libappindicator3-1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
  libdbus-1-3 libdrm2 libgbm1 libnspr4 libnss3 \
  libxcomposite1 libxdamage1 libxrandr2 xdg-utils

# Clone and setup
git clone <your-repo> maseru-traffic-bot
cd maseru-traffic-bot
npm install
cp .env.example .env
# Edit .env with your API key

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name maseru-bot
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t maseru-bot .
docker run -d -p 3000:3000 -e ANTHROPIC_API_KEY=your-key maseru-bot
```

### Option 3: Railway/Render (Easy)

These platforms support Puppeteer out of the box:

1. Push code to GitHub
2. Connect to Railway or Render
3. Add `ANTHROPIC_API_KEY` as environment variable
4. Deploy

## WhatsApp Integration (Future)

To add WhatsApp support, you can integrate with:

- **Twilio WhatsApp API**: Add a webhook endpoint that receives WhatsApp messages
- **WhatsApp Business API**: For official business integration
- **Baileys** (unofficial): Open-source WhatsApp Web API

Example webhook for Twilio:

```javascript
app.post('/webhook/whatsapp', async (req, res) => {
  const { Body: message, From: sender } = req.body;
  
  const screenshot = await captureScreenshot();
  const analysis = await analyzeTraffic(screenshot, message);
  
  // Send response via Twilio
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(analysis.message);
  res.type('text/xml').send(twiml.toString());
});
```

## Troubleshooting

### "Browser failed to load camera feed"

- The ETL Webcast may require Econet internet access
- Try accessing the URL directly in a browser first
- Check if the camera service is operational

### "ANTHROPIC_API_KEY environment variable is required"

- Make sure you've set the environment variable
- Check your `.env` file exists and has the correct key

### Puppeteer crashes on Linux

Install the required dependencies:
```bash
sudo apt-get install -y libgbm-dev
```

## Cost Considerations

- **Anthropic API**: Each image analysis uses ~1,000-2,000 tokens
- With caching (30-second cache), expect ~120 API calls/hour with constant use
- Realistic usage: ~10-50 API calls/day
- Estimated cost: < $1/day for typical usage

## Credits

- Camera feeds provided by [Econet Telecom Lesotho](https://webcast.etl.co.ls)
- AI analysis powered by [Anthropic Claude](https://anthropic.com)
- Built by [4D Climate Solutions](https://4dcs.co.za)

## License

MIT License - feel free to use and modify for your needs.
