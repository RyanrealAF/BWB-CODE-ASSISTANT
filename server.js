import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { UrbanMythEngine } from './engine/urban-myth-engine.js';
import { listArchetypes, getArchetypeHistory, resetDB } from './engine/archetype-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const PREVIEW_FILE = path.resolve(process.cwd(), 'myth_preview.html');

app.use(express.json({ limit: '10mb' }));

// Lazy init Gemini SDK
let genAI = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

// Myth engine instance
const mythEngine = new UrbanMythEngine(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.5-flash');

// API Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BWB Code Assistant & Studio',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  });
});

// Workspace files exploration
function getWorkspaceFiles(dir = '.', depth = 0) {
  if (depth > 4) return [];
  const results = [];
  const fullDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return results;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const relPath = dir === '.' ? entry.name : path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getWorkspaceFiles(relPath, depth + 1));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

app.get('/api/files', (req, res) => {
  try {
    const files = getWorkspaceFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const fullPath = path.resolve(process.cwd(), String(filePath));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Myth Engine Endpoints
app.post('/api/myth', async (req, res) => {
  try {
    const { seed } = req.body;
    if (!seed) return res.status(400).json({ error: 'Seed phrase is required' });
    
    const result = await mythEngine.generate(seed);

    // Save preview HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Myth Preview: ${result.seed}</title>
  <style>
    body { font-family: 'Courier New', monospace; background: #09090b; color: #f4f4f5; padding: 2rem; }
    h1 { color: #6366f1; font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { color: #a855f7; margin-top: 1.5rem; border-bottom: 1px solid #27272a; padding-bottom: 0.25rem; font-size: 1.1rem; }
    p { line-height: 1.6; color: #d4d4d8; font-size: 0.95rem; }
    .container { max-width: 720px; margin: 0 auto; background: #18181b; padding: 2rem; border-radius: 8px; border: 1px solid #27272a; }
    .label { font-weight: bold; color: #ec4899; }
    .badge { display: inline-block; background: #312e81; color: #c7d2fe; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-right: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Urban Myth Output</h1>
    <p><span class="label">Seed:</span> ${result.seed}</p>
    <h2>Narrative</h2>
    <p>${result.narrative}</p>
    <h2>Distortion</h2>
    <p>${result.distorted}</p>
    <h2>Extracted Archetypes</h2>
    <p>${result.archetypes && result.archetypes.length ? result.archetypes.map(a => `<span class="badge">${a}</span>`).join(' ') : 'None extracted'}</p>
  </div>
</body>
</html>`;
    fs.writeFileSync(PREVIEW_FILE, html, 'utf8');

    res.json(result);
  } catch (err) {
    console.error('Myth generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/myth/archetypes', async (req, res) => {
  try {
    const list = await mythEngine.listArchetypes();
    res.json({ archetypes: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/myth/history/:name', async (req, res) => {
  try {
    const history = await mythEngine.getHistory(req.params.name);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/myth/reset', async (req, res) => {
  try {
    await mythEngine.reset();
    res.json({ success: true, message: 'Archetype cache cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/myth/preview', (req, res) => {
  if (fs.existsSync(PREVIEW_FILE)) {
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(PREVIEW_FILE, 'utf8'));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <style>body { font-family: monospace; background: #09090b; color: #a1a1aa; padding: 2rem; text-align: center; }</style>
      <h2>No myth preview generated yet.</h2>
      <p>Send a message or run <code>:myth "seed"</code> to generate one.</p>
    `);
  }
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const {
    message,
    history = [],
    tone = 'professional',
    verbosity = 5,
    mythEngine: useMythEngine = false,
    contextFiles = [],
  } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const trimmed = message.trim();

  // Handle :myth commands via chat directly
  if (trimmed.startsWith(':myth')) {
    const parts = trimmed.split(/\s+/);
    const subcmd = parts[1];

    if (!subcmd || subcmd === 'help') {
      return res.json({
        response: `Myth Engine commands:\n  :myth "seed phrase"        Generate a myth from seed\n  :myth archetypes           List all cached archetypes\n  :myth history <name>       View archetype mutation history\n  :myth reset                Clear archetype database`,
      });
    }

    if (subcmd === 'archetypes') {
      const list = await mythEngine.listArchetypes();
      if (!list.length) return res.json({ response: 'No archetypes cached yet in SQLite database.' });
      const str = list.map(a => `• [${a.count}x] ${a.name} — last seen: ${a.lastSeen ? a.lastSeen.slice(0, 16) : 'recently'}`).join('\n');
      return res.json({ response: `${list.length} Archetype(s) in SQLite cache:\n\n${str}` });
    }

    if (subcmd === 'history') {
      const name = parts.slice(2).join(' ');
      if (!name) return res.json({ response: 'Usage: :myth history <archetype name>' });
      const h = await mythEngine.getHistory(name);
      if (!h) return res.json({ response: `Archetype not found: "${name}"` });
      const mutations = (h.mutations || []).map((m, i) => `  [${i + 1}] ${m}`).join('\n');
      return res.json({ response: `Archetype: ${h.name} (${h.count} appearances)\n\nMutations:\n${mutations || '  No recorded mutations'}` });
    }

    if (subcmd === 'reset') {
      await mythEngine.reset();
      return res.json({ response: 'Archetype SQLite database cleared.' });
    }

    // Generate myth
    const seed = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
    try {
      const result = await mythEngine.generate(seed);
      return res.json({
        response: `[URBAN MYTH GENERATED]\n\nSeed: "${result.seed}"\n\n── NARRATIVE ──\n${result.narrative}\n\n── DISTORTION ──\n${result.distorted}\n\nArchetypes Extracted: ${result.archetypes.join(', ') || 'None'}`,
        mythResult: result,
      });
    } catch (err) {
      return res.status(500).json({ error: `Myth engine error: ${err.message}` });
    }
  }

  // Handle other commands
  if (trimmed === ':help') {
    return res.json({
      response: `BWB Assistant Commands:\n  :myth "seed"       Generate street-level myth and archetypes\n  :myth archetypes   List all cached archetypes\n  :myth reset        Clear archetype cache\n  :files             List workspace files\n  :help              Show this help menu`,
    });
  }

  if (trimmed === ':files') {
    const files = getWorkspaceFiles();
    return res.json({
      response: `Workspace files (${files.length}):\n${files.map(f => `  ${f}`).join('\n')}`,
    });
  }

  // If myth engine toggle is active and user didn't write code question, can generate myth or respond in myth tone
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      response: `[BWB Offline Mode] System received your message: "${message}".\n\nTo enable full real-time Gemini generation, configure GEMINI_API_KEY in your settings. (Tone: ${tone}, Verbosity: ${verbosity}, Myth Engine: ${useMythEngine ? 'Active' : 'Inactive'}).`,
    });
  }

  try {
    let toneInstruction = "Be concise, technical, and action-oriented.";
    if (tone === 'gritty') toneInstruction = "Be gritty, street-smart, and deeply technical with no corporate fluff.";
    else if (tone === 'urban_myth') toneInstruction = "Infuse responses with subtle urban myth elements, surreal technical metaphors, and concrete code.";
    else if (tone === 'sarcastic') toneInstruction = "Be mildly sarcastic and dry-witted while providing accurate and sharp technical code.";

    const systemPrompt = `You are the BWB (Build While Bleeding) Code Assistant.
${toneInstruction}
Verbosity level: ${verbosity}/10 (adjust length and depth accordingly).
${useMythEngine ? "Urban Myth Engine is active: keep track of underlying architectural patterns and archetypes." : ""}
Always provide correct, executable code blocks and concise technical analysis.`;

    // Construct contents
    const contents = [];

    // Append context files if requested
    let fileContextText = "";
    if (Array.isArray(contextFiles) && contextFiles.length > 0) {
      for (const f of contextFiles) {
        try {
          const full = path.resolve(process.cwd(), f);
          if (fs.existsSync(full)) {
            const str = fs.readFileSync(full, 'utf8').slice(0, 8000);
            fileContextText += `\n--- FILE: ${f} ---\n${str}\n--- END FILE ---`;
          }
        } catch (_) {}
      }
    }

    // Format chat history
    for (const h of history.slice(-6)) {
      if (h.role && h.content) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        });
      }
    }

    const finalUserText = fileContextText ? `${fileContextText}\n\nUser request: ${message}` : message;
    contents.push({
      role: 'user',
      parts: [{ text: finalUserText }],
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: Math.min(4096, Math.max(512, verbosity * 400)),
      },
    });

    res.json({
      response: result.text || '(No response generated)',
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static assets from studio/dist if exists
const studioDistPath = path.join(__dirname, 'studio', 'dist');
if (fs.existsSync(studioDistPath)) {
  app.use(express.static(studioDistPath));
  app.get('*all', (req, res) => {
    res.sendFile(path.join(studioDistPath, 'index.html'));
  });
} else {
  app.get('*all', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>BWB Studio</title></head>
        <body style="background:#09090b;color:#e4e4e7;font-family:monospace;padding:2rem;text-align:center;">
          <h1>BWB Studio</h1>
          <p>Building studio assets... please refresh in a moment.</p>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BWB Server running on http://0.0.0.0:${PORT}`);
});
