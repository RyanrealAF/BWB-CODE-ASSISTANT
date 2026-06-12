import express from 'express';
import { chat } from './claude.js';
import { getProjectContext } from './context.js';

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

let history = [];

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  history.push({ role: 'user', content: message });

  try {
    const projectContext = await getProjectContext();
    const stream = await chat(projectContext, history);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = "";
    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    
    history.push({ role: 'assistant', content: fullResponse });
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    history.pop(); // Remove user message if chat fails
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
