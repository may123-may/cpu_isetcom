import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LanguageSchema = z.enum(["fr", "en", "zh"]);
type Lang = z.infer<typeof LanguageSchema>;

// ---------- 1) Verify the single shared access password ----------
export const verifyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { getMemberPassword, normalizeAccessCode } = await import("./member.server");
    const expected = normalizeAccessCode(getMemberPassword());
    const entered = normalizeAccessCode(data.password);
    if (!entered) return { ok: false };
    // Comparaison tolérante : exacte d'abord, puis insensible à la casse
    // (claviers mobiles qui capitalisent, codes dictés à l'oral, etc.)
    const ok = entered === expected || entered.toLowerCase() === expected.toLowerCase();
    if (!ok) {
      console.warn(
        `[AUTH] wrong access code (len=${entered.length}, expectedLen=${expected.length}). ` +
          `Si le bon code échoue en prod, vérifiez MEMBER_PASSWORD dans le dashboard Vercel + redéployez (le .env local n'est jamais déployé, il est gitignoré).`,
      );
    }
    return { ok };
  });

// ---------- 2) Send an interview turn — calls the configured AI provider ----------
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const sendInterviewTurn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        language: LanguageSchema,
        history: z.array(MessageSchema).max(50),
        message: z.string().nullable(), // null = ask first question
        questionNumber: z.number().optional(), // which question is being answered (1-10)
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { buildMemberSystemPrompt } = await import("./member.server");
    const { chatCompletion } = await import("./ai.server");

    const systemPrompt = buildMemberSystemPrompt(data.language as Lang, data.questionNumber);

    // Build messages in OpenAI format (Groq / Gemini / OpenRouter are all OpenAI-compatible)
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Append conversation history (fenêtre glissante : 12 derniers messages
    // suffisent pour le contexte, divise les tokens par ~2 sur les fins d'entretien)
    for (const m of data.history.slice(-12)) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.slice(0, 1500),
      });
    }

    // Append the new user message (null = first turn, trigger ARIA's opening)
    if (data.message !== null) {
      messages.push({ role: "user", content: data.message });
    } else {
      // First call: nudge ARIA to deliver its opening statement
      messages.push({ role: "user", content: "Begin the interview now." });
    }

    let raw: string;
    try {
      raw = await chatCompletion(messages, { temperature: 0.8, maxTokens: 500 });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("ARIA ERROR:", detail);
      // Diagnostic reply (visible to the admin testing the site) with the REAL cause:
      // bad key, unknown model, quota exceeded, wrong URL…
      return {
        reply: `[⚠ ARIA est hors ligne — ${detail} Vérifiez votre fichier .env puis redémarrez le serveur.]`,
        complete: false,
      };
    }

    const complete = raw.includes("[INTERVIEW_COMPLETE]");
    const reply = raw.replace(/\[INTERVIEW_COMPLETE\]/g, "").trim();

    return { reply, complete };
  });

// ---------- 3) AI Detection — 100% LOCALE, 0 appel API ----------
// Avant : 1 appel API / message => doublait la consommation et provoquait
// les 429 qui bloquaient les autres candidats.
// Maintenant : heuristique instantanée (longueur, uniformité, formules
// génériques type ChatGPT, absence de détails personnels). Le badge % reste
// affiché, mais ne consomme plus aucun quota.
// Pour réactiver l'ancienne détection par IA : AI_DETECT_ENABLED=true dans .env
function localAIDetect(text: string): number {
  const t = text.trim();
  if (t.length < 20) return 5;
  const sentences = t.split(/[.!?…]+/).map((s) => s.trim()).filter(Boolean);
  let score = 10;
  // Longueur très calibrée / paragraphes parfaits
  if (t.length > 600) score += 15;
  // Uniformité des phrases ( Burstiness faible = suspect )
  if (sentences.length >= 3) {
    const lens = sentences.map((s) => s.length);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length;
    if (variance < 400) score += 20;
  }
  // Formules génériques typiques des LLM
  const generic = [
    "en conclusion", "il est important de", "dans le monde", "jouer un rôle",
    "in conclusion", "it is important", "as an ai", "en tant qu'ia",
    "tout d'abord", "firstly", "moreover", "furthermore", "de plus,",
    "il convient de noter", "it should be noted",
  ];
  const low = t.toLowerCase();
  for (const g of generic) if (low.includes(g)) score += 12;
  // Listes parfaites + transitions soignées
  if (/(\n\s*[-•*]\s+.*){3,}/.test(t)) score += 10;
  if (/^(cependant|néanmoins|toutefois|however|moreover)/im.test(t)) score += 8;
  // Détails personnels concrets = humain (fait baisser le score)
  if (/\b(je m'appelle|mon (projet|école|prof|club|stage)|l'an dernier|chez moi|mon père|ma mère|\d{4})\b/i.test(t)) score -= 20;
  if (/(haha|lol|mdr|euh|ben |bah |franchement|grave|trop bien)/i.test(t)) score -= 15;
  if (/[😀-🙏👋🔥❤️🧡💛💚💙💜🖤🤍🤎💔💕💞💓💗💖💘💝💟☮️✝️☪️🕉☸️✡️🔯🕎☯️☦️🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛️]/u.test(t)) score -= 10;
  return Math.max(0, Math.min(95, score));
}

