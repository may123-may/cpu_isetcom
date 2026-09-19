// SERVER-ONLY: reads API keys from env. Never import from client code.
// The *.server.ts suffix is blocked from client bundles by Vite.
//
// Supported providers (set AI_PROVIDER in .env):
//   - "groq"   (default) — free key at https://console.groq.com
//   - "gemini"           — free key at https://aistudio.google.com (generous free tier)
//   - "custom"           — any OpenAI-compatible endpoint (OpenRouter, Together, DeepSeek…)
//
//   AI_PROVIDER=gemini
//   GEMINI_API_KEY=AIza... ou AQ.Ab8... (nouveau format 2026 — les 2 sont acceptés)
//   AI_MODEL=gemini-3.6-flash   (optional — sensible default per provider)
// NOTE (juin 2026) : Google émet désormais des clés AQ.Ab8... au lieu de AIza...
// Ces clés AQ ne marchent QUE sur l'endpoint natif Gemini (:generateContent).
// Elles sont REJETÉES (400/401) sur la route OpenAI-compatible /v1beta/openai.
// => le provider "gemini" ci-dessous appelle toujours l'endpoint natif.

// ──────────────────────────────────────────────────────────────────────────────
// Résilience multi-candidats : rotation de clés + fallback provider + retry.
// Pourquoi ça bloquait avant ?
//   - 1 seule GROQ_API_KEY (quota gratuit ~30 req/min)
//   - 2 appels API par tour (interview + detectAI) => 20 appels / candidat
//   - 5 candidats en parallèle => 429 rate_limit => "[⚠ ARIA hors ligne]" pour tous
// Maintenant :
//   - GROQ_API_KEYS="k1,k2,k3" (rotation round-robin, 3 clés = 3x le quota)
//   - Fallback automatique groq -> gemini -> custom si 429/quota
//   - Retry exponentiel avec Retry-After + throttle anti-burst (400ms entre appels)
//   - maxTokens réduit (800 -> 500) : 1 question courte = moins de tokens/jour
// ──────────────────────────────────────────────────────────────────────────────

export interface AIConfig {
  provider: string;
  baseUrl: string; // without trailing slash, without /chat/completions
  apiKey: string;
  model: string;
}

function splitKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length >= 10);
}

