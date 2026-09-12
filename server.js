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

// Telegram calls this whenever a user messages the bot (registered via setWebhook)
app.post('/api/telegram/webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET && req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  try {
    const update = req.body;
    const state = await loadRawState();
    if (!state) return res.sendStatus(200);
    state.meta = state.meta || {};
    state.meta.processedTelegramUpdateIds = state.meta.processedTelegramUpdateIds || [];

    // Idempotency: Telegram retries webhook deliveries on any non-2xx / timeout.
    // update_id is unique per bot, so a seen id means we already handled this event.
    if (update.update_id != null) {
      if (state.meta.processedTelegramUpdateIds.includes(update.update_id)) {
        return res.sendStatus(200);
      }
      state.meta.processedTelegramUpdateIds.push(update.update_id);
      if (state.meta.processedTelegramUpdateIds.length > 1000) {
        state.meta.processedTelegramUpdateIds = state.meta.processedTelegramUpdateIds.slice(-1000);
      }
    }

    const msg = update.message;
    if (msg && typeof msg.text === 'string') {
      if (msg.text.startsWith('/start')) {
        const personId = msg.text.split(' ')[1];
        const person = personId ? state.people.find(p => p.id === personId) : null;
        if (person) {
          person.telegramChatId = msg.chat.id;
          person.updatedAt = new Date().toISOString();
          await notifySafely(msg.chat.id, `You're connected, ${person.name}! You'll now receive action-item follow-ups here.`);
        } else {
          await notifySafely(msg.chat.id, `Couldn't match that link to a person — ask your admin for a fresh connect link.`);
        }
      } else {
        await handleIncomingReply(state, msg);
      }
    }

    await saveRawState(state);
    res.sendStatus(200);
  } catch (e) {
    console.error('Telegram webhook error:', e.message);
    res.sendStatus(200); // 200 so Telegram doesn't retry-storm on our errors
  }
});

// A failure to send the confirmation reply must never lose an already-computed
// state change (task/response linkage, chat-id connection) — so notification
// failures are swallowed here rather than thrown.
async function notifySafely(chatId, text) {
  try {
    await telegramApi('sendMessage', { chat_id: chatId, text });
  } catch (e) {
    console.error('Telegram notify failed (state change still saved):', e.message);
  }
}

// Associate an inbound Telegram message with a task reliably — never by guessing
// keywords in the text. We match on the *specific message being replied to*
// (Telegram's reply_to_message.message_id), which we recorded when the follow-up
// was sent. Only if that's unavailable do we fall back to "the one task this
// person is currently waiting to hear back on" — and if that's ambiguous too,
// we ask the human to reply directly rather than guess.
async function handleIncomingReply(state, msg) {
  const now = new Date().toISOString();
  const chatId = msg.chat.id;
  const text = msg.text;
  const person = state.people.find(p => p.telegramChatId === chatId);

  let item = null;
  if (msg.reply_to_message) {
    const replyId = msg.reply_to_message.message_id;
    const outboxEntry = (state.telegramOutbox || []).find(o => o.chatId === chatId && o.messageId === replyId);
    if (outboxEntry) item = state.items.find(i => i.id === outboxEntry.itemId);
  }
  if (!item && person) {
    const candidates = state.items.filter(i => i.stage === 'Waiting for Response' &&
      (i.ownerId === person.id || (i.stakeholders || []).includes(person.id) || (i.nextStep || []).includes(person.id)));
    if (candidates.length === 1) item = candidates[0];
  }

  if (!item) {
    await notifySafely(chatId, `Thanks — but I couldn't tell which task this relates to. Please reply directly to the specific follow-up message (long-press → Reply) so it's logged against the right task.`);
    return;
  }

  item.telegramLog = item.telegramLog || [];
  item.telegramLog.push({ direction: 'inbound', text, at: now, chatId, messageId: msg.message_id });
  item.telegram = item.telegram || {};
  item.telegram.lastResponse = text;
  item.telegram.lastResponseAt = now;
  item.telegram.status = 'Response Received';
  item.history = item.history || [];

  const oldStage = item.stage;
  if (oldStage === 'Waiting for Response') {
    // Deliberately a safe intermediate stage, not auto-"Completed" — a human confirms completion.
    item.stage = 'Response Received';
    item.history.push({
      ts: now, field: 'stage', oldValue: oldStage, newValue: 'Response Received',
      actor: person ? person.name : 'Telegram', source: 'telegram',
    });
  }
  item.updatedAt = now;

  await notifySafely(chatId, `Got it — logged your response on "${String(item.actionItem).slice(0, 80)}". Thanks!`);
}

// Personal connect link for a given person id
app.get('/api/telegram/link/:personId', (req, res) => {
  if (!TELEGRAM_BOT_USERNAME) return res.status(500).json({ error: 'TELEGRAM_BOT_USERNAME not configured' });
  res.json({ url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(req.params.personId)}` });
});

// Send a follow-up for one task to its owner/stakeholders/next-step-owners who have Telegram connected.
// Moves the task to "Waiting for Response" and records the sent message's id so a reply can be matched back.
app.post('/api/telegram/send-followup', async (req, res) => {
  try {
    const { itemId, text } = req.body;
    const state = await loadRawState();
    if (!state) return res.status(404).json({ error: 'No state found' });
    const item = state.items.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const assignedIds = [...new Set([item.ownerId, ...(item.stakeholders || []), ...(item.nextStep || [])].filter(Boolean))];
    const people = assignedIds.map(id => state.people.find(p => p.id === id)).filter(Boolean);
    const connected = people.filter(p => p.telegramChatId);
    const unconnected = people.filter(p => !p.telegramChatId);

    const now = new Date().toISOString();
    item.telegram = item.telegram || {};
    item.telegramLog = item.telegramLog || [];
    item.history = item.history || [];
    state.telegramOutbox = state.telegramOutbox || [];

    // Send one at a time; a failure for one recipient (e.g. they blocked the bot)
    // must not lose the state already recorded for recipients who succeeded.
    const sent = [], failed = [];
    for (const p of connected) {
      try {
        const result = await telegramApi('sendMessage', { chat_id: p.telegramChatId, text });
        state.telegramOutbox.push({ chatId: p.telegramChatId, messageId: result.message_id, itemId: item.id, sentAt: now });
        item.telegramLog.push({ direction: 'outbound', text, at: now, chatId: p.telegramChatId, messageId: result.message_id });
        item.telegram.lastOutboundMessageId = result.message_id;
        item.telegram.lastOutboundChatId = p.telegramChatId;
        sent.push(p);
      } catch (e) {
        console.error(`Telegram send to ${p.name} failed:`, e.message);
        failed.push(p);
      }
    }
    if (state.telegramOutbox.length > 3000) state.telegramOutbox = state.telegramOutbox.slice(-3000);

    if (sent.length) {
      item.telegram.lastMessage = text;
      item.telegram.lastMessageAt = now;
      item.telegram.status = 'Waiting for Response';
      const oldStage = item.stage;
      if (oldStage !== 'Waiting for Response' && oldStage !== 'Completed' && oldStage !== 'Cancelled') {
        item.stage = 'Waiting for Response';
        item.history.push({ ts: now, field: 'stage', oldValue: oldStage, newValue: 'Waiting for Response', actor: 'Telegram follow-up', source: 'system' });
      }
      item.updatedAt = now;
    }

    await saveRawState(state);
    res.json({ sentTo: sent.map(p => p.name), skipped: [...unconnected, ...failed].map(p => p.name), state });
  } catch (e) {
    console.error('POST /api/telegram/send-followup failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Action tracker server listening on ${PORT}`));
