import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LanguageSchema = z.enum(["fr", "en", "zh"]);
type Lang = z.infer<typeof LanguageSchema>;

// ---------- 1) Verify the single shared access password ----------
export const verifyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { getMemberPassword } = await import("./member.server");
    const expected = getMemberPassword();
    return { ok: data.password === expected };
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

    // Append conversation history
    for (const m of data.history) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
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
      raw = await chatCompletion(messages, { temperature: 0.8, maxTokens: 800 });
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

// ---------- 3) AI Detection — analyze if text is AI-generated ----------
export const detectAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
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
      return { percent: null };
    }
    const num = parseInt(raw, 10);
    return { percent: isNaN(num) ? null : Math.max(0, Math.min(100, num)) };
  });

// ---------- 5) Send the finished interview report by email (automatic on exit) ----------
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
// ---------- 4) Save completed interview ----------
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
  });
