// SERVER-ONLY: sends the interview report by email. Never import from client code.
// The *.server.ts suffix is blocked from client bundles by Vite.
//
// Free setup (Gmail SMTP, ~500 emails/day, no credit card):
//   1. Use a Gmail account with 2-step verification ON
//   2. Create an App Password: https://myaccount.google.com/apppasswords
//   3. Set SMTP_USER (your gmail) + SMTP_PASS (the 16-char app password) in .env

const DEFAULT_RECIPIENTS = [
  "benammarfarah7@gmail.com",
  "soulayma.afrit@edu.isetcom.tn",
];

export function getReportRecipients(): string[] {
  const raw = process.env.REPORT_EMAILS;
  if (raw && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_RECIPIENTS;
}

export interface TranscriptPayload {
  language: string;
  candidateName: string;
  conversation: Array<{ role: string; content: string; aiPercent?: number }>;
  rankReached: string;
  rating: number | null;
  messageToPresident: string;
}

function buildEmailBody(p: TranscriptPayload): string {
  const name = p.candidateName || "Candidat";
  const lines = p.conversation.map((m) => {
    const who = m.role === "assistant" ? "A.R.I.A" : name;
    const ai = m.role === "user" && m.aiPercent !== undefined ? ` [AI: ${m.aiPercent}%]` : "";
    return `[${who}]${ai}\n${m.content}`;
  });
  return [
    `=== CPU Club — Rapport d'entretien (Membre : ${name}) ===`,
    `Date : ${new Date().toLocaleString("fr-FR")}`,
    `Langue : ${p.language.toUpperCase()}`,
    `Rang atteint : ${p.rankReached}`,
    ``,
    ...lines,
    ``,
    `=== FEEDBACK ===`,
    `Note : ${p.rating !== null ? `${p.rating}/5` : "—"}`,
    `Message au président : ${p.messageToPresident || "—"}`,
  ].join("\n\n");
}

export async function sendTranscriptEmail(p: TranscriptPayload): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      "[CONFIG] Email non configuré. Ajoutez SMTP_USER (gmail) + SMTP_PASS (mot de passe d'application) dans .env — voir https://myaccount.google.com/apppasswords",
    );
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS on 587
    auth: { user, pass },
  });

  const date = new Date().toISOString().slice(0, 10);
  const name = p.candidateName || "Candidat";
  await transporter.sendMail({
    from: `"CPU Club — ARIA" <${user}>`,
    to: getReportRecipients().join(", "),
    subject: `[CPU Club] Entretien Membre — ${name} — ${date}`,
    text: buildEmailBody(p),
  });
}
