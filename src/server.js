// One function: generateReply(messages, system) -> string
// Works with Anthropic, OpenAI, and any OpenAI-compatible API.

const TIMEOUT_MS = 30_000;

export class AIError extends Error {}

export async function generateReply(messages, system) {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) throw new AIError("AI_API_KEY and AI_MODEL must be set in .env");

  if (provider === "anthropic") return callAnthropic({ key, model, messages, system });
  if (provider === "openai") return callOpenAI({ key, model, messages, system });
  throw new AIError(`Unknown AI_PROVIDER "${provider}". Use "anthropic" or "openai".`);
}

async function callAnthropic({ key, model, messages, system }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 500, system, messages }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await parse(res);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new AIError("Empty reply from provider");
  return text;
}

async function callOpenAI({ key, model, messages, system }) {
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await parse(res);
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIError("Empty reply from provider");
  return text;
}

async function parse(res) {
  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { /* keep raw for the error below */ }
  if (!res.ok) {
    const msg = data.error?.message || data.message || raw.slice(0, 200);
    throw new AIError(`Provider error ${res.status}: ${msg}`);
  }
  return data;
}
