const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Gunakan folder /tmp jika di environment serverless (Vercel)
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const STORAGE_FILE = isVercel
  ? path.join("/tmp", "tele_memory_store.json")
  : path.join(__dirname, "..", "memory_store.json");

const RAW_KEY = process.env.MEMORY_ENCRYPTION_KEY || "angeom_default_secure_memory_key_2026";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(RAW_KEY).digest();

/**
 * Enkripsi teks menggunakan AES-256-GCM
 */
function encrypt(text) {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi teks menggunakan AES-256-GCM
 */
function decrypt(encryptedText) {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[Memory Decrypt Error]:", err.message);
    return "[Gagal mendekripsi memori]";
  }
}

// In-Memory store
let store = {
  memories: [],
  oauthTokens: {}
};

// Load storage dari file jika ada
function loadStore() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf8");
      store = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[MemoryEngine] Load file notice:", e.message);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.warn("[MemoryEngine] Save file notice:", e.message);
  }
}

loadStore();

/**
 * Simpan memori baru ke database terenkripsi
 */
async function saveMemory(category, content, keywords = "") {
  const cleanCategory = category || "general";
  const cleanKeywords = (keywords || "").toLowerCase();
  const encryptedContent = encrypt(content);

  const item = {
    id: Date.now(),
    category: cleanCategory,
    content_encrypted: encryptedContent,
    keywords: cleanKeywords,
    created_at: new Date().toISOString()
  };

  store.memories.push(item);
  saveStore();

  return {
    id: item.id,
    category: cleanCategory,
    content: content,
    keywords: cleanKeywords,
    created_at: item.created_at
  };
}

/**
 * Cari memori berdasarkan query / kata kunci
 */
async function searchMemories(query = "") {
  const cleanQuery = (query || "").toLowerCase();
  const results = [];

  for (const item of store.memories) {
    const decryptedContent = decrypt(item.content_encrypted);
    const matchKeyword = item.keywords && item.keywords.includes(cleanQuery);
    const matchContent = decryptedContent.toLowerCase().includes(cleanQuery);
    const matchCategory = item.category && item.category.toLowerCase().includes(cleanQuery);

    if (!cleanQuery || matchKeyword || matchContent || matchCategory) {
      results.push({
        id: item.id,
        category: item.category,
        content: decryptedContent,
        keywords: item.keywords,
        created_at: item.created_at
      });
    }
  }

  return results.reverse();
}

/**
 * Ambil semua memori
 */
async function getAllMemories() {
  return searchMemories("");
}

/**
 * Hapus memori berdasarkan ID
 */
async function deleteMemory(id) {
  const initialLen = store.memories.length;
  store.memories = store.memories.filter((m) => m.id !== id);
  saveStore();
  return { success: true, deletedCount: initialLen - store.memories.length };
}

/**
 * Simpan Google OAuth Tokens terenkripsi
 */
async function saveGoogleTokens(tokens) {
  const encrypted = encrypt(JSON.stringify(tokens));
  store.oauthTokens["google"] = encrypted;
  saveStore();
  return true;
}

/**
 * Ambil Google OAuth Tokens
 */
async function getGoogleTokens() {
  const encrypted = store.oauthTokens["google"];
  if (!encrypted) return null;
  try {
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

/**
 * Hapus Google OAuth Tokens
 */
async function deleteGoogleTokens() {
  delete store.oauthTokens["google"];
  saveStore();
  return true;
}

module.exports = {
  saveMemory,
  searchMemories,
  getAllMemories,
  deleteMemory,
  saveGoogleTokens,
  getGoogleTokens,
  deleteGoogleTokens
};
