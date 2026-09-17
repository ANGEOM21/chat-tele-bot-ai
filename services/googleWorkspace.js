const { google } = require("googleapis");
const memoryEngine = require("./memoryEngine");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "https://angeom-assistant.vercel.app/oauth2callback";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/tasks"
];

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });
}

async function handleAuthCallback(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await memoryEngine.saveGoogleTokens(tokens);
  return tokens;
}

async function getAuthenticatedClient() {
  const tokens = await memoryEngine.getGoogleTokens();
  if (!tokens) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    const updated = { ...tokens, ...newTokens };
    await memoryEngine.saveGoogleTokens(updated);
  });

  return oauth2Client;
}

// 1. Google Calendar
async function createCalendarEvent(summary, description, startDateTime, endDateTime) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung. Silakan login terlebih dahulu via /auth_google");

  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      start: { dateTime: new Date(startDateTime).toISOString(), timeZone: "Asia/Jakarta" },
      end: { dateTime: new Date(endDateTime).toISOString(), timeZone: "Asia/Jakarta" }
    }
  });

  return {
    success: true,
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
    summary: res.data.summary
  };
}

async function listCalendarEvents(maxResults = 5) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: maxResults,
    singleEvents: true,
    orderBy: "startTime"
  });

  return (res.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start.dateTime || e.start.date,
    end: e.end.dateTime || e.end.date,
    link: e.htmlLink
  }));
}

// 2. Google Sheets
async function appendSpreadsheetRow(spreadsheetId, range, values) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: range || "Sheet1!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values]
    }
  });

  return {
    success: true,
    updatedRange: res.data.updates?.updatedRange,
    updatedRows: res.data.updates?.updatedRows
  };
}

async function createSpreadsheet(title, headers = [], initialRows = []) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: title || "Catatan Keuangan Asisten Angeom" }
    }
  });

  const spreadsheetId = res.data.spreadsheetId;
  const spreadsheetUrl = res.data.spreadsheetUrl;

  const dataToWrite = [];
  if (headers && headers.length > 0) dataToWrite.push(headers);
  if (initialRows && initialRows.length > 0) dataToWrite.push(...initialRows);

  if (dataToWrite.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: dataToWrite }
    });
  }

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    title
  };
}

// 3. Gmail
async function sendEmail(to, subject, bodyText) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const gmail = google.gmail({ version: "v1", auth });
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${utf8Subject}`,
    "",
    bodyText
  ];
  const message = messageParts.join("\n");
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage }
  });

  return { success: true, messageId: res.data.id };
}

async function listRecentEmails(maxResults = 5) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({ userId: "me", maxResults });

  if (!res.data.messages || res.data.messages.length === 0) return [];

  const emails = [];
  for (const m of res.data.messages) {
    const detail = await gmail.users.messages.get({ userId: "me", id: m.id });
    const headers = detail.data.payload.headers || [];
    const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(Tanpa Subjek)";
    const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "(Pengirim Tidak Dikenal)";
    emails.push({ id: m.id, snippet: detail.data.snippet, subject, from });
  }

  return emails;
}

// 4. Google Drive
async function searchDriveFiles(query = "", pageSize = 5) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const drive = google.drive({ version: "v3", auth });
  let q = "trashed = false";
  if (query) q += ` and (name contains '${query}' or fullText contains '${query}')`;

  const res = await drive.files.list({
    q,
    pageSize,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime)"
  });

  return res.data.files || [];
}

// 5. Google Tasks
async function createTask(title, notes = "", dueDate = null) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const tasks = google.tasks({ version: "v1", auth });
  const requestBody = { title, notes };
  if (dueDate) requestBody.due = new Date(dueDate).toISOString();

  const res = await tasks.tasks.insert({ tasklist: "@default", requestBody });
  return { success: true, taskId: res.data.id, title: res.data.title, status: res.data.status };
}

async function listTasks(maxResults = 5) {
  const auth = await getAuthenticatedClient();
  if (!auth) throw new Error("Google Workspace belum terhubung.");

  const tasks = google.tasks({ version: "v1", auth });
  const res = await tasks.tasks.list({ tasklist: "@default", maxResults, showCompleted: false });
  return (res.data.items || []).map((t) => ({ id: t.id, title: t.title, notes: t.notes, due: t.due }));
}

module.exports = {
  getAuthUrl,
  handleAuthCallback,
  getAuthenticatedClient,
  createCalendarEvent,
  listCalendarEvents,
  appendSpreadsheetRow,
  createSpreadsheet,
  sendEmail,
  listRecentEmails,
  searchDriveFiles,
  createTask,
  listTasks
};
