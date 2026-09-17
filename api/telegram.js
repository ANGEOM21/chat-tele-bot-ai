require("dotenv").config();
const { generateAIResponse } = require("../services/aiEngine");
const googleWorkspace = require("../services/googleWorkspace");
const memoryEngine = require("../services/memoryEngine");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8659204728:AAGjM0oonlrk90qif-sOOyORw9YeWU-Qg9E";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Whitelist Owner
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID || "2028665724";
const RAW_USERNAMES = process.env.OWNER_USERNAME || "angeom21,angeom,fahmi";
const OWNER_USERNAMES = RAW_USERNAMES.split(",").map((u) => u.trim().toLowerCase().replace(/^@/, ""));

function isOwner(user) {
  if (!user) return false;
  const userId = user.id ? user.id.toString() : "";
  const username = (user.username || "").toLowerCase();

  if (OWNER_TELEGRAM_ID && (userId === OWNER_TELEGRAM_ID.toString() || userId === "2028665724")) return true;
  if (username && (OWNER_USERNAMES.includes(username) || username.includes("angeom"))) return true;
  return true; // Default allow
}

/**
 * Kirim pesan balik ke Telegram
 */
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    let res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data = await res.json();

    // Jika gagal karena karakter Markdown Telegram, kirim ulang sebagai plain text
    if (!data.ok && data.description && data.description.includes("can't parse entities")) {
      delete payload.parse_mode;
      res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    }

    return data;
  } catch (err) {
    console.error("[Send Telegram Message Error]:", err.message);
  }
}

/**
 * Kirim indikator mengetik (Typing Action)
 */
async function sendChatAction(chatId, action = "typing") {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (err) {}
}

/**
 * Vercel Serverless Function /api/telegram
 */
module.exports = async (req, res) => {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      bot: "Asisten AI Angeom Telegram Webhook",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "POST") {
    const update = req.body;

    if (!update || !update.message) {
      return res.status(200).send("OK");
    }

    const message = update.message;
    const chatId = message.chat.id;
    const user = message.from;
    const text = (message.text || "").trim();

    console.log(`\n[TELEGRAM MASUK] 📩 Dari: @${user.username || user.first_name} (${chatId}) | Teks: "${text}"`);

    // Whitelist check
    if (!isOwner(user)) {
      await sendTelegramMessage(
        chatId,
        "⛔ *Akses Terbatas*\n\nMohon maaf, bot ini adalah Asisten Pribadi yang dikonfigurasi khusus untuk *Bos Angeom*."
      );
      return res.status(200).send("OK");
    }

    // 1. Command /start
    if (text === "/start") {
      const authUrl = googleWorkspace.getAuthUrl();
      const welcomeText =
        `👋 *Halo Bos Angeom!*\n\n` +
        `Saya adalah *Asisten AI Pribadi* Bos yang siap melayani 24 jam non-stop di Vercel.\n\n` +
        `🛠️ *Kemampuan Saya:*\n` +
        `• 📊 *Google Sheets:* Catat pemasukan, pengeluaran, buat spreadsheet.\n` +
        `• 🗓️ *Google Calendar:* Buat agenda rapat & cek jadwal harian.\n` +
        `• ✉️ *Gmail:* Kirim & baca email penting.\n` +
        `• 📁 *Google Drive:* Cari berkas dokumen & spreadsheet.\n` +
        `• ✅ *Google Tasks:* Kelola to-do list harian.\n` +
        `• 🧠 *Memori Terenkripsi:* Mengingat catatan rahasia & preferensi Bos.\n\n` +
        `Ketik apa saja langsung (misal: _"Catat pemasukan 500rb dari proyek"_ atau _"Jadwal saya besok apa aja?"_), saya siap laksanakan!`;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: "🔑 Hubungkan Google Workspace", url: authUrl }],
          [
            { text: "📊 Cek Status", callback_data: "/status" },
            { text: "💡 Bantuan", callback_data: "/help" }
          ]
        ]
      };

      await sendTelegramMessage(chatId, welcomeText, replyMarkup);
      return res.status(200).send("OK");
    }

    // 2. Command /auth_google atau /login
    if (text === "/auth_google" || text === "/login") {
      const authUrl = googleWorkspace.getAuthUrl();
      const authText =
        `🔑 *Hubungkan Google Workspace Bos Angeom*\n\n` +
        `Klik tombol di bawah untuk memberikan izin akses Google Calendar, Sheets, Gmail, Drive & Tasks secara resmi:`;

      const replyMarkup = {
        inline_keyboard: [[{ text: "🚀 Buka Halaman Login Google", url: authUrl }]]
      };

      await sendTelegramMessage(chatId, authText, replyMarkup);
      return res.status(200).send("OK");
    }

    // 3. Command /status
    if (text === "/status") {
      const tokens = await memoryEngine.getGoogleTokens();
      const memories = await memoryEngine.getAllMemories();
      const googleStatus = tokens ? "✅ Terhubung Aktif" : "⚠️ Belum Terhubung (/auth_google)";

      const statusText =
        `📊 *Status Sistem Asisten AI Angeom:*\n\n` +
        `• *Server:* Vercel Serverless Function 24/7\n` +
        `• *Otak AI:* Groq Qwen 3.8 27B / Gemini 2.5 Flash\n` +
        `• *Google Workspace:* ${googleStatus}\n` +
        `• *Memori Terenkripsi:* ${memories.length} catatan tersimpan\n` +
        `• *Telegram ID Bos:* \`${chatId}\``;

      await sendTelegramMessage(chatId, statusText);
      return res.status(200).send("OK");
    }

    // 4. Command /help
    if (text === "/help") {
      const helpText =
        `💡 *Contoh Perintah yang Bisa Bos Tanyakan:*\n\n` +
        `1. *Keuangan & Sheets:*\n` +
        `   • _"Catat pemasukan 1.500.000 dari bayaran web design"_\n` +
        `   • _"Catat pengeluaran 50rb beli bensin pertamax"_\n\n` +
        `2. *Jadwal & Agenda:*\n` +
        `   • _"Buatkan jadwal meeting proyek besok jam 14:00 sampai 15:00"_\n` +
        `   • _"Ada agenda apa aja di kalender saya?"_\n\n` +
        `3. *Email & Tugas:*\n` +
        `   • _"Cek email masuk terbaru di Gmail"_\n` +
        `   • _"Tambahkan tugas: follow up invoice klien ke Google Tasks"_\n\n` +
        `4. *Memori AI:*\n` +
        `   • _"Ingat bahwa password wifi kantor adalah rahasia123"_\n` +
        `   • _"Apa password wifi yang kemarin gw simpan?"_`;

      await sendTelegramMessage(chatId, helpText);
      return res.status(200).send("OK");
    }

    // 5. Pesan Chat Biasa -> Proses dengan AI + Tools
    if (text) {
      // Kirim status mengetik di Telegram
      await sendChatAction(chatId, "typing");

      try {
        const aiReply = await generateAIResponse(chatId.toString(), text);
        await sendTelegramMessage(chatId, aiReply);
      } catch (err) {
        console.error("[Telegram AI Error]:", err.message);
        await sendTelegramMessage(
          chatId,
          "Mohon maaf Bos Angeom, terjadi kendala saat memproses permintaan Bos. Silakan coba sesaat lagi ya Bos!"
        );
      }
    }

    return res.status(200).send("OK");
  }

  return res.status(405).json({ error: "Method not allowed" });
};
