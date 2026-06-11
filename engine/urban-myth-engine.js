const ArchetypeCache = require('./archetype-cache');
const TokenRouter = require('./token-router');

class UrbanMythEngine {
  constructor() {
    this.archetypeCache = new ArchetypeCache();
    this.tokenRouter = new TokenRouter();
  }

  async generateMyth(seed) {
    const claudePrompt = `Create a short, mysterious urban myth based on the seed: "${seed}".`;
    const claudeNarrative = await this.tokenRouter.claude(claudePrompt);

    const geminiPrompt = `Take the following narrative and introduce a surreal, symbolic distortion:

${claudeNarrative}`;
    const geminiDistortion = await this.tokenRouter.gemini(geminiPrompt);

    const fusion = this.fuseNarratives(claudeNarrative, geminiDistortion);
    await this.archetypeCache.updateArchetype(seed, geminiDistortion);

    return fusion;
  }

  fuseNarratives(claude, gemini) {
    return `${claude}

${gemini}`;
  }

  async getArchetypes() {
    return this.archetypeCache.getArchetypes();
  }

  async getArchetypeHistory(name) {
    return this.archetypeCache.getArchetypeHistory(name);
  }

  async reset() {
    return this.archetypeCache.reset();
  }
}

module.exports = UrbanMythEngine;
