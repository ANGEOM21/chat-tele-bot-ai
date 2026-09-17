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

/**
 * Generate AI Response with Groq (Qwen 3.8 / Llama) & Gemini + Google Tools & Memory
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

  // 1. Prioritas Utama: Groq Ultra Fast Qwen 3.8 27B dengan Tool Calling
  if (process.env.GROQ_API) {
    try {
      const messages = [
        { role: "system", content: activeSystemPrompt },
        ...sessionHistory.map((item) => ({
          role: item.role,
          content: item.content
        }))
      ];

      const completion = await groq.chat.completions.create({
        model: "qwen/qwen3.8-27b",
        messages: messages,
        tools: groqTools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2048
      });

      const choice = completion.choices[0];
      const message = choice?.message;

      // Cek apakah model meminta pemanggilan Tool
      if (message && message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {}

        const toolResult = await aiTools.executeToolCall(functionName, functionArgs);

        // Kirim hasil eksekusi tool kembali ke model untuk jawaban ramah
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
          model: "qwen/qwen3.8-27b",
          messages: followUpMessages,
          temperature: 0.7,
          max_tokens: 2048
        });

        let finalReply = secondResponse.choices[0]?.message?.content || `Siap Bos Angeom, tugas ${functionName} berhasil diselesaikan.`;
        finalReply = finalReply.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        sessionHistory.push({ role: "assistant", content: finalReply });
        return finalReply;
      }

      // Jika teks langsung
      if (message && message.content) {
        let reply = message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        sessionHistory.push({ role: "assistant", content: reply });
        return reply;
      }
    } catch (groqErr) {
      console.error("[Groq Execution Error]:", groqErr.message);
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
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
        const reply = followUpData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `Siap Bos Angeom, tugas ${name} berhasil.`;
        sessionHistory.push({ role: "assistant", content: reply });
        return reply;
      }

      const textPart = modelParts.find((p) => p.text);
      if (textPart && textPart.text) {
        const reply = textPart.text.trim();
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
