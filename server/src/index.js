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

    const { model = 'gpt-4o-realtime-preview', voice = 'marin' } = req.body || {};

    // Create a Realtime session (returns an ephemeral client_secret)
    const endpoint = 'https://api.openai.com/v1/realtime/sessions';
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ['text', 'audio']
      })
    });

    const text = await upstream.text();
    console.log('[sessions] status', upstream.status, text.slice(0, 200));

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'sessions_failed', details: text.slice(0, 300) });
    }

    let data;
    try { data = JSON.parse(text); } catch (_) { data = {}; }

    const value = (typeof data?.client_secret === 'string')
      ? data.client_secret
      : (data?.client_secret?.value || data?.value);

    if (!value) return res.status(500).json({ error: 'missing_client_secret' });

    res.json({ client_secret: value, model, voice });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', details: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Auth service listening on http://localhost:${PORT}`);
});
