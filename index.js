require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const telegramWebhookHandler = require("./api/telegram");
const oauth2CallbackHandler = require("./api/oauth2callback");
const googleWorkspace = require("./services/googleWorkspace");
const memoryEngine = require("./services/memoryEngine");

const app = express();
const port = process.env.PORT || 5000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Webhook & OAuth Endpoints
app.all("/api/telegram", telegramWebhookHandler);
app.all("/oauth2callback", oauth2CallbackHandler);

// API Status
app.get("/api/status", async (req, res) => {
  try {
    const tokens = await memoryEngine.getGoogleTokens();
    const memories = await memoryEngine.getAllMemories();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    let botInfo = null;
    if (botToken) {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      botInfo = await resp.json();
    }

    res.json({
      status: "running",
      bot: botInfo?.result || { username: process.env.TELEGRAM_BOT_USERNAME || "asangeom_bot" },
      googleConnected: !!tokens,
      memoryCount: memories.length,
      aiProvider: process.env.GROQ_API ? "Groq (Qwen 3.8 / Llama 3.3)" : "Gemini"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint untuk mendaftarkan Webhook Telegram ke Vercel URL dengan 1 klik
app.post("/api/set_webhook", async (req, res) => {
  const { webhookUrl } = req.body;
  const targetUrl = webhookUrl || "https://angeom-assistant.vercel.app/api/telegram";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN belum disetel di .env" });
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(targetUrl)}`);
    const data = await resp.json();
    res.json({ success: data.ok, result: data, webhookUrl: targetUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log("==========================================");
    console.log("🤖 TELEGRAM BOT AI - SUPER ASSISTANT ANGEOM");
    console.log(`📱 Username Bot: @${process.env.TELEGRAM_BOT_USERNAME || "asangeom_bot"}`);
    console.log(`🌐 Server Local: ${baseUrl}`);
    console.log("==========================================");
  });
}

module.exports = app;
