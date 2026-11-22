// Sapiens (Pacha Académie IB) : relais IA. La clé API reste secrète sur le serveur Netlify.
// Variables d'environnement (Netlify > Site configuration > Environment variables) — une seule clé suffit :
//   GEMINI_API_KEY     (gratuit avec limites : https://aistudio.google.com) — lit aussi les photos et les PDF
//   GROQ_API_KEY       (gratuit avec limites : https://console.groq.com) — texte seulement
//   ANTHROPIC_API_KEY  (payant, meilleure qualité : https://console.anthropic.com)
// Optionnel :
//   AI_MODEL            pour choisir le modèle
//   DAILY_LIMIT         questions par élève et par jour (défaut 40)
//   GLOBAL_DAILY_LIMIT  questions par jour pour tout le site (défaut 1500)

export const config = { path: "/api/chat" };

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function provider() {
  const e = process.env;
  if (e.ANTHROPIC_API_KEY) return { kind: "anthropic", key: e.ANTHROPIC_API_KEY, model: e.AI_MODEL || "claude-haiku-5-5" };
  if (e.GEMINI_API_KEY) return { kind: "gemini", key: e.GEMINI_API_KEY, model: e.AI_MODEL || "gemini-flash-latest" };
  if (e.GROQ_API_KEY) return { kind: "groq", key: e.GROQ_API_KEY, model: e.AI_MODEL || "llama-3.3-70b-versatile" };
  return null;
}

/* ---------- limite par jour ---------- */
let blobs; // chargé à la première question
const mem = new Map();
async function take(key, limit) {
  const day = new Date().toISOString().slice(0, 10), k = `${day}:${key}`;
  if (blobs === undefined) { try { blobs = (await import("@netlify/blobs")).getStore; } catch { blobs = null; } }
  try {
    if (blobs) {
      const st = blobs("sapiens-quota");
      const n = Number((await st.get(k)) || 0);
      if (n >= limit) return false;
      await st.set(k, String(n + 1));
      return true;
    }
  } catch { /* stockage indisponible : on garde la limite en mémoire */ }
  const n = mem.get(k) || 0;
  if (n >= limit) return false;
  mem.set(k, n + 1);
  return true;
}

async function gemini(p, messages, files, hq) {
  const contents = messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      ...(i === messages.length - 1 ? files.map(f => ({ inline_data: { mime_type: f.mime, data: f.data } })) : []),
      { text: m.content }
    ]
  }));
  const models = [...(hq ? ["gemini-2.5-pro"] : []), p.model, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter((v, i, a) => v && a.indexOf(v) === i);
  let last = { status: 502, message: "AI error" };
  for (const model of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": p.key },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 16000, temperature: 0.3 } })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return (j.candidates?.[0]?.content?.parts || []).filter(x => !x.thought).map(x => x.text || "").join("");
    last = { status: r.status, message: j.error?.message || "AI error" };
    if (!(r.status === 404 || r.status === 429 || r.status >= 500 || (r.status === 400 && /model|not found|not supported/i.test(last.message)))) break;
  }
  throw last;
}

async function anthropic(p, messages, files, hq) {
  const msgs = messages.map((m, i) => (i === messages.length - 1 && files.length)
    ? { role: m.role, content: [
        ...files.map(f => f.mime === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: f.mime, data: f.data } }
          : { type: "image", source: { type: "base64", media_type: f.mime, data: f.data } }),
        { type: "text", text: m.content }] }
    : m);
  const models = hq && !process.env.AI_MODEL ? ["claude-sonnet-5-5", p.model] : [p.model];
  let last;
  for (const model of models) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": p.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 6000, messages: msgs })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    last = { status: r.status, message: j?.error?.message || "AI error" };
  }
  throw last;
}

async function groq(p, messages, files) {
  if (files.length) throw { status: 400, message: "Ce serveur utilise Groq, qui ne lit pas les photos ni les PDF. Copie le texte, ou demande à l’administrateur d’utiliser une clé Gemini." };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ model: p.model, max_tokens: 4000, temperature: 0.4, messages })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { status: r.status, message: j?.error?.message || "AI error" };
  return j.choices?.[0]?.message?.content || "";
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // Refuse les appels venant d'autres sites (protège ton quota).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: "forbidden" }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const p = provider();
  if (body && body.ping) return json({ ok: !!p, files: !!p && p.kind !== "groq" });
  if (!p) return json({ error: "Aucune clé API configurée sur le serveur." }, 503);

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "anon";
  const perUser = Number(process.env.DAILY_LIMIT || 40), all = Number(process.env.GLOBAL_DAILY_LIMIT || 1500);
  if (!(await take("all", all))) return json({ error: "Pacha IA a atteint sa limite du jour pour tout le site. Réessaie demain, ou ajoute ta propre clé dans Pacha IA ⚙." }, 429);
  if (!(await take("ip:" + ip, perUser))) return json({ error: `Tu as utilisé tes ${perUser} questions à Pacha IA pour aujourd’hui. Reviens demain, ou ajoute ta propre clé gratuite dans Pacha IA ⚙.` }, 429);

  let messages = Array.isArray(body.messages) ? body.messages : [];
  messages = messages.slice(-16)
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 60000) }))
    .filter(m => m.content);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return json({ error: "empty" }, 400);

  const okMime = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/;
  const files = (Array.isArray(body.files) ? body.files : [])
    .filter(f => f && okMime.test(f.mime) && typeof f.data === "string")
    .slice(0, 4);

  try {
    const hq = !!body.hq;
    const text = p.kind === "anthropic" ? await anthropic(p, messages, files, hq)
      : p.kind === "gemini" ? await gemini(p, messages, files, hq)
      : await groq(p, messages, files);
    return json({ text });
  } catch (e) {
    if (e && e.status) return json({ error: e.message || "AI error" }, e.status === 429 ? 429 : e.status === 400 ? 400 : 502);
    return json({ error: "Le service IA ne répond pas. Réessaie dans un instant." }, 502);
  }
};
