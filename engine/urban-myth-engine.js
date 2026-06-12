
import { buildSafePayload, compressArchetypeContext } from "./token-router.js";
import { initDB, upsertArchetype, listArchetypes, getArchetypeHistory, resetDB } from "./archetype-cache.js";

const SYS_NARRATIVE  = "Urban myth engine. Input: seed. Output: 100-word street-level myth, second person present tense, end mid-thought. No fantasy. No heroes.";
const SYS_DISTORTION = "Input: myth. Output: same myth with one impossible-but-inevitable detail injected. No explanation. No resolution. 100 words max.";
const SYS_ARCHETYPE  = "Input: myth. Output: JSON array only, 1-3 archetype names. Example: [\"The Corner\",\"The Signal\"]";

export class UrbanMythEngine {
  constructor(apiUrl, model) {
    this.apiUrl = apiUrl;
    this.model = model;
    this.ready = false;
  }

  async init() {
    await initDB();
    this.ready = true;
  }

  async _ollamaCall(systemPrompt, userMessages, maxTokens) {
    const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: this.model,
            stream: false,
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                ...userMessages
            ]
        })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API call failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    return data.message?.content || "";
  }

  async generate(seed) {
    if (!this.ready) await this.init();

    const archetypes = listArchetypes();
    const archCtx    = compressArchetypeContext(archetypes);
    const seedLine   = archCtx ? archCtx + "\nSeed: " + seed : "Seed: " + seed;

    const narrativeMessages = buildSafePayload(SYS_NARRATIVE, [{ role: "user", content: seedLine }], archCtx);
    const narrative = await this._ollamaCall(SYS_NARRATIVE, narrativeMessages, 200);
    if (!narrative) throw new Error("Narrative generation failed (empty response).");


    const distortionMessages = buildSafePayload(SYS_DISTORTION, [{ role: "user", content: narrative }]);
    const distorted = await this._ollamaCall(SYS_DISTORTION, distortionMessages, 200);
    if (!distorted) throw new Error("Distortion generation failed (empty response).");

    const archetypeMessages = [{ role: "user", content: distorted }];
    const rawArchetypes = await this._ollamaCall(SYS_ARCHETYPE, archetypeMessages, 60);

    let extractedArchetypes = [];
    try {
      if (rawArchetypes) {
        extractedArchetypes = JSON.parse(rawArchetypes.replace(/```json|```/g, "").trim());
      }
    } catch (err) {
      console.error("Failed to parse archetypes:", rawArchetypes, err.message);
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
