require("dotenv").config();
const googleWorkspace = require("../services/googleWorkspace");

module.exports = async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("<h1>Error: Authorization code tidak ditemukan.</h1>");
  }

  try {
    await googleWorkspace.handleAuthCallback(code);
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
            height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 480px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #38bdf8; margin-bottom: 10px; font-size: 24px; }
          p { color: #94a3b8; line-height: 1.6; margin-bottom: 25px; }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #0ea5e9, #38bdf8);
            color: white;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-weight: bold;
            transition: all 0.3s ease;
          }
          .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(14, 165, 233, 0.4); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🎉</div>
          <h1>Google Workspace Berhasil Terhubung!</h1>
          <p>Asisten AI Angeom sekarang sudah memiliki akses resmi ke Google Calendar, Google Sheets, Gmail, Google Drive, dan Google Tasks Bos.</p>
          <a class="btn" href="https://t.me/asangeom_bot">Kembali ke Telegram Bot</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("[OAuth Callback Error]:", err.message);
    return res.status(500).send(`<h1>Gagal Menghubungkan Google:</h1><p>${err.message}</p>`);
  }
};
