// ENTRY POINT: imported by repl.js
// Handles all communication with the Anthropic Claude API

import https from "https";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const API_HOST = "api.anthropic.com";
const API_PATH = "/v1/messages";
const API_VERSION = "2023-06-01";
// ───────────────────────────────────────────────────────────────────────────

function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=sk-ant-..."
    );
  }
  return key;
}

function buildSystemPrompt(projectContext) {
  return `You are a code assistant embedded in a developer's Termux environment on Android.
You have been given the full context of their project below.
Answer questions about the code, suggest improvements, debug issues, write new code, and explain logic.
Be precise and direct. Prefer complete, working code over partial snippets.
When writing code, match the style and conventions already present in the project.

PROJECT CONTEXT:
${projectContext}`;
}

export async function chat(projectContext, history) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(projectContext),
      messages: history,
      stream: true,
    });

    const options = {
      hostname: API_HOST,
      path: API_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(errBody);
            reject(new Error(parsed.error?.message || errBody));
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${errBody}`));
          }
        });
        return;
      }

      let fullText = "";
      let buffer = "";

      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              const text = parsed.delta?.text || "";
              process.stdout.write(text);
              fullText += text;
            }
          } catch {
            // malformed SSE chunk — skip
          }
        }
      });

      res.on("end", () => resolve(fullText));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
