import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Configure CORS allowlist (supports comma-separated env CORS_ORIGINS)
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const corsOrigins = [...defaultOrigins, ...extraOrigins];
app.use(cors({ origin: corsOrigins, credentials: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// naive in-memory rate limit: 10/min/IP
const rlBucket = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const entry = rlBucket.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  rlBucket.set(ip, entry);
  return entry.count > max;
}

app.post('/session', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (rateLimited(ip)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
    }

    const { model = 'gpt-realtime', voice = 'marin' } = req.body || {};

    // Prefer session envelope for forward compatibility
    const body = {
      session: {
        type: 'realtime',
        model,
        voice,
        modalities: ['text', 'audio']
        // Tools are handled client-side for the demo via Agents SDK tool handler
      }
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
