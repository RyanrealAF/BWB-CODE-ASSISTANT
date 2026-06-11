#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import readline from "readline";
import fs from "fs";
import path from "path";
import os from "os";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const isGemini = !!process.env.GEMINI_API_KEY;

const CONFIG = {
  model: isGemini ? "gemini-2.5-flash" : "claude-sonnet-4-6",
  max_tokens: 4096,
  max_file_bytes: 80_000,
  max_history_turns: 20,
  context_dir: process.cwd(),
  history_file: path.join(os.homedir(), ".bwb_repl_history.json"),
};

const SYSTEM_PROMPT = `You are a precision code assistant. Diagnose bugs with root cause analysis. Write complete, runnable code — no truncation. Flag architecture issues. Be direct. No preamble.`;

// ─── CLIENT INIT ───────────────────────────────────────────────────────────────
const client = isGemini 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) 
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── (Keep your existing Helpers, Colors, and COMMANDS objects here) ───

// ─── REPLACED CHAT FUNCTION ────────────────────────────────────────────────────
async function chat(userInput) {
  const messageContent = buildUserMessage(userInput, loadedFiles);
  history.push({ role: "user", content: messageContent });
  history = pruneHistory(history);

  process.stdout.write(C.green + "\nAssistant: " + C.reset);

  try {
    if (isGemini) {
      const response = await client.models.generateContent({
        model: CONFIG.model,
        contents: history.map(h => ({ 
          role: h.role === 'assistant' ? 'model' : 'user', 
          parts: [{ text: h.content }] 
        })),
        config: { systemInstruction: SYSTEM_PROMPT }
      });
      process.stdout.write(response.text);
      history.push({ role: "assistant", content: response.text });
    } else {
      const stream = client.messages.stream({
        model: CONFIG.model,
        max_tokens: CONFIG.max_tokens,
        system: SYSTEM_PROMPT,
        messages: history,
      });
      let fullResponse = "";
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          process.stdout.write(chunk.delta.text);
          fullResponse += chunk.delta.text;
        }
      }
      history.push({ role: "assistant", content: fullResponse });
    }
  } catch (err) {
    print(C.red, `\nAPI Error: ${err.message}`);
    history.pop();
    return;
  }
  console.log("\n");
  saveHistory(history);
}

// ─── (Keep your existing main() function here) ───