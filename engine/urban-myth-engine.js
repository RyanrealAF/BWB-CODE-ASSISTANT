import Groq from "groq-sdk";
import { buildSafePayload, compressArchetypeContext } from "./token-router.js";
import { initDB, upsertArchetype, listArchetypes, getArchetypeHistory, resetDB } from "./archetype-cache.js";

const NARRATIVE_MODEL  = "llama-3.1-8b-instant";
const DISTORTION_MODEL = "llama-3.3-70b-versatile";

const SYS_NARRATIVE  = "Urban myth engine. Input: seed. Output: 100-word street-level myth, second person present tense, end mid-thought. No fantasy. No heroes.";
const SYS_DISTORTION = "Input: myth. Output: same myth with one impossible-but-inevitable detail injected. No explanation. No resolution. 100 words max.";
const SYS_ARCHETYPE  = "Input: myth. Output: JSON array only, 1-3 archetype names. Example: [\"The Corner\",\"The Signal\"]";

export class UrbanMythEngine {
  constructor(apiKey) {
    this.groq  = new Groq({ apiKey });
    this.ready = false;
  }

  async init() {
    await initDB();
    this.ready = true;
  }

  async generate(seed) {
    if (!this.ready) await this.init();

    const archetypes = listArchetypes();
    const archCtx    = compressArchetypeContext(archetypes);
    const seedLine   = archCtx ? archCtx + "\nSeed: " + seed : "Seed: " + seed;

    const narrativeMessages = buildSafePayload(SYS_NARRATIVE, [{ role: "user", content: seedLine }], archCtx);
    const narrativeResp = await this.groq.chat.completions.create({
      model: NARRATIVE_MODEL, max_tokens: 200,
      messages: [{ role: "system", content: SYS_NARRATIVE }, ...narrativeMessages],
    });
    const narrative = narrativeResp.choices[0]?.message?.content || "";

    const distortionMessages = buildSafePayload(SYS_DISTORTION, [{ role: "user", content: narrative }]);
    const distortionResp = await this.groq.chat.completions.create({
      model: DISTORTION_MODEL, max_tokens: 200,
      messages: [{ role: "system", content: SYS_DISTORTION }, ...distortionMessages],
    });
    const distorted = distortionResp.choices[0]?.message?.content || "";

    const archetypeResp = await this.groq.chat.completions.create({
      model: NARRATIVE_MODEL, max_tokens: 60,
      messages: [
        { role: "system", content: SYS_ARCHETYPE },
        { role: "user",   content: distorted },
      ],
    });

    let extractedArchetypes = [];
    try {
      const raw = archetypeResp.choices[0]?.message?.content || "[]";
      extractedArchetypes = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (_) {}

    for (const name of extractedArchetypes) {
      upsertArchetype(name, distorted.slice(0, 50));
    }

    return { seed, narrative, distorted, archetypes: extractedArchetypes };
  }

  async listArchetypes() { return listArchetypes(); }
  async getHistory(name) { return getArchetypeHistory(name); }
  async reset()          { resetDB(); }
}