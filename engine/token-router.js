const TPM_CEILING = 5800;
const AVG_CHARS_PER_TOKEN = 4;

export function estimateTokens(text) {
  return Math.ceil((text || "").length / AVG_CHARS_PER_TOKEN);
}

export function trimToLimit(text, maxTokens) {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...trimmed]";
}

export function buildSafePayload(systemPrompt, messages, archetypeContext = "") {
  const systemTokens    = estimateTokens(systemPrompt);
  const archetypeTokens = estimateTokens(archetypeContext);
  const overhead        = 200;
  const available       = TPM_CEILING - systemTokens - archetypeTokens - overhead;

  let trimmed = [...messages];
  while (trimmed.length > 1) {
    const total = trimmed.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    if (total <= available) break;
    trimmed = trimmed.slice(2);
  }

  const lastMsg = trimmed[trimmed.length - 1];
  if (lastMsg) {
    lastMsg.content = trimToLimit(lastMsg.content, available - 200);
  }

  return trimmed;
}

export function compressArchetypeContext(archetypes) {
  if (!archetypes.length) return "";
  const lines = archetypes.slice(0, 5).map(a => {
    const mutations = JSON.parse(a.mutations || "[]");
    const last = mutations.slice(-1)[0] || "none";
    return "[" + a.name + "] seen:" + a.count + " last_mutation:" + last;
  });
  return "ARCHETYPE MEMORY:\n" + lines.join("\n");
}
