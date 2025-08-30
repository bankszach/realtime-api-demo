import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toolDefinitions } from './tools.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  credentials: true
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/session', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
    }

    const { model = 'gpt-realtime', voice = 'marin' } = req.body || {};

    const body = {
      model,
      voice,
      modalities: ['text', 'audio'],
      // Expose a trivial tool that the agent can call.
      tools: toolDefinitions
    };

    const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: 'Failed to create client secret', details: errText });
    }

    const data = await resp.json();
    const value = data?.client_secret?.value;
    if (!value) {
      return res.status(500).json({ error: 'No client_secret.value in response' });
    }

    // Return only the ephemeral client secret value to the client
    res.json({ client_secret: value, model, voice });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', details: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Auth service listening on http://localhost:${PORT}`);
});

