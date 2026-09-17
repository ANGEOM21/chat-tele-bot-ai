require("dotenv").config();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { webhookUrl } = req.body || {};
  const targetUrl = webhookUrl || "https://chat-tele-bot-ai.vercel.app/api/telegram";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN belum disetel di Vercel Environment Variables" });
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(targetUrl)}`
    );
    const data = await resp.json();
    return res.status(200).json({ success: data.ok, result: data, webhookUrl: targetUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