export const detectAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    if (process.env.AI_DETECT_ENABLED === "true") {
      const { chatCompletion } = await import("./ai.server");
      let raw: string;
      try {
        raw = await chatCompletion(
          [
            {
              role: "system",
              content: `You are an AI text detector. Analyze the text and estimate probability (0-100) it was written by an AI.

Consider:
- Burstiness: humans vary sentence lengths; AI is uniform
- Perplexity: humans use unexpected word choices; AI is predictable
- Specificity: humans give real personal details; AI is generic
- Structure: humans are organic; AI overuses perfect paragraphs and transitions

Return ONLY a single integer 0-100. No other text.`,
            },
            { role: "user", content: data.text },
          ],
          { temperature: 0.1, maxTokens: 10 },
        );
      } catch {
        return { percent: localAIDetect(data.text) };
      }
      const num = parseInt(raw, 10);
      return { percent: isNaN(num) ? localAIDetect(data.text) : Math.max(0, Math.min(100, num)) };
    }
    return { percent: localAIDetect(data.text) };
  });

// ---------- 3b) SCORING automatique — 1 seul appel API à la FIN ----------
// Objectif "choisir les meilleurs" : à la fin de chaque entretien on génère
// une note /100 + verdict, envoyée dans l'email. Coût : 1 appel / candidat
// (au lieu de 10 si on notait à chaque tour). Les admins trient ensuite les
// emails par score décroissant.
export interface CandidateScore {
  motivation: number;
  honnetete: number;
  equipe: number;
  engagement: number;
  communication: number;
  total: number;
  verdict: "ADMIS" | "LISTE_ATTENTE" | "REFUSE";
  resume: string;
}

export const evaluateInterview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        candidateName: z.string(),
        conversation: z.array(MessageSchema).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ score: CandidateScore | null }> => {
    const { chatCompletion } = await import("./ai.server");
    const transcript = data.conversation
      .map((m) => `${m.role === "assistant" ? "ARIA" : "CANDIDAT"}: ${m.content}`)
      .join("\n")
      .slice(0, 8000);
    try {
      const raw = await chatCompletion(
        [
          {
            role: "system",
            content: `Tu es un jury de recrutement du CPU Club (robotique, ISET'COM).
Note le candidat sur 5 critères (0-20 chacun) : motivation, honnêteté/auto-évaluation, esprit d'équipe, engagement/disponibilité, communication (exemples concrets).
Réponds UNIQUEMENT en JSON compact, sans markdown :
{"motivation":12,"honnetete":14,"equipe":10,"engagement":13,"communication":11,"verdict":"ADMIS","resume":"2 phrases max"}
// verdict: ADMIS si total>=60, LISTE_ATTENTE si >=40, sinon REFUSE.`,
          },
          { role: "user", content: `Candidat: ${data.candidateName}\n\n${transcript}` },
        ],
        { temperature: 0.2, maxTokens: 300 },
      );
      const json = JSON.parse(raw.replace(/```json?|```/g, "").trim()) as Record<string, unknown>;
      const n = (v: unknown) => (typeof v === "number" && !isNaN(v) ? Math.max(0, Math.min(20, Math.round(v))) : 10);
      const motivation = n(json.motivation);
      const honnetete = n(json.honnetete);
      const equipe = n(json.equipe);
      const engagement = n(json.engagement);
      const communication = n(json.communication);
      const total = motivation + honnetete + equipe + engagement + communication;
      const verdict: CandidateScore["verdict"] =
        total >= 60 ? "ADMIS" : total >= 40 ? "LISTE_ATTENTE" : "REFUSE";
      return {
        score: {
          motivation, honnetete, equipe, engagement, communication, total,
          verdict: typeof json.verdict === "string" && ["ADMIS", "LISTE_ATTENTE", "REFUSE"].includes(json.verdict)
            ? (json.verdict as CandidateScore["verdict"])
            : verdict,
          resume: typeof json.resume === "string" ? json.resume.slice(0, 400) : "",
        },
      };
    } catch (e) {
      console.error("evaluateInterview failed:", e);
      return { score: null };
    }
  });
