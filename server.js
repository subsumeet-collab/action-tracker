const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY = 'action-tracker:state';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Explicit, exact-match keywords a person can send to move a task to a specific
// stage. Deliberately NOT a substring/contains match against free text — the
// whole message (after stripping an optional "#taskId" tag) must equal one of
// these keywords exactly. Anything else is logged as a plain response, never
// guessed into a stage. Add/edit keywords here — never hardcode this deeper.
const TELEGRAM_KEYWORD_STAGE = {
  'done': 'Completed', 'complete': 'Completed', 'completed': 'Completed',
  'in progress': 'In Progress', 'started': 'In Progress', 'wip': 'In Progress',
  'blocked': 'Blocked', 'stuck': 'Blocked',
  'cancelled': 'Cancelled', 'canceled': 'Cancelled',
};

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
          await notifySafely(msg.chat.id, `You're connected, ${person.name}! You'll now receive action-item follow-ups here.\n\nReply "done", "in progress", "blocked", etc. to a follow-up to update its stage, or send /tasks anytime to see your open tasks and their #IDs.`);
        } else {
          await notifySafely(msg.chat.id, `Couldn't match that link to a person — ask your admin for a fresh connect link.`);
        }
      } else if (msg.text.startsWith('/tasks')) {
        await sendTaskList(state, msg.chat.id);
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

async function sendTaskList(state, chatId) {
  const person = state.people.find(p => p.telegramChatId === chatId);
  if (!person) {
    await notifySafely(chatId, `You're not connected to a profile yet — use the connect link your admin sent you first.`);
    return;
  }
  const mine = state.items.filter(i =>
    !['Completed', 'Cancelled'].includes(i.stage) &&
    (i.ownerId === person.id || (i.stakeholders || []).includes(person.id) || (i.nextStep || []).includes(person.id)));
  if (!mine.length) {
    await notifySafely(chatId, `You have no open tasks. 🎉`);
    return;
  }
  const lines = mine.map(i => `#${i.id} — ${i.actionItem} (${i.stage})`);
  await notifySafely(chatId,
    `Your open tasks:\n\n${lines.join('\n')}\n\nSend "#taskId done" (or "in progress" / "blocked" / "cancelled") to update one, e.g. "#${mine[0].id} done".`);
}

// Associate an inbound Telegram message with a task reliably — never by guessing
// which task from arbitrary text. Three ways, tried in order, all explicit:
//  1. The message contains a "#taskId" tag (works whether or not it's a reply) —
//     this is the "specific format" for updating a task without replying to a
//     particular follow-up message.
//  2. It's a reply to a specific follow-up message we sent (Telegram's
//     reply_to_message.message_id, recorded when that follow-up went out).
//  3. Otherwise, only if this person has exactly one task currently
//     "Waiting for Response" — if that's ambiguous too, we ask them to be
//     explicit rather than guess.
//
// Once the task is known, the stage is changed automatically ONLY if the
// message (with any #tag removed) is an EXACT match for one of
// TELEGRAM_KEYWORD_STAGE's keywords (e.g. "done", "blocked") — never inferred
// from a sentence. Anything else is still logged as a response and, if the
// task was "Waiting for Response", moved to the safe "Response Received"
// stage for a human to confirm.
async function handleIncomingReply(state, msg) {
  const now = new Date().toISOString();
  const chatId = msg.chat.id;
  const text = msg.text;
  const person = state.people.find(p => p.telegramChatId === chatId);

  let item = null, remainder = text;
  const tagMatch = text.match(/#([A-Za-z0-9_-]+)/);
  if (tagMatch) {
    const tagId = tagMatch[1];
    item = state.items.find(i => i.id === tagId) || state.items.find(i => i.id.toLowerCase() === tagId.toLowerCase());
    remainder = (text.slice(0, tagMatch.index) + text.slice(tagMatch.index + tagMatch[0].length)).trim();
    if (!item) {
      await notifySafely(chatId, `I couldn't find a task with ID "${tagId}". Send /tasks to see your open tasks and their IDs.`);
      return;
    }
  }
  if (!item && msg.reply_to_message) {
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
    await notifySafely(chatId, `Thanks — but I couldn't tell which task this relates to. Reply directly to the specific follow-up message, or send "#taskId done" (see /tasks for your task IDs).`);
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
  const actor = person ? person.name : 'Telegram';
  const explicitStage = TELEGRAM_KEYWORD_STAGE[remainder.trim().toLowerCase()];

  let confirmation;
  if (explicitStage && explicitStage !== oldStage) {
    item.stage = explicitStage;
    item.history.push({ ts: now, field: 'stage', oldValue: oldStage, newValue: explicitStage, actor, source: 'telegram' });
    if (explicitStage === 'Completed') item.completedAt = now;
    if (explicitStage === 'Cancelled') item.cancelledAt = now;
    confirmation = `Marked "${String(item.actionItem).slice(0, 80)}" as ${explicitStage}.`;
  } else if (oldStage === 'Waiting for Response') {
    // Deliberately a safe intermediate stage, not auto-"Completed" — a human confirms completion.
    item.stage = 'Response Received';
    item.history.push({ ts: now, field: 'stage', oldValue: oldStage, newValue: 'Response Received', actor, source: 'telegram' });
    confirmation = `Got it — logged your response on "${String(item.actionItem).slice(0, 80)}". Thanks!`;
  } else {
    confirmation = `Got it — logged your response on "${String(item.actionItem).slice(0, 80)}". Thanks!`;
  }
  item.updatedAt = now;

  await notifySafely(chatId, confirmation);
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
