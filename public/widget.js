/*
 * Embed on any website with one line, before </body>:
 *   <script src="https://YOUR-SERVER/widget.js" defer></script>
 * Optional: data-api="https://YOUR-SERVER" if the script is hosted elsewhere.
 * Colours, name, greeting and quick replies come from business.config.js.
 */
(function () {
  if (window.__bizbot) return;
  window.__bizbot = true;

  var script = document.currentScript;
  var API = (script && script.dataset.api) || (script && script.src && new URL(script.src).origin) || "";

  var sid;
  try { sid = localStorage.getItem("bizbot_sid"); } catch (e) {}
  if (!sid) {
    sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "s" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem("bizbot_sid", sid); } catch (e) {}
  }

  function post(path, body) {
    return fetch(API + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || "Something went wrong.");
        return j;
      });
    });
  }

  fetch(API + "/api/config").then(function (r) { return r.json(); }).then(init).catch(function () {});

  function readable(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16) || 0;
    var l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.6 ? "#111827" : "#ffffff";
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") el.textContent = attrs[k];
      else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }

  // Turns links and emails into safe anchors without using innerHTML.
  function linkify(el, text) {
    var re = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g, last = 0, m;
    while ((m = re.exec(text))) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var raw = m[0].replace(/[.,;:!?)]+$/, "");
      var href = raw.indexOf("@") > -1 && raw.indexOf("http") !== 0 ? "mailto:" + raw : raw;
      el.appendChild(h("a", { href: href, target: "_blank", rel: "noopener noreferrer", text: raw }));
      last = m.index + raw.length;
      re.lastIndex = last;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
  }

  var CSS = [
    ":host{all:initial;font-family:inherit}",
    "*{box-sizing:border-box;font-family:inherit}",
    ".launcher{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;",
    "background:var(--c);color:var(--on);box-shadow:0 6px 20px rgba(0,0,0,.22);display:grid;place-items:center;z-index:2147483000;transition:transform .2s}",
    ".launcher:hover{transform:scale(1.06)}",
    ".launcher:focus-visible,.send:focus-visible,.chip:focus-visible,.x:focus-visible,.link:focus-visible{outline:3px solid var(--c);outline-offset:2px}",
    ".teaser{position:fixed;right:90px;bottom:34px;max-width:240px;background:#fff;color:#111827;padding:10px 14px;border-radius:14px 14px 4px 14px;",
    "font-size:14px;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.18);z-index:2147483000;cursor:pointer;animation:in .4s both}",
    ".panel{position:fixed;right:20px;bottom:90px;width:370px;height:min(560px,calc(100vh - 110px));background:#fff;color:#111827;",
    "border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:2147483001}",
    ".panel.open{display:flex;animation:in .25s both}",
    "@keyframes in{from{opacity:0;transform:translateY(10px) scale(.97)}}",
    ".head{background:var(--c);color:var(--on);padding:14px 16px;display:flex;align-items:center;gap:10px}",
    ".head b{font-size:16px;display:block;line-height:1.2}.head small{opacity:.85;font-size:12px}",
    ".grow{flex:1}.x{background:transparent;border:0;color:inherit;font-size:22px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:8px}",
    ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f9fafb}",
    ".m{max-width:85%;padding:9px 13px;border-radius:16px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;animation:in .2s both}",
    ".m a{color:inherit;text-decoration:underline}",
    ".bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:4px}",
    ".me{align-self:flex-end;background:var(--c);color:var(--on);border-bottom-right-radius:4px}",
    ".err{align-self:flex-start;color:#b91c1c;font-size:13px}",
    ".dots{display:flex;gap:4px;padding:12px 14px}.dots i{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:b 1s infinite}",
    ".dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}",
    "@keyframes b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}",
    ".chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:#f9fafb}",
    ".chip{border:1px solid var(--c);color:var(--c);background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer}",
    ".chip:hover{background:var(--c);color:var(--on)}",
    ".bar{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}",
    ".bar input{flex:1;border:1px solid #d1d5db;border-radius:12px;padding:10px 12px;font-size:15px;outline:0;color:#111827;background:#fff}",
    ".bar input:focus,.form input:focus,.form textarea:focus{border-color:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 25%,transparent)}",
    ".send{border:0;background:var(--c);color:var(--on);border-radius:12px;padding:0 16px;font-size:15px;cursor:pointer}",
    ".send:disabled{opacity:.5;cursor:default}",
    ".foot{padding:0 12px 10px;background:#fff;text-align:center}",
    ".link{background:none;border:0;color:#6b7280;font-size:12px;text-decoration:underline;cursor:pointer}",
    ".form{padding:16px;display:none;flex-direction:column;gap:10px;flex:1;background:#fff;overflow-y:auto}",
    ".form.show{display:flex}.form label{font-size:13px;color:#374151}",
    ".form input,.form textarea{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:10px;font-size:15px;outline:0;margin-top:4px;color:#111827;background:#fff}",
    ".form textarea{min-height:90px;resize:vertical}",
    "@media (max-width:480px){.panel{right:0;bottom:0;width:100%;height:100%;border-radius:0}.teaser{display:none}}",
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}",
  ].join("");

  function init(cfg) {
    var host = h("div");
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(h("style", { text: CSS }));
    host.style.setProperty("--c", cfg.color || "#0f766e");
    host.style.setProperty("--on", readable(cfg.color || "#0f766e"));

    var log = h("div", { class: "log", "aria-live": "polite" });
    var chips = h("div", { class: "chips" });
    var input = h("input", { type: "text", placeholder: "Type your message", "aria-label": "Your message", maxlength: "1000" });
    var send = h("button", { class: "send", type: "button", text: "Send" });
    var busy = false;
    var saved = [];
    try { saved = JSON.parse(sessionStorage.getItem("bizbot_log") || "[]"); } catch (e) {}
    function persist() { try { sessionStorage.setItem("bizbot_log", JSON.stringify(saved.slice(-40))); } catch (e) {} }

    function addMsg(cls, text, replay) {
      if (!replay && cls !== "err") { saved.push({ cls: cls, text: text }); persist(); }
      var m = h("div", { class: "m " + cls });
      linkify(m, text);
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
      return m;
    }

    function ask(text) {
      text = (text || "").trim();
      if (!text || busy) return;
      busy = true; send.disabled = true; input.value = ""; chips.style.display = "none";
      addMsg("me", text);
      var dots = h("div", { class: "m bot dots" }, [h("i"), h("i"), h("i")]);
      log.appendChild(dots); log.scrollTop = log.scrollHeight;
      post("/api/chat", { sessionId: sid, message: text })
        .then(function (r) { dots.remove(); addMsg("bot", r.reply); })
        .catch(function (e) { dots.remove(); addMsg("err", e.message); })
        .then(function () { busy = false; send.disabled = false; input.focus(); });
    }

    if (saved.length) {
      saved.forEach(function (m) { addMsg(m.cls, m.text, true); });
      chips.style.display = "none";
    } else {
      addMsg("bot", cfg.greeting);
    }
    (cfg.quickReplies || []).forEach(function (q) {
      chips.appendChild(h("button", { class: "chip", type: "button", text: q, onclick: function () { ask(q); } }));
    });

    // Lead form
    var fName = h("input", { type: "text", autocomplete: "name", maxlength: "100" });
    var fContact = h("input", { type: "text", autocomplete: "email", maxlength: "120" });
    var fMsg = h("textarea", { maxlength: "1000" });
    var fStatus = h("div", { class: "m", "aria-live": "polite", style: "background:none;padding:0;font-size:13px" });
    var form = h("div", { class: "form" }, [
      h("b", { text: "Leave your details" }),
      h("label", { text: "Name" }, [fName]),
      h("label", { text: "Phone or email" }, [fContact]),
      h("label", { text: "How can we help?" }, [fMsg]),
      h("button", { class: "send", type: "button", style: "padding:11px", text: "Send details", onclick: function () {
        fStatus.textContent = "";
        post("/api/lead", { name: fName.value, contact: fContact.value, message: fMsg.value })
          .then(function () { fStatus.textContent = "Thanks, we will be in touch soon."; fName.value = fContact.value = fMsg.value = ""; })
          .catch(function (e) { fStatus.textContent = e.message; });
      } }),
      fStatus,
      h("button", { class: "link", type: "button", text: "Back to chat", onclick: function () { showForm(false); } }),
    ]);

    var chatView = [log, chips];
    var barEl = h("div", { class: "bar" }, [input, send]);
    var footEl = h("div", { class: "foot" }, [
      h("button", { class: "link", type: "button", text: "Prefer a callback? Leave your details", onclick: function () { showForm(true); } }),
    ]);
    function showForm(on) {
      form.classList.toggle("show", on);
      chatView.concat([barEl, footEl]).forEach(function (e) { e.style.display = on ? "none" : ""; });
      if (!on) input.focus();
    }

    var panel = h("div", { class: "panel", role: "dialog", "aria-label": "Chat with " + cfg.name }, [
      h("div", { class: "head" }, [
        h("div", { class: "grow" }, [h("b", { text: cfg.name }), h("small", { text: "Chat with " + cfg.botName })]),
        h("button", { class: "x", type: "button", "aria-label": "Close chat", text: "\u00d7", onclick: function () { toggle(false); } }),
      ]),
      log, chips, form, barEl, footEl,
    ]);

    var icon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/></svg>';
    var launcher = h("button", { class: "launcher", type: "button", "aria-label": "Open chat" });
    launcher.innerHTML = icon;

    var teaser = null;
    function toggle(open) {
      panel.classList.toggle("open", open);
      launcher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
      if (teaser) { teaser.remove(); teaser = null; }
      if (open) input.focus();
    }
    launcher.addEventListener("click", function () { toggle(!panel.classList.contains("open")); });
    send.addEventListener("click", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(input.value); });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });

    root.appendChild(panel);
    root.appendChild(launcher);

    // One quiet nudge per visit, never again.
    var shown = false;
    try { shown = sessionStorage.getItem("bizbot_teased"); } catch (e) {}
    if (!shown) {
      setTimeout(function () {
        if (panel.classList.contains("open")) return;
        teaser = h("div", { class: "teaser", text: cfg.greeting, onclick: function () { toggle(true); } });
        root.appendChild(teaser);
        try { sessionStorage.setItem("bizbot_teased", "1"); } catch (e) {}
      }, 4000);
    }
  }
})();
          
