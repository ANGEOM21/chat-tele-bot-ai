require("dotenv").config();
const googleWorkspace = require("../services/googleWorkspace");

module.exports = async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("<h1>Error: Authorization code tidak ditemukan.</h1>");
  }

  try {
    const tokens = await googleWorkspace.handleAuthCallback(code);
    const refreshToken = tokens?.refresh_token || "";

    return res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google Workspace Terhubung - Asisten AI Angeom</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: rgba(30, 41, 59, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(16px);
            padding: 35px;
            border-radius: 20px;
            text-align: center;
            max-width: 520px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          .icon { font-size: 54px; margin-bottom: 15px; }
          h1 { color: #38bdf8; margin-bottom: 10px; font-size: 22px; }
          p { color: #94a3b8; line-height: 1.5; font-size: 14px; margin-bottom: 20px; }
          .token-box {
            background: rgba(15, 23, 42, 0.9);
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 12px;
            padding: 15px;
            text-align: left;
            margin-bottom: 20px;
          }
          .token-label { font-size: 12px; color: #38bdf8; font-weight: bold; margin-bottom: 5px; }
          .token-value {
            font-family: monospace;
            font-size: 11px;
            word-break: break-all;
            background: rgba(0,0,0,0.3);
            padding: 8px;
            border-radius: 6px;
            color: #e2e8f0;
            user-select: all;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #0ea5e9, #38bdf8);
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.3s ease;
          }
          .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(14, 165, 233, 0.4); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🎉</div>
          <h1>Google Workspace Berhasil Terhubung!</h1>
          <p>Asisten AI Angeom sekarang memiliki akses penuh ke Google Calendar, Sheets, Gmail, Drive & Tasks Bos.</p>
          
          ${
            refreshToken
              ? `
            <div class="token-box">
              <div class="token-label">📌 KUNCI PERMANEN VERCEL (GOOGLE_REFRESH_TOKEN):</div>
              <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
                Tambahkan variabel <code>GOOGLE_REFRESH_TOKEN</code> di Vercel Settings agar Google Workspace aktif selamanya tanpa perlu login ulang:
              </p>
              <div class="token-value">${refreshToken}</div>
            </div>
          `
              : ""
          }

          <a class="btn" href="https://t.me/asangeom_bot">🚀 Buka Telegram Bot Sekarang</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("[OAuth Callback Error]:", err.message);
    return res.status(500).send(`<h1>Gagal Menghubungkan Google:</h1><p>${err.message}</p>`);
  }
};
