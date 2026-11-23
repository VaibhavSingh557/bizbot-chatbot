import "dotenv/config";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import config from "../business.config.js";
import { buildSystemPrompt } from "./prompt.js";
import { generateReply } from "./ai.js";
import { getHistory, saveTurn } from "./sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const { maxHistoryTurns, maxMessageChars, rateLimitPerMinute } = config.limits;

const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  express.json({
    limit: "50kb",
    // Keep the raw bytes: WhatsApp signatures are computed over them.
    verify: (req, _res, buf) => { req.rawBody = buf; },
  })
);

/* ------------------------------ helpers -------------------------------- */

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "content-type");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const rec = hits.get(req.ip);
  if (!rec || rec.reset < now) {
    hits.set(req.ip, { count: 1, reset: now + 60_000 });
    return next();
  }
  if (++rec.count > rateLimitPerMinute) {
    return res.status(429).json({ error: "Too many messages. Please wait a minute." });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of hits) if (r.reset < now) hits.delete(ip);
}, 60_000).unref();

// Shared by the website widget and WhatsApp.
async function answer(sessionId, text) {
  const messages = [...getHistory(sessionId), { role: "user", content: text }];
  // Rebuilt each time so the bot always knows the current day and time.
  const reply = await generateReply(messages, buildSystemPrompt(config));
  saveTurn(sessionId, text, reply, maxHistoryTurns);
  return reply;
}

/* --------------------------- website widget API ------------------------- */

app.use("/api", cors, rateLimit);

app.get("/api/config", (_req, res) => {
  const { brand, business } = config;
  res.json({
    name: brand.name,
    color: brand.color,
    greeting: brand.greeting,
    quickReplies: brand.quickReplies || [],
    botName: config.bot.name,
    phone: business.phone || "",
  });
});

app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (typeof sessionId !== "string" || !/^[\w-]{8,64}$/.test(sessionId)) {
    return res.status(400).json({ error: "Invalid session." });
  }
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return res.status(400).json({ error: "Message is empty." });
  if (text.length > maxMessageChars) {
    return res.status(400).json({ error: `Message is too long (max ${maxMessageChars} characters).` });
  }
  try {
    res.json({ reply: await answer(`web:${sessionId}`, text) });
  } catch (err) {
    console.error("[chat]", err.message);
    res.status(502).json({ error: config.bot.fallback });
  }
});

app.post("/api/lead", async (req, res) => {
  const { name, contact, message } = req.body || {};
  const clean = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const lead = {
    name: clean(name, 100),
    contact: clean(contact, 120),
    message: clean(message, 1000),
    time: new Date().toISOString(),
  };
  if (!lead.name || !lead.contact) {
    return res.status(400).json({ error: "Please enter your name and a phone number or email." });
  }
  try {
    await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
    await fs.appendFile(path.join(ROOT, "data", "leads.jsonl"), JSON.stringify(lead) + "\n");
  } catch (err) {
    console.error("[lead:file]", err.message);
  }
  if (process.env.LEAD_WEBHOOK_URL) {
    fetch(process.env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ business: config.brand.name, ...lead }),
      signal: AbortSignal.timeout(10_000),
    }).catch((err) => console.error("[lead:webhook]", err.message));
  }
  res.json({ ok: true });
});

/* ------------------------------ WhatsApp -------------------------------- */

const seen = new Map(); // Meta retries webhooks, so remember message ids briefly
function isDuplicate(id) {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 10 * 60_000) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

function validSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // development only: set WHATSAPP_APP_SECRET in production
  const header = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sendWhatsApp(to, body) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.slice(0, 4000) },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) console.error("[whatsapp:send]", res.status, (await res.text()).slice(0, 200));
}

// Meta calls this once when you register the webhook.
app.get("/webhook", (req, res) => {
  const ok =
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN;
  if (ok) return res.status(200).send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // reply to Meta immediately, work in the background

  const messages = (req.body?.entry || [])
    .flatMap((e) => e.changes || [])
    .flatMap((c) => c.value?.messages || []);

  for (const msg of messages) {
    if (!msg.id || isDuplicate(msg.id)) continue;
    handleWhatsApp(msg).catch((err) => console.error("[whatsapp]", err.message));
  }
});

async function handleWhatsApp(msg) {
  const to = msg.from;
  if (msg.type !== "text" || !msg.text?.body) {
    return sendWhatsApp(to, "Thanks! I can only read text messages for now. How can I help?");
  }
  const text = msg.text.body.trim().slice(0, maxMessageChars);
  let reply;
  try {
    reply = await answer(`wa:${to}`, text);
  } catch (err) {
    console.error("[whatsapp:ai]", err.message);
    reply = config.bot.fallback;
  }
  await sendWhatsApp(to, reply);
}

/* ------------------------------ static + boot --------------------------- */

/* ------------------------------ leads page ------------------------------ */

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function sameSecret(given, secret) {
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(String(secret)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Private page for the business owner. Off unless ADMIN_TOKEN is set.
app.get("/admin/leads", rateLimit, async (req, res) => {
  const secret = process.env.ADMIN_TOKEN;
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" });
  if (!secret) return res.status(404).send("Not enabled");
  if (!sameSecret(req.query.token || "", secret)) return res.status(401).send("Unauthorized");

  let rows = [];
  try {
    const raw = await fs.readFile(path.join(ROOT, "data", "leads.jsonl"), "utf8");
    rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)).reverse();
  } catch { /* no leads yet */ }

  const body = rows.length
    ? rows.map((r) => `<tr><td>${esc(r.time.slice(0, 16).replace("T", " "))}</td><td>${esc(r.name)}</td><td>${esc(r.contact)}</td><td>${esc(r.message)}</td></tr>`).join("")
    : '<tr><td colspan="4">No leads yet.</td></tr>';
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Leads</title><style>body{font-family:system-ui,sans-serif;margin:16px;color:#111}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
th{background:#f3f4f6}.w{overflow-x:auto}</style>
<h1>${esc(config.brand.name)} leads (${rows.length})</h1>
<div class="w"><table><tr><th>Time (UTC)</th><th>Name</th><th>Contact</th><th>Message</th></tr>${body}</table></div>`);
});

app.get("/health", (_req, res) => res.json({ ok: true, version: VERSION }));
app.use(express.static(path.join(ROOT, "public")));

app.listen(PORT, () => {
  console.log(`${config.brand.name} bot v${VERSION} running on http://localhost:${PORT}`);
  if (!process.env.AI_API_KEY) console.warn("Warning: AI_API_KEY is not set. Chat replies will fail.");
  if (process.env.WHATSAPP_TOKEN && !process.env.WHATSAPP_APP_SECRET) {
    console.warn("Warning: WHATSAPP_APP_SECRET is not set. Webhook signatures are not being checked.");
  }
});