function getEnvList(...names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    for (const k of splitKeys(process.env[n])) {
      if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

export function getAIConfig(): AIConfig {
  // Garde la compatibilité : retourne la 1ère config disponible.
  const all = getAIConfigs();
  if (all.length > 0) return all[0];
  const provider = (process.env.AI_PROVIDER ?? "groq").trim().toLowerCase();
  if (provider === "gemini") {
    return {
      provider,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: "MISSING_KEY",
      model: process.env.AI_MODEL ?? "gemini-3.6-flash",
    };
  }
  if (provider === "custom") {
    return {
      provider,
      baseUrl: (process.env.AI_API_URL ?? "").replace(/\/+$/, ""),
      apiKey: "MISSING_KEY",
      model: process.env.AI_MODEL ?? "",
    };
  }
  return {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "MISSING_KEY",
    model: process.env.AI_MODEL ?? "openai/gpt-oss-20b",
  };
}

/**
 * Liste ordonnée des configs à essayer.
 * Ordre : provider principal (AI_PROVIDER) d'abord avec TOUTES ses clés,
 * puis les providers de secours qui ont une clé configurée.
 * Ex: AI_PROVIDER=groq + GROQ_API_KEYS=k1,k2 + GEMINI_API_KEY=g1
 *  => [groq/k1, groq/k2, gemini/g1]
 */
export function getAIConfigs(): AIConfig[] {
  const primary = (process.env.AI_PROVIDER ?? "groq").trim().toLowerCase();
  const groqKeys = getEnvList("GROQ_API_KEYS", "GROQ_API_KEY", "AI_API_KEY");
  const geminiKeys = getEnvList("GEMINI_API_KEYS", "GEMINI_API_KEY");
  const customKeys = getEnvList("AI_API_KEYS", "AI_API_KEY");
  const groqModel = process.env.AI_MODEL ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
  // Comptes Google récents : seul gemini-3.6-flash est servi (2.5/2.0 => 404)
  const geminiModel = process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const customModel = process.env.AI_MODEL ?? "";
  const customUrl = (process.env.AI_API_URL ?? "").replace(/\/+$/, "");

  const byProvider = (p: string): AIConfig[] => {
    if (p === "gemini") {
      return geminiKeys.map((apiKey) => ({
        provider: p,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey,
        model: primary === "gemini" ? geminiModel : process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
      }));
    }
    if (p === "custom") {
      if (!customUrl) return [];
      return customKeys.map((apiKey) => ({
        provider: p,
        baseUrl: customUrl,
        apiKey,
        model: customModel,
      }));
    }
    return groqKeys.map((apiKey) => ({
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey,
      model: primary === "groq" ? groqModel : process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    }));
  };

  const order = [primary, ...["groq", "gemini", "custom"].filter((p) => p !== primary)];
  return order.flatMap(byProvider);
}

export function validateAIConfig(cfg: AIConfig): string | null {
  if (!cfg.apiKey || cfg.apiKey === "MISSING_KEY" || cfg.apiKey.length < 10) {
    return cfg.provider === "gemini"
      ? "clé API Gemini manquante. Ajoutez GEMINI_API_KEY dans le fichier .env (gratuite sur https://aistudio.google.com)."
      : cfg.provider === "custom"
        ? "clé API manquante. Ajoutez AI_API_KEY dans le fichier .env."
        : "clé API Groq manquante. Ajoutez GROQ_API_KEY dans le fichier .env (gratuite sur https://console.groq.com).";
  }
  if (cfg.provider === "custom" && !cfg.baseUrl) {
    return "AI_API_URL manquant pour le provider custom (ex: https://openrouter.ai/api/v1).";
  }
  if (!cfg.model) {
    return "AI_MODEL manquant (ex: gemini-2.5-flash).";
  }
  return null;
}

export interface ChatMessage {
  role: string;
  content: string;
}

// ── Throttle anti-burst : espace les appels d'au moins MIN_INTERVAL ms ──
// Sur Vercel chaque instance a sa propre file ; ça suffit à lisser les
// rafales "5 candidats cliquent Envoyer la même seconde".
let lastCallAt = 0;
let roundRobin = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const minInterval = Number(process.env.AI_MIN_INTERVAL_MS ?? 400);
  if (!(minInterval > 0)) return;
  const now = Date.now();
  const wait = lastCallAt + minInterval - now;
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

function parseRetryAfterMs(res: Response, bodyText: string): number {
  const h = res.headers.get("retry-after");
  if (h) {
    const s = Number(h);
    if (!isNaN(s)) return Math.min(s * 1000, 20000);
  }
  try {
    const json = JSON.parse(bodyText) as { error?: { message?: string } };
    const m = json.error?.message?.match(/try again in ([\d.]+)s/i);
    if (m) return Math.min(Number(m[1]) * 1000, 20000);
  } catch {
    /* ignore */
  }
  return 0;
}

async function callOne(
  cfg: AIConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<Response> {
  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
}

// ── Gemini NATIF (obligatoire pour les clés AQ.Ab8... de 2026) ──
// Route : POST /v1beta/models/{model}:generateContent?key=LA_CLE
// Les clés AQ passées en "Authorization: Bearer" sur /v1beta/openai => 400/401.
async function callGeminiNative(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<{ ok: boolean; status: number; text: string; content: string }> {
  const systemTexts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Hello" }] });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens, candidateCount: 1 },
  };
  if (systemTexts.length > 0) {
    body.system_instruction = { parts: [{ text: systemTexts.join("\n\n") }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, text: `réseau: ${e instanceof Error ? e.message : String(e)}`, content: "" };
  }
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    let detail = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message.slice(0, 300);
    } catch { /* keep raw */ }
    return { ok: false, status: res.status, text: detail, content: "" };
  }
  try {
    const j = JSON.parse(raw) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    const content = parts.map((p) => p.text ?? "").join("");
    if (content) return { ok: true, status: 200, text: "", content };
    const blocked = j.promptFeedback?.blockReason;
    return { ok: false, status: 502, text: blocked ? `réponse bloquée (${blocked})` : "réponse vide", content: "" };
  } catch {
    return { ok: false, status: 502, text: "réponse Gemini illisible", content: "" };
  }
}

/** Calls any OpenAI-compatible /chat/completions endpoint. Throws a clear Error on failure. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const configs = getAIConfigs();
  if (configs.length === 0) {
    const cfg = getAIConfig();
    const problem = validateAIConfig(cfg);
    throw new Error(`[CONFIG] ${problem ?? "aucune clé API configurée"}`);
  }
  // Rotation round-robin : le 1er essai commence à une clé différente à chaque
  // appel pour répartir la charge entre les clés.
  const start = roundRobin++ % configs.length;
  const ordered = configs.map((_, i) => configs[(start + i) % configs.length]);

  const temperature = opts?.temperature ?? 0.8;
  const maxTokens = opts?.maxTokens ?? 500;
  const maxAttempts = Number(process.env.AI_MAX_RETRIES ?? 2);

  let lastError = "";
  for (const cfg of ordered) {
    // ── Provider Gemini : endpoint natif (supporte AIza... ET AQ.Ab8...) ──
    if (cfg.provider === "gemini") {
      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        await throttle();
        const r = await callGeminiNative(cfg.apiKey, cfg.model, messages, temperature, maxTokens);
        if (r.ok) return r.content;
        const keySuffix = cfg.apiKey.slice(-4);
        lastError = r.status === 0 ? `[API gemini réseau] ${r.text}` : `[API gemini ${r.status}] ${r.text}`;
        if (r.status === 429 || r.status >= 500) {
          const backoff = 1200 * (attempt + 1) + Math.random() * 800;
          console.warn(`ARIA throttle (gemini …${keySuffix}): ${lastError} — nouvel essai dans ${Math.round(backoff)}ms`);
          await sleep(backoff);
          continue;
        }
        console.error(`ARIA ERROR (clé gemini ignorée):`, lastError);
        break;
      }
      continue; // passe au provider suivant
    }
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      await throttle();
      let res: Response;
      try {
        res = await callOne(cfg, messages, temperature, maxTokens);
      } catch (e) {
        lastError = `[API ${cfg.provider} réseau] ${e instanceof Error ? e.message : String(e)}`;
        await sleep(800 * (attempt + 1));
        continue;
      }
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return json.choices?.[0]?.message?.content ?? "";
      }
      const text = await res.text().catch(() => "");
      let detail = text.slice(0, 300);
      try {
        const json = JSON.parse(text) as { error?: { message?: string } };
        if (json.error?.message) detail = json.error.message.slice(0, 300);
      } catch {
        /* keep raw text */
      }
      const keySuffix = cfg.apiKey.slice(-4);
      lastError = `[API ${cfg.provider} ${res.status}] ${detail}`;
      // 429 / 5xx => retry avec backoff, puis passer à la clé/provider suivant
      if (res.status === 429 || res.status >= 500) {
        // Quota JOURNALIER épuisé (TPD) : réessayer la même clé est inutile
        // (reset à minuit UTC). On bascule immédiatement sur la clé suivante.
        // C'est le cas typique quand plusieurs clés partagent la même org Groq.
        const isDailyQuota =
          /tokens per day|\bTPD\b|daily.*limit|quota.*day/i.test(detail) || /tokens per day|\bTPD\b/i.test(text);
        if (isDailyQuota) {
          console.warn(
            `ARIA quota journalier épuisé sur ${cfg.provider} (clé …${keySuffix}) — bascule immédiate sur la clé suivante.`,
          );
          break; // passe à la config suivante SANS attendre
        }
        const retryAfter = parseRetryAfterMs(res, text);
        const backoff = retryAfter || 1200 * (attempt + 1) + Math.random() * 800;
        console.warn(`ARIA throttle: ${lastError} — nouvel essai dans ${Math.round(backoff)}ms`);
        await sleep(backoff);
        continue; // réessaie même clé
      }
      // 4xx autre (mauvaise clé, mauvais modèle) => inutile de réessayer cette clé
      console.error(`ARIA ERROR (clé ${cfg.provider} ignorée):`, lastError);
      break; // passe à la config suivante
    }
  }
  // Message final enrichi : si c'est du TPD sur toutes les clés, le retry
  // dans 6 min ne servira à rien — le reset Groq gratuit est à minuit UTC.
  const isTpd = /tokens per day|\bTPD\b/i.test(lastError);
  const hint = isTpd
    ? ` Quota JOURNALIER Groq épuisé sur toutes les clés (${ordered.length} config(s) essayée(s)).` +
      ` Si vos clés partagent la même organisation Groq, la rotation ne multiplie PAS le quota — créez chaque clé sur un compte Google différent.` +
      ` Secours Gemini (AIza… ou AQ.Ab8…) essayé automatiquement. Reset Groq à minuit UTC.`
    : ` (${ordered.length} config(s) essayée(s)).`;
  throw new Error((lastError || "[API] échec inconnu") + hint);
}
