
/**
 * Build While Bleeding — Urban Myth Engine
 * buildwhilebleeding.com
 * Generates street-level myth narratives via Gemini, then runs a distortion
 * and archetype-extraction pass over the same call surface.
 */
import { GoogleGenAI } from "@google/genai";
import { buildSafePayload, compressArchetypeContext } from "./token-router.js";
import { initDB, upsertArchetype, listArchetypes, getArchetypeHistory, resetDB } from "./archetype-cache.js";

const SYS_NARRATIVE  = "Urban myth engine. Input: seed. Output: 100-word street-level myth, second person present tense, end mid-thought. No fantasy. No heroes.";
const SYS_DISTORTION = "Input: myth. Output: same myth with one impossible-but-inevitable detail injected. No explanation. No resolution. 100 words max.";
const SYS_ARCHETYPE  = "Input: myth. Output: JSON array only, 1-3 archetype names. Example: [\"The Corner\",\"The Signal\"]";

export class UrbanMythEngine {
  constructor(apiKey, model) {
    // ENTRY POINT: Gemini API Key — aistudio.google.com/apikey
    this.apiKey = apiKey;
    this.model = model;
    this.genAI = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
    this.ready = false;
  }

  async init() {
    if (!this.apiKey) throw new Error("[BWB] Myth engine init failed: GEMINI_API_KEY not set.");
    await initDB();
    this.ready = true;
  }

  async _geminiCall(systemPrompt, userMessages, maxTokens) {
    const contents = userMessages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    try {
      const result = await this.genAI.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: maxTokens,
        },
      });
      return result.text || "";
    } catch (error) {
      console.error("[BWB] Gemini call failed:", { error: error.message, model: this.model });
      throw new Error(`Gemini API call failed: ${error.message}`);
    }
  }

  async generate(seed) {
    if (!this.ready) await this.init();

    const archetypes = listArchetypes();
    const archCtx    = compressArchetypeContext(archetypes);
    const seedLine   = archCtx ? archCtx + "\nSeed: " + seed : "Seed: " + seed;

    const narrativeMessages = buildSafePayload(SYS_NARRATIVE, [{ role: "user", content: seedLine }], archCtx);
    const narrative = await this._geminiCall(SYS_NARRATIVE, narrativeMessages, 200);
    if (!narrative) throw new Error("Narrative generation failed (empty response).");


    const distortionMessages = buildSafePayload(SYS_DISTORTION, [{ role: "user", content: narrative }]);
    const distorted = await this._geminiCall(SYS_DISTORTION, distortionMessages, 200);
    if (!distorted) throw new Error("Distortion generation failed (empty response).");

    const archetypeMessages = [{ role: "user", content: distorted }];
    const rawArchetypes = await this._geminiCall(SYS_ARCHETYPE, archetypeMessages, 60);

    let extractedArchetypes = [];
    try {
      if (rawArchetypes) {
        extractedArchetypes = JSON.parse(rawArchetypes.replace(/```json|```/g, "").trim());
      }
    } catch (err) {
      console.error("[BWB] Failed to parse archetypes:", { raw: rawArchetypes, error: err.message });
    }

    if (Array.isArray(extractedArchetypes)) {
        for (const name of extractedArchetypes) {
          upsertArchetype(name, distorted.slice(0, 50));
        }
    }

    return { seed, narrative, distorted, archetypes: extractedArchetypes };
  }

  async listArchetypes() { return listArchetypes(); }
  async getHistory(name) { return getArchetypeHistory(name); }
  async reset()          { resetDB(); }
}
