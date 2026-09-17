# 🤖 Asisten AI Angeom (Telegram Bot & Vercel Serverless)

Super Personal AI Assistant khusus untuk **Bos Angeom (FAHMI IDRIS ANJOUNGHAN)** via Telegram Bot (`@asangeom_bot`), terintegrasi penuh dengan **Google Workspace (Calendar, Sheets, Gmail, Drive, Tasks)** dan database memori terenkripsi AES-256-GCM, berjalan **100% Gratis 24 Jam Non-Stop di Vercel**.

---

## 🌟 Fitur Utama
- **100% Serverless 24/7 di Vercel:** Tidak butuh server lokal menyala, tanpa biaya bulanan ($0 / Rp 0).
- **Telegram Bot API (@asangeom_bot):** Respons instan via Webhook, bebas blokir negara, tanpa kartu kredit.
- **Otak AI Cepat & Konteks Panjang:** Menggunakan Groq (Qwen 3.8 27B) dan Google Gemini 2.5 Flash dengan Function / Tool Calling.
- **Google Workspace Suite:**
  - 📊 **Google Sheets:** Catat pemasukan, pengeluaran uang, dan pembukuan keuangan.
  - 🗓️ **Google Calendar:** Buat agenda rapat dan cek jadwal harian.
  - ✉️ **Gmail:** Kirim email resmi dan cek inbox penting.
  - 📁 **Google Drive:** Cari berkas dan spreadsheet.
  - ✅ **Google Tasks:** Buat dan kelola to-do list harian.
- **Memori Terenkripsi AES-256-GCM:** Mengingat preferensi, data rahasia, dan catatan jangka panjang Bos.
- **Whitelist Proteksi:** Hanya merespon chat dari Bos Angeom.

---

## 🚀 Panduan Setup Cepat

### 1. Environment Variables di Vercel
Pastikan variabel berikut disetel di Vercel Project Settings:
- `TELEGRAM_BOT_TOKEN` = `8659204728:AAGjM0oonlrk90qif-sOOyORw9YeWU-Qg9E`
- `TELEGRAM_BOT_USERNAME` = `asangeom_bot`
- `GROQ_API` = *(Kunci API Groq Bos)*
- `GOOGLE_CLIENT_ID` = *(Google OAuth Client ID)*
- `GOOGLE_CLIENT_SECRET` = *(Google OAuth Client Secret)*
- `GOOGLE_REDIRECT_URI` = `https://angeom-assistant.vercel.app/oauth2callback`
- `MEMORY_ENCRYPTION_KEY` = `angeom_super_secret_ai_memory_aes256_key_2026`

### 2. Set Webhook Telegram
Cukup jalankan satu kali request via browser/terminal:
```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://angeom-assistant.vercel.app/api/telegram
```

---

## 📱 Perintah Bot di Telegram
- `/start` : Menu utama & tombol otorisasi Google Workspace
- `/auth_google` : Tautan login Google Workspace resmi
- `/status` : Status koneksi AI, Google, dan memori
- `/help` : Panduan contoh instruksi teks
