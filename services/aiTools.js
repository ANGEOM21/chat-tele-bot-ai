const googleWorkspace = require("./googleWorkspace");
const memoryEngine = require("./memoryEngine");

// Function Declarations untuk Tool Calling (kompatibel dengan Groq & Gemini)
const aiToolsDeclarations = [
  {
    name: "save_encrypted_memory",
    description: "Simpan fakta, catatan rahasia, preferensi, atau informasi penting Bos Angeom ke database terenkripsi AES-256.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Kategori memori, misal: 'keuangan', 'jadwal', 'pribadi', 'proyek', 'kontak'" },
        content: { type: "string", description: "Isi catatan lengkap yang ingin disimpan" },
        keywords: { type: "string", description: "Kata kunci untuk pencarian cepat, pisahkan dengan koma" }
      },
      required: ["category", "content"]
    }
  },
  {
    name: "search_encrypted_memory",
    description: "Cari catatan atau memori rahasia Bos Angeom berdasarkan kata kunci atau query.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Kata kunci pencarian memori" }
      }
    }
  },
  {
    name: "sheets_append_row",
    description: "Tambahkan baris data baru (seperti catatan pemasukan, pengeluaran uang, belanja) ke Google Sheets.",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "ID Google Spreadsheet (opsional, jika kosong akan pakai default/terakhir)" },
        range: { type: "string", description: "Range target sheet, misal: 'Sheet1!A:E'" },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Array data kolom, contoh: ['2026-09-18', 'Pemasukan', 'Gaji Proyek', '5000000', 'Lunas']"
        }
      },
      required: ["values"]
    }
  },
  {
    name: "sheets_create_spreadsheet",
    description: "Buat file Google Spreadsheet baru di Google Drive Bos Angeom lengkap dengan judul dan header kolom.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul Google Sheet baru" },
        headers: { type: "array", items: { type: "string" }, description: "Daftar nama kolom header (misal: ['Tanggal', 'Tipe', 'Keterangan', 'Nominal', 'Status'])" }
      },
      required: ["title"]
    }
  },
  {
    name: "calendar_create_event",
    description: "Jadwalkan agenda atau meeting baru di Google Calendar Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Judul kegiatan / nama meeting" },
        description: { type: "string", description: "Deskripsi detail agenda" },
        startDateTime: { type: "string", description: "Waktu mulai format ISO 8601 (contoh: '2026-09-18T14:00:00+07:00')" },
        endDateTime: { type: "string", description: "Waktu selesai format ISO 8601 (contoh: '2026-09-18T15:00:00+07:00')" }
      },
      required: ["summary", "startDateTime", "endDateTime"]
    }
  },
  {
    name: "calendar_list_events",
    description: "Ambil daftar agenda kegiatan terdekat di Google Calendar Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        maxResults: { type: "integer", description: "Jumlah agenda yang ingin diambil (default 5)" }
      }
    }
  },
  {
    name: "gmail_send_email",
    description: "Kirim email resmi melalui akun Gmail Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Alamat email penerima" },
        subject: { type: "string", description: "Subjek email" },
        bodyText: { type: "string", description: "Isi teks email" }
      },
      required: ["to", "subject", "bodyText"]
    }
  },
  {
    name: "gmail_list_recent",
    description: "Baca daftar email masuk terbaru di inbox Gmail Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        maxResults: { type: "integer", description: "Jumlah email terbaru (default 5)" }
      }
    }
  },
  {
    name: "drive_search_files",
    description: "Cari file, spreadsheet, atau dokumen di Google Drive Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nama file atau kata kunci pencarian berkas" }
      }
    }
  },
  {
    name: "tasks_create_task",
    description: "Buat tugas baru (to-do list) di Google Tasks Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul tugas" },
        notes: { type: "string", description: "Catatan tambahan tugas" },
        dueDate: { type: "string", description: "Tenggat waktu ISO string (opsional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "tasks_list",
    description: "Ambil daftar tugas aktif (belum selesai) dari Google Tasks Bos Angeom.",
    parameters: {
      type: "object",
      properties: {
        maxResults: { type: "integer", description: "Jumlah tugas (default 5)" }
      }
    }
  }
];

