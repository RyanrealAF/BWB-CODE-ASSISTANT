import Groq from "groq-sdk";
import { buildSafePayload, compressArchetypeContext } from "./token-router.js";
import { initDB, upsertArchetype, listArchetypes, getArchetypeHistory, resetDB } from "./archetype-cache.js";

const NARRATIVE_MODEL  = "llama-3.1-8b-instant";
const DISTORTION_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_NARRATIVE = `You are the BWB Urban Myth Engine — narrative layer.
Your role: take a seed and generate a grounded urban myth. Raw, specific, street-level.
No fantasy tropes. No heroes. Real locations, real tensions, real consequences.
Write in second person present tense. 150 words max. End mid-thought.`;

const SYSTEM_DISTORTION = `You are the BWB Urban Myth Engine — distortion layer.
Your role: take a narrative and inject controlled symbolic anomalies.
Rules:
- Preserve the original structure and specificity
- Insert exactly one impossible detail that feels inevitable
- Do not explain the anomaly
- Do not resolve contradictions
- 150 words max`;

const SYSTEM_ARCHETYPE_EXTRACT = `You are an archetype extractor.
Read the myth and return ONLY a JSON array of 1-3 archetype names (single words or short phrases).
No explanation. No markdown. Example: ["The Witness","The Corner","The Signal"]`;

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

    const seedLine = archCtx ? archCtx + "\n\nSeed: " + seed : "Seed: " + seed;

    const narrativeMessages = buildSafePayload(
      SYSTEM_NARRATIVE,
      [{ role: "user", content: seedLine }],
      archCtx
    );

    const narrativeResp = await this.groq.chat.completions.create({
      model:      NARRATIVE_MODEL,
      max_tokens: 400,
      messages:   [{ role: "system", content: SYSTEM_NARRATIVE }, ...narrativeMessages],
    });
    const narrative = narrativeResp.choices[0]?.message?.content || "";

    const distortionMessages = buildSafePayload(
      SYSTEM_DISTORTION,
      [{ role: "user", content: narrative }]
    );

    const distortionResp = await this.groq.chat.completions.create({
      model:      DISTORTION_MODEL,
      max_tokens: 400,
      messages:   [{ role: "system", content: SYSTEM_DISTORTION }, ...distortionMessages],
    });
    const distorted = distortionResp.choices[0]?.message?.content || "";

    const archetypeResp = await this.groq.chat.completions.create({
      model:      NARRATIVE_MODEL,
      max_tokens: 100,
      messages:   [
        { role: "system", content: SYSTEM_ARCHETYPE_EXTRACT },
        { role: "user",   content: distorted },
      ],
    });

    let extractedArchetypes = [];
    try {
      const raw = archetypeResp.choices[0]?.message?.content || "[]";
      extractedArchetypes = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (_) {}

    for (const name of extractedArchetypes) {
      upsertArchetype(name, distorted.slice(0, 100));
    }

    return { seed, narrative, distorted, archetypes: extractedArchetypes };
  }

  async listArchetypes() { return listArchetypes(); }
  async getHistory(name) { return getArchetypeHistory(name); }
  async reset()          { resetDB(); }
}
