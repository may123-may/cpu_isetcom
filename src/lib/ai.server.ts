// SERVER-ONLY: reads API keys from env. Never import from client code.
// The *.server.ts suffix is blocked from client bundles by Vite.
//
// Supported providers (set AI_PROVIDER in .env):
//   - "groq"   (default) — free key at https://console.groq.com
//   - "gemini"           — free key at https://aistudio.google.com (generous free tier)
//   - "custom"           — any OpenAI-compatible endpoint (OpenRouter, Together, DeepSeek…)
//
//   AI_PROVIDER=gemini
//   GEMINI_API_KEY=AIza...
//   AI_MODEL=gemini-3.6-flash   (optional — sensible default per provider)

export interface AIConfig {
  provider: string;
  baseUrl: string; // without trailing slash, without /chat/completions
  apiKey: string;
  model: string;
}

export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER ?? "groq").trim().toLowerCase();

  if (provider === "gemini") {
    return {
      provider,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY ?? "MISSING_KEY",
      model: process.env.AI_MODEL ?? "gemini-3.6-flash",
    };
  }

  if (provider === "custom") {
    return {
      provider,
      baseUrl: (process.env.AI_API_URL ?? "").replace(/\/+$/, ""),
      apiKey: process.env.AI_API_KEY ?? "MISSING_KEY",
      model: process.env.AI_MODEL ?? "",
    };
  }

  // groq (default — keeps backward compatibility with GROQ_API_KEY)
  return {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY ?? process.env.AI_API_KEY ?? "MISSING_KEY",
    model: process.env.AI_MODEL ?? "openai/gpt-oss-20b",
  };
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

/** Calls any OpenAI-compatible /chat/completions endpoint. Throws a clear Error on failure. */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const cfg = getAIConfig();
  const problem = validateAIConfig(cfg);
  if (problem) throw new Error(`[CONFIG] ${problem}`);

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: opts?.temperature ?? 0.8,
      max_tokens: opts?.maxTokens ?? 800,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Surface the provider's real error (invalid key, unknown model, quota…)
    // e.g. Groq: {"error":{"message":"...","type":"..."}} — Gemini: {"error":{"message":"..."}}
    let detail = text.slice(0, 300);
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) detail = json.error.message.slice(0, 300);
    } catch {
      /* keep raw text */
    }
    throw new Error(`[API ${cfg.provider} ${res.status}] ${detail}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}
