require("dotenv").config();
const memoryEngine = require("../services/memoryEngine");

module.exports = async (req, res) => {
  try {
    const tokens = await memoryEngine.getGoogleTokens();
    const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;
    const isGoogleConnected = !!tokens || hasRefreshToken;

    const memories = await memoryEngine.getAllMemories();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    let botInfo = null;
    if (botToken) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        botInfo = await resp.json();
      } catch (e) {}
    }

    res.status(200).json({
      status: "running",
      bot: botInfo?.result || { username: process.env.TELEGRAM_BOT_USERNAME || "asangeom_bot" },
      googleConnected: isGoogleConnected,
      memoryCount: memories.length,
      aiProvider: process.env.GROQ_API ? "Groq (Qwen 3.8 / Llama 3.3)" : "Gemini"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
