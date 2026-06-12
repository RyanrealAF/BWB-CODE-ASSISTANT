import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import ArchetypeCache from './engine/archetype-cache.js';

const app = express();
const port = 3000;
const archetypes = new ArchetypeCache();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/myth', (req, res) => {
  const { seed } = req.body;

  if (!seed) {
    return res.status(400).json({ error: 'Seed is required' });
  }

  exec(`node index.js myth "${seed}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Failed to generate myth' });
    }
    res.json({ myth: stdout });
  });
});

app.get('/api/archetypes', async (req, res) => {
  try {
    const allArchetypes = await archetypes.getArchetypes();
    res.json(allArchetypes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get archetypes' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
