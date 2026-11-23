// Remembers recent messages per visitor (website session or WhatsApp number).
// In memory only: a restart clears it. Swap for Redis if a client needs persistence.

const TTL_MS = 60 * 60 * 1000; // forget a conversation after 1 hour of silence
const store = new Map();

export function getHistory(id) {
  const s = store.get(id);
  return s ? s.messages : [];
}

export function saveTurn(id, userText, replyText, maxMessages) {
  const messages = [
    ...getHistory(id),
    { role: "user", content: userText },
    { role: "assistant", content: replyText },
  ];
  let trimmed = messages.slice(-maxMessages);
  // Providers require the conversation to start with a user message.
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  store.set(id, { messages: trimmed, updated: Date.now() });
}

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, s] of store) if (s.updated < cutoff) store.delete(id);
}, 10 * 60 * 1000).unref();
