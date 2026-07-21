const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY = 'action-tracker:state';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

async function upstash(...command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not configured');
  }
  const url = `${UPSTASH_URL}/${command.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!res.ok) throw new Error(`Upstash error ${res.status}: ${await res.text()}`);
  return res.json();
}

app.get('/api/state', async (req, res) => {
  try {
    const { result } = await upstash('GET', STATE_KEY);
    res.json(result ? JSON.parse(result) : null);
  } catch (e) {
    console.error('GET /api/state failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    await upstash('SET', STATE_KEY, JSON.stringify(req.body));
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/state failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Action tracker server listening on ${PORT}`));
