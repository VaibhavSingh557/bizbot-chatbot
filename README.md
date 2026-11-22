# BizBot

An AI chatbot for a business website and WhatsApp. One config file holds the business details, and the bot answers only from that file.

- Website chat widget (one script tag, themed with the brand colour)
- WhatsApp Cloud API bot (same brain, same config)
- Lead capture ("leave your details") saved to a file and optionally sent to Zapier, Make, Slack or n8n
- Works with Claude, OpenAI, or any OpenAI-compatible provider
- Two dependencies: `express` and `dotenv`

## 1. Run it

Needs Node 18 or newer.

```bash
npm install
cp .env.example .env        # then add your AI key
npm start
```

Open http://localhost:3000 and click the chat bubble.

## 2. Customise for a client

Edit `business.config.js`. This is the only file that changes per client:

| Section | What it controls |
| --- | --- |
| `brand` | Name, colour, greeting, quick-reply buttons in the widget |
| `business` | Address, phone, hours, services and prices, FAQs, policies |
| `bot` | Bot name, tone, extra rules, what to say when it does not know |
| `limits` | Memory length, max message size, rate limit |

Restart the server after editing. Keep the facts accurate: the bot is told never to invent prices, times or policies.

## 3. Add it to a website

Paste before `</body>` on any page:

```html
<script src="https://YOUR-SERVER/widget.js" defer></script>
```

Then add that website's address to `ALLOWED_ORIGINS` in `.env`, for example:

```
ALLOWED_ORIGINS=https://sunrisedental.example,https://www.sunrisedental.example
```

## 4. Connect WhatsApp (optional)

1. Create an app at developers.facebook.com and add the **WhatsApp** product.
2. Copy the **temporary or permanent access token** into `WHATSAPP_TOKEN` and the **Phone number ID** into `WHATSAPP_PHONE_NUMBER_ID`.
3. Copy **App secret** (App settings, Basic) into `WHATSAPP_APP_SECRET`.
4. Choose any random string for `WHATSAPP_VERIFY_TOKEN`.
5. Deploy the server on a public HTTPS URL (see below).
6. In WhatsApp, Configuration, set the callback URL to `https://YOUR-SERVER/webhook`, enter the same verify token, and subscribe to the **messages** field.
7. Message your WhatsApp number. The bot replies.

Notes: a permanent token needs a System User in Meta Business settings. Customers can message you freely for 24 hours after their last message. Starting a conversation yourself requires an approved message template, which this kit does not send.

## 5. Deploy

Any Node host works (Render, Railway, Fly.io, a VPS).

- Start command: `npm start`
- Set every variable from `.env` in the host's dashboard
- Set `TRUST_PROXY=1` when the host sits behind a proxy
- Leads are written to `data/leads.jsonl`. Many hosts wipe local files on redeploy, so set `LEAD_WEBHOOK_URL` for anything important.

## How it fits together

```
business.config.js -> src/prompt.js -> system prompt
Website widget  -> POST /api/chat --\
                                     >-> src/server.js -> src/ai.js -> AI provider
WhatsApp        -> POST /webhook  --/
```

| File | Purpose |
| --- | --- |
| `src/server.js` | Routes: chat, leads, WhatsApp webhook, static files |
| `src/ai.js` | Calls Claude or an OpenAI-compatible API |
| `src/prompt.js` | Builds the instructions from the config |
| `src/sessions.js` | Short-term memory per visitor (in memory, expires after 1 hour) |
| `public/widget.js` | The embeddable chat widget |

## Security notes

- The AI key stays on the server. It is never sent to the browser.
- Set `ALLOWED_ORIGINS` to the client's real domains before going live.
- Set `WHATSAPP_APP_SECRET` in production so fake webhook calls are rejected.
- Messages are limited in size and each IP is rate limited.
- Conversations are kept in memory only and are not written to disk. Tell clients which provider processes their customers' messages and check it fits their privacy policy.

## Ideas for extending it

- Persist conversations with Redis or a database (`src/sessions.js`)
- Send leads by email (add `nodemailer` in the `/api/lead` route)
- Add a human handoff: forward the chat to a staff WhatsApp number
- Load services and FAQs from a Google Sheet so clients can update them
- 