// ---------- 5) Send the finished interview report by email (automatic on exit) ----------
// Enrichi avec le SCORE automatique (1 appel API) pour trier les candidats.
export const sendReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        language: LanguageSchema,
        candidateName: z.string(),
        conversation: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
            aiPercent: z.number().optional(),
          }),
        ),
        rankReached: z.string(),
        rating: z.number().nullable(),
        messageToPresident: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      // Score automatique (best-effort : ne bloque jamais l'envoi)
      let scoreLine = "";
      try {
        const { chatCompletion } = await import("./ai.server");
        const transcript = data.conversation
          .map((m) => `${m.role === "assistant" ? "ARIA" : "CANDIDAT"}: ${m.content}`)
          .join("\n")
          .slice(0, 8000);
        const rawScore = await chatCompletion(
          [
            {
              role: "system",
              content: `Tu es un jury de recrutement du CPU Club. Note 5 critères 0-20 : motivation, honnêteté, esprit d'équipe, engagement, communication. Réponds UNIQUEMENT JSON compact : {"motivation":12,"honnetete":14,"equipe":10,"engagement":13,"communication":11,"verdict":"ADMIS","resume":"2 phrases max"}`,
            },
            { role: "user", content: `Candidat: ${data.candidateName}\n\n${transcript}` },
          ],
          { temperature: 0.2, maxTokens: 300 },
        );
        const s = JSON.parse(rawScore.replace(/```json?|```/g, "").trim()) as Record<string, unknown>;
        const n = (v: unknown) => (typeof v === "number" && !isNaN(v) ? Math.max(0, Math.min(20, Math.round(v))) : 10);
        const total = n(s.motivation) + n(s.honnetete) + n(s.equipe) + n(s.engagement) + n(s.communication);
        scoreLine = `\n\n=== SCORE AUTO (/100) ===\nTotal : ${total}/100\nMotivation:${n(s.motivation)} Honnêteté:${n(s.honnetete)} Équipe:${n(s.equipe)} Engagement:${n(s.engagement)} Communication:${n(s.communication)}\nVerdict : ${typeof s.verdict === "string" ? s.verdict : total >= 60 ? "ADMIS" : total >= 40 ? "LISTE_ATTENTE" : "REFUSE"}\nRésumé : ${typeof s.resume === "string" ? s.resume : ""}`;
        // Préfixe le sujet via le nom (le sujet exact est construit dans email.server,
        // on transmet le score dans le message au président si besoin)
        data = { ...data, messageToPresident: `${data.messageToPresident}${scoreLine}` };
      } catch (e) {
        console.warn("auto-score skipped:", e instanceof Error ? e.message : String(e));
      }
      const { sendTranscriptEmail } = await import("./email.server");
      await sendTranscriptEmail(data);
      return { ok: true as const };
    } catch (err) {
      // Never block the candidate's exit — log for the admin instead
      const detail = err instanceof Error ? err.message : String(err);
      console.error("REPORT EMAIL FAILED:", detail);
      return { ok: false as const, error: detail };
    }
  });
// ---------- 4) Save completed interview (optionnel : silencieux si Supabase absent) ----------
export const saveInterview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        language: LanguageSchema,
        conversation: z.array(MessageSchema),
        rankReached: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { ok: true, skipped: true as const };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("interviews").insert({
        candidate_id: "member",
        candidate_name: "Simple Member",
        candidate_role: "Member",
        language: data.language,
        conversation: data.conversation,
        rank_reached: data.rankReached,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) {
      console.warn("saveInterview skipped:", e instanceof Error ? e.message : String(e));
      return { ok: true, skipped: true as const };
    }
  });
