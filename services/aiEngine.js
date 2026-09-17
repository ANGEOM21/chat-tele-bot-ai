require("dotenv").config();
const { commandsSystem } = require("../command/system");
const { Groq } = require("groq-sdk");
const memoryEngine = require("./memoryEngine");
const aiTools = require("./aiTools");

const groq = new Groq({
  apiKey: process.env.GROQ_API || ""
});

const chatSessions = {};

// Convert tools to Groq format
const groqTools = aiTools.aiToolsDeclarations.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

const GROQ_MODELS = ["openai/gpt-oss-120b", "groq/compound", "qwen/qwen3.8-27b"];

/**
 * Parser khusus untuk mendeteksi pemanggilan tool dalam bentuk XML tag jika model mengeluarkannya sebagai teks
 */
function parseXmlToolCall(content) {
  if (!content) return null;
  const match = content.match(
    /<toolcall>[\s\S]*?<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>[\s\S]*?<\/toolcall>/i
  );
  if (!match) return null;

  const rawFnName = match[1].trim();
  const rawParams = match[2];

  const params = {};
  const paramRegex = /<parameter=([a-zA-Z0-9_]+)>([\s\S]*?)<\/parameter>/gi;
  let pMatch;
  while ((pMatch = paramRegex.exec(rawParams)) !== null) {
    const pName = pMatch[1].trim();
    let pVal = pMatch[2].trim();
    try {
      if (pVal.startsWith("[") || pVal.startsWith("{")) {
        pVal = JSON.parse(pVal);
      }
    } catch (e) {}
    params[pName] = pVal;
  }

  // Normalisasi nama fungsi jika underscore hilang (misal: sheetscreatespreadsheet -> sheets_create_spreadsheet)
  let fnName = rawFnName;
  for (const decl of aiTools.aiToolsDeclarations) {
    if (decl.name.replace(/_/g, "").toLowerCase() === rawFnName.replace(/_/g, "").toLowerCase()) {
      fnName = decl.name;
      break;
    }
  }

  const cleanPrefix = content.replace(/<toolcall>[\s\S]*?<\/toolcall>/gi, "").trim();

  return {
    name: fnName,
    args: params,
    cleanPrefix
  };
}

/**
 * Bersihkan sisa tag teknis dari pesan akhir
 */
function cleanOutput(text) {
  if (!text) return "";
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<toolcall>[\s\S]*?<\/toolcall>/gi, "")
    .replace(/<\/?(?:function|parameter|toolcall)[^>]*>/gi, "")
    .trim();
}

/**
 * Generate AI Response with Groq & Gemini + Google Tools & Memory
 */
