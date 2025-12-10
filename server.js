import express from 'express';
import puppeteer from 'puppeteer';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  port: process.env.PORT || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  cameraUrl: 'https://webcast.etl.co.ls/m/SEHq7e82/maseru-bridge?list=NOdbTdaJ',
  captureInterval: 60000, // Capture every 60 seconds
  cacheTimeout: 30000, // Cache analysis for 30 seconds
};

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// Global state
let browser = null;
let page = null;
let latestScreenshot = null;
let latestAnalysis = null;
let lastAnalysisTime = 0;
let isCapturing = false;

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Puppeteer browser
async function initBrowser() {
  console.log('🚀 Launching browser...');
  
  browser = await puppeteer.launch({
    headless: 'new',
       args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('📷 Navigating to camera feed...');
  
  try {
    await page.goto(config.cameraUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    // Wait for video/content to load
    await page.waitForTimeout(5000);
    
    console.log('✅ Camera feed loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load camera feed:', error.message);
    return false;
  }
}

// Capture screenshot from the camera feed
async function captureScreenshot() {
  if (!page || isCapturing) {
    return latestScreenshot;
  }

  isCapturing = true;
  
  try {
    // Refresh if page has been idle too long
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Capture the main video area (top-left quadrant based on the layout)
    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 50,
        width: 700,
        height: 450,
      },
    });
    
    latestScreenshot = screenshot;
    console.log(`📸 Screenshot captured at ${new Date().toISOString()}`);
    
    return screenshot;
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error.message);
    
    // Try to reinitialize browser
    try {
      await browser?.close();
      await initBrowser();
    } catch (reinitError) {
      console.error('❌ Browser reinitialization failed:', reinitError.message);
    }
    
    return latestScreenshot;
  } finally {
    isCapturing = false;
  }
}

// Analyze traffic using Claude Vision
async function analyzeTraffic(screenshot, userQuestion = null) {
  if (!screenshot) {
    return {
      success: false,
      message: "No camera feed available. Please try again in a moment.",
    };
  }

  // Check cache (unless there's a specific user question)
  const now = Date.now();
  if (!userQuestion && latestAnalysis && (now - lastAnalysisTime) < config.cacheTimeout) {
    return latestAnalysis;
  }

  try {
    const base64Image = screenshot.toString('base64');
    
    const systemPrompt = `You are a helpful traffic analysis assistant for the Maseru Bridge border crossing between Lesotho and South Africa. 

Your job is to analyze camera feed images and provide clear, practical information about:
- Current traffic conditions (light, moderate, heavy, gridlocked)
- Estimated queue length (number of vehicles visible)
- Wait time estimates based on queue length
- Any notable observations (accidents, road work, weather conditions affecting visibility)
- Best advice for travelers

Be conversational, friendly, and practical. If it's nighttime and visibility is limited, mention that. 
If you can't see clearly, be honest about it.

Keep responses concise but informative. Use local context - people crossing here are typically going between Maseru (Lesotho) and Ladybrand/Bloemfontein (South Africa).`;

    const userPrompt = userQuestion 
      ? `Looking at this camera feed from Maseru Bridge border crossing, please answer this question: ${userQuestion}`
      : `Analyze this camera feed from Maseru Bridge border crossing. Describe the current traffic conditions, estimated queue length, and provide advice for travelers.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const analysis = {
      success: true,
      message: response.content[0].text,
      timestamp: new Date().toISOString(),
    };

    // Cache the result (only for general queries)
    if (!userQuestion) {
      latestAnalysis = analysis;
      lastAnalysisTime = now;
    }

    return analysis;
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    return {
      success: false,
      message: `Analysis temporarily unavailable: ${error.message}`,
    };
  }
}

// API Routes

// Get current traffic status
app.get('/api/status', async (req, res) => {
  try {
    const screenshot = await captureScreenshot();
    const analysis = await analyzeTraffic(screenshot);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get traffic status',
    });
  }
});

// Chat endpoint for custom questions
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a message',
      });
    }

    const screenshot = await captureScreenshot();
    const analysis = await analyzeTraffic(screenshot, message);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process your question',
    });
  }
});

// Get latest screenshot as image
app.get('/api/screenshot', async (req, res) => {
  try {
    const screenshot = await captureScreenshot();
    
    if (!screenshot) {
      return res.status(503).json({
        success: false,
        message: 'No screenshot available',
      });
    }

    res.set('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get screenshot',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    browserConnected: !!browser?.isConnected(),
    lastCapture: latestScreenshot ? 'available' : 'none',
    uptime: process.uptime(),
  });
});

// Serve the main chat interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function start() {
  console.log('🌉 Maseru Bridge Traffic Bot');
  console.log('============================');
  
  if (!config.anthropicApiKey) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.log('   Set it with: export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  // Initialize browser
  const browserReady = await initBrowser();
  
  if (!browserReady) {
    console.log('⚠️  Browser failed to load camera feed.');
    console.log('   The bot will retry when requests come in.');
  }

  // Start periodic capture
  setInterval(async () => {
    if (browser?.isConnected()) {
      await captureScreenshot();
    }
  }, config.captureInterval);

  // Start Express server
  app.listen(config.port, () => {
    console.log(`\n🚀 Server running at http://localhost:${config.port}`);
    console.log(`\n📱 Open this URL in your browser to use the chatbot`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await browser?.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browser?.close();
  process.exit(0);
});

// Start the application
start();
