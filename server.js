const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY = 'action-tracker:state';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

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

async function telegramApi(method, params) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API error: ${data.description}`);
  return data.result;
}

async function loadRawState() {
  const { result } = await upstash('GET', STATE_KEY);
  return result ? JSON.parse(result) : null;
}
async function saveRawState(state) {
  await upstash('SET', STATE_KEY, JSON.stringify(state));
}

// Telegram calls this when a user messages the bot (registered via setWebhook)
app.post('/api/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET && req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  try {
    const msg = req.body.message;
    if (msg && typeof msg.text === 'string' && msg.text.startsWith('/start')) {
      const personId = msg.text.split(' ')[1];
      const state = await loadRawState();
      const person = state && personId ? state.people.find(p => p.id === personId) : null;
      if (person) {
        person.telegramChatId = msg.chat.id;
        await saveRawState(state);
        await telegramApi('sendMessage', {
          chat_id: msg.chat.id,
          text: `You're connected, ${person.name}! You'll now receive action-item follow-ups here.`,
        });
      } else {
        await telegramApi('sendMessage', {
          chat_id: msg.chat.id,
          text: `Couldn't match that link to a person — ask your admin for a fresh connect link.`,
        });
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('Telegram webhook error:', e.message);
    res.sendStatus(200); // 200 so Telegram doesn't retry-storm on our errors
  }
});

// Personal connect link for a given person id
app.get('/api/telegram/link/:personId', (req, res) => {
  if (!TELEGRAM_BOT_USERNAME) return res.status(500).json({ error: 'TELEGRAM_BOT_USERNAME not configured' });
  res.json({ url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(req.params.personId)}` });
});

// Send a follow-up for one item to everyone assigned who has Telegram connected
app.post('/api/telegram/send-followup', async (req, res) => {
  try {
    const { itemId, text } = req.body;
    const state = await loadRawState();
    if (!state) return res.status(404).json({ error: 'No state found' });
    const item = state.items.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const assignedIds = [...new Set([...(item.stakeholders || []), ...(item.nextStep || [])])];
    const people = assignedIds.map(id => state.people.find(p => p.id === id)).filter(Boolean);
    const connected = people.filter(p => p.telegramChatId);
    const unconnected = people.filter(p => !p.telegramChatId);

    for (const p of connected) {
      await telegramApi('sendMessage', { chat_id: p.telegramChatId, text });
    }

    item.lastFollowUp = new Date().toISOString().slice(0, 10);
    await saveRawState(state);

    res.json({ sentTo: connected.map(p => p.name), skipped: unconnected.map(p => p.name) });
  } catch (e) {
    console.error('POST /api/telegram/send-followup failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Action tracker server listening on ${PORT}`));