async function generateAIResponse(sessionId, userMessage) {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = [];
  }
  const sessionHistory = chatSessions[sessionId];
  sessionHistory.push({ role: "user", content: userMessage });

  if (sessionHistory.length > 20) {
    sessionHistory.splice(0, sessionHistory.length - 20);
  }

  // Pre-inject recent encrypted memories into context
  let memoryContext = "";
  try {
    const recentMemories = await memoryEngine.getAllMemories();
    if (recentMemories && recentMemories.length > 0) {
      memoryContext =
        "\n\nDATABASE MEMORI TERENKRIPSI BOS ANGEOM SAAT INI:\n" +
        recentMemories
          .slice(0, 15)
          .map((m) => `- [${(m.category || "GENERAL").toUpperCase()}] ${m.content} (Kata kunci: ${m.keywords || "-"})`)
          .join("\n");
    }
  } catch (err) {
    console.warn("[AI Engine Memory Context Error]:", err.message);
  }

  const activeSystemPrompt = commandsSystem + memoryContext;

  // 1. Prioritas Utama: Groq Ultra Fast dengan Tool Calling & Fallback
  if (process.env.GROQ_API) {
    const messages = [
      { role: "system", content: activeSystemPrompt },
      ...sessionHistory.map((item) => ({
        role: item.role,
        content: item.content
      }))
    ];

    for (const modelName of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model: modelName,
          messages: messages,
          tools: groqTools,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 700
        });

        const choice = completion.choices[0];
        const message = choice?.message;

        // A. Handle Structured Tool Call (OpenAI Standard)
        if (message && message.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          const functionName = toolCall.function.name;
          let functionArgs = {};
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {}

          const toolResult = await aiTools.executeToolCall(functionName, functionArgs);

          const followUpMessages = [
            ...messages,
            message,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify(toolResult)
            }
          ];

          const secondResponse = await groq.chat.completions.create({
            model: modelName,
            messages: followUpMessages,
            temperature: 0.7,
            max_tokens: 700
          });

          let finalReply =
            secondResponse.choices[0]?.message?.content ||
            `Siap Bos Angeom, tugas ${functionName} berhasil diselesaikan.`;
          finalReply = cleanOutput(finalReply);

          sessionHistory.push({ role: "assistant", content: finalReply });
          return finalReply;
        }

        // B. Handle Raw XML Tool Call (jika model seperti Qwen mengeluarkan tag <toolcall>)
        if (message && message.content && message.content.includes("<toolcall>")) {
          const xmlTool = parseXmlToolCall(message.content);
          if (xmlTool) {
            console.log(`[XML TOOL INTERCEPT] ⚡ Mengeksekusi ${xmlTool.name} dari XML tag...`);
            const toolResult = await aiTools.executeToolCall(xmlTool.name, xmlTool.args);

            const followUpMessages = [
              ...messages,
              { role: "assistant", content: xmlTool.cleanPrefix || "Mengeksekusi tool..." },
              {
                role: "user",
                content: `[Hasil Eksekusi Tool ${xmlTool.name}]: ${JSON.stringify(toolResult)}\n\nBerikan balasan konfirmasi yang ramah kepada Bos Angeom tanpa menampilkan tag teknis/XML.`
              }
            ];

            const secondResponse = await groq.chat.completions.create({
              model: modelName,
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 700
            });

            let finalReply =
              secondResponse.choices[0]?.message?.content ||
              `Siap Bos Angeom, ${xmlTool.name} berhasil dijalankan.`;
            finalReply = cleanOutput(finalReply);

            sessionHistory.push({ role: "assistant", content: finalReply });
            return finalReply;
          }
        }

        // C. Teks Langsung Biasa
        if (message && message.content) {
          let reply = cleanOutput(message.content);
          sessionHistory.push({ role: "assistant", content: reply });
          return reply;
        }
      } catch (groqErr) {
        console.warn(`[Groq Model ${modelName} Warning]:`, groqErr.message);
      }
    }
  }

  // 2. Fallback: Google Gemini jika disetel API key-nya
  if (process.env.GEMINI_API_KEY) {
    try {
      const contents = sessionHistory.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }]
      }));

      const payload = {
        system_instruction: { parts: [{ text: activeSystemPrompt }] },
        contents: contents,
        tools: [{ function_declarations: aiTools.aiToolsDeclarations }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      const modelParts = data.candidates?.[0]?.content?.parts || [];

      const functionCallPart = modelParts.find((p) => p.functionCall);
      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        const toolResult = await aiTools.executeToolCall(name, args);

        const followUpContents = [
          ...contents,
          {
            role: "user",
            parts: [{ text: `[Hasil Eksekusi Tool ${name}]: ${JSON.stringify(toolResult)}\n\nJawablah dengan ramah dan lengkap.` }]
          }
        ];

        const followUpRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: activeSystemPrompt }] },
              contents: followUpContents
            })
          }
        );

        const followUpData = await followUpRes.json();
        const reply = cleanOutput(followUpData.candidates?.[0]?.content?.parts?.[0]?.text || `Siap Bos Angeom, tugas ${name} berhasil.`);
        sessionHistory.push({ role: "assistant", content: reply });
        return reply;
      }

      const textPart = modelParts.find((p) => p.text);
      if (textPart && textPart.text) {
        const reply = cleanOutput(textPart.text);
        sessionHistory.push({ role: "assistant", content: reply });
        return reply;
      }
    } catch (geminiErr) {
      console.error("[Gemini Fallback Error]:", geminiErr.message);
    }
  }

  return "Maaf Bos Angeom, AI sedang mengalami gangguan sementara. Silakan coba beberapa saat lagi.";
}

module.exports = {
  generateAIResponse,
  chatSessions
};