let lastCreatedSpreadsheetId = "1N8MOaNydl5Sn7LD_Q0ac_VDaKpBODvRJUH8w19vXCio"; // ID spreadsheet aktif sebelumnya

async function executeToolCall(toolName, args) {
  try {
    console.log(`[TOOL EXECUTE] ⚡ Menjalankan tool: ${toolName}`, args);

    switch (toolName) {
      case "save_encrypted_memory": {
        const saved = await memoryEngine.saveMemory(args.category, args.content, args.keywords);
        return { success: true, message: "Catatan berhasil diamankan ke database terenkripsi.", data: saved };
      }
      case "search_encrypted_memory": {
        const memories = await memoryEngine.searchMemories(args.query);
        return { success: true, count: memories.length, memories };
      }
      case "sheets_create_spreadsheet": {
        const res = await googleWorkspace.createSpreadsheet(args.title, args.headers);
        lastCreatedSpreadsheetId = res.spreadsheetId;
        return { success: true, message: "Spreadsheet baru berhasil dibuat!", link: res.spreadsheetUrl, spreadsheetId: res.spreadsheetId };
      }
      case "sheets_append_row": {
        let sheetId = args.spreadsheetId || lastCreatedSpreadsheetId;
        if (!sheetId) {
          const files = await googleWorkspace.searchDriveFiles("Keuangan");
          if (files.length > 0) sheetId = files[0].id;
        }
        if (!sheetId) {
          const created = await googleWorkspace.createSpreadsheet("Catatan Keuangan Asisten Angeom", ["Tanggal", "Tipe", "Keterangan", "Nominal", "Status"]);
          sheetId = created.spreadsheetId;
          lastCreatedSpreadsheetId = sheetId;
        }
        const res = await googleWorkspace.appendSpreadsheetRow(sheetId, args.range || "Sheet1!A:E", args.values);
        return { success: true, message: "Baris data berhasil dicatat ke Google Sheets.", spreadsheetId: sheetId, details: res };
      }
      case "calendar_create_event": {
        const res = await googleWorkspace.createCalendarEvent(args.summary, args.description, args.startDateTime, args.endDateTime);
        return { success: true, message: "Jadwal berhasil ditambahkan ke Google Calendar.", link: res.htmlLink };
      }
      case "calendar_list_events": {
        const events = await googleWorkspace.listCalendarEvents(args.maxResults || 5);
        return { success: true, events };
      }
      case "gmail_send_email": {
        const res = await googleWorkspace.sendEmail(args.to, args.subject, args.bodyText);
        return { success: true, message: "Email berhasil dikirim via Gmail.", messageId: res.messageId };
      }
      case "gmail_list_recent": {
        const emails = await googleWorkspace.listRecentEmails(args.maxResults || 5);
        return { success: true, emails };
      }
      case "drive_search_files": {
        const files = await googleWorkspace.searchDriveFiles(args.query, 5);
        return { success: true, files };
      }
      case "tasks_create_task": {
        const res = await googleWorkspace.createTask(args.title, args.notes, args.dueDate);
        return { success: true, message: "Tugas berhasil ditambahkan ke Google Tasks.", task: res };
      }
      case "tasks_list": {
        const tasks = await googleWorkspace.listTasks(args.maxResults || 5);
        return { success: true, tasks };
      }
      default:
        return { error: `Tool ${toolName} tidak dikenali.` };
    }
  } catch (err) {
    console.error(`[Tool Execution Error - ${toolName}]:`, err.message);
    return { error: err.message };
  }
}

module.exports = {
  aiToolsDeclarations,
  executeToolCall
};
