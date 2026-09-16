import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowRight } from "lucide-react";
import IntroAnimation from "./IntroAnimation";
import DungeonBackground from "./DungeonBackground";
import CpuSpine from "./CpuSpine";
import VideoIntro from "./VideoIntro";
import GateReveal from "./GateReveal";
import logoUrl from "@/assets/cpu-logo.png";
import { RANKS, rankForAnswers, type Rank } from "@/lib/ranks";
import { I18N, type Lang } from "@/lib/i18n";
import {
  verifyPassword,
  sendInterviewTurn,
  saveInterview,
  detectAI,
  sendReport,
} from "@/lib/aria.functions";
import { playKey } from "@/lib/keySound";

type Step =
  | "video"
  | "intro"
  | "lang"
  | "identity"
  | "password"
  | "locked"
  | "interview"
  | "done";

interface Msg {
  role: "user" | "assistant";
  content: string;
  aiPercent?: number;
}

const LANG_OPTIONS: Array<{
  code: Lang;
  flag: string;
  label: string;
  note?: string;
}> = [
    { code: "fr", flag: "🇫🇷", label: "Français" },
    {
      code: "zh",
      flag: "🇨🇳",
      label: "中文",
      note: "Très courageux... ou très ambitieux 🐉 Le mandarin, c'est le S-Rank des langues. Respect total, Hunter 🫡",
    },
    { code: "en", flag: "🇬🇧", label: "English" },
  ];

const ARIA_INTRO =
  "▸ Hello. I am A.R.I.A — your AI interviewer for the CPU Club.\n\n" +
  "We build real machines here across three domains:\n" +
  "• AI — systems that perceive and decide.\n" +
  "• EMBEDDED — code that runs directly on hardware.\n" +
  "• IOT — devices that sense, speak, and connect.\n\n" +
  "This system was built by the architect [GOLD]Mohamed Amine May[/GOLD] and i'm an AI agent system created from a blend of his personality and CPU data to forge this legendary combination hihi\n\n" +
  "Whether you graduate this year (congrats!) and if you not !, remember: \"A smooth sea never made a skilled sailor! i believe in you<3\"\n\n" +
  "The CPU Club gates are open. But first... what language do you want to use?";
/** Parses [RED]...[/RED] blocks (red) and [GOLD]...[/GOLD] (gold) inline highlights. */
function renderMessageContent(content: string) {
  const parts = content.split(/(\[RED\][\s\S]*?\[\/RED\]|\[GOLD\][\s\S]*?\[\/GOLD\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const redMatch = part.match(/^\[RED\]([\s\S]*?)\[\/RED\]$/);
        if (redMatch) {
          return (
            <span
              key={i}
              className="block font-display text-sm tracking-wide mb-3"
              style={{
                color: "#ff5555",
                textShadow: "0 0 12px rgba(255,85,85,0.55)",
                borderLeft: "3px solid #ff5555",
                paddingLeft: "0.75rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {redMatch[1].trim()}
            </span>
          );
        }
        const goldMatch = part.match(/^\[GOLD\]([\s\S]*?)\[\/GOLD\]$/);
        if (goldMatch) {
          return (
            <span
              key={i}
              style={{
                whiteSpace: "pre-wrap",
                fontWeight: 800,
                background: "linear-gradient(135deg, #fff3c4 0%, #ffd966 45%, #ff9d2e 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 18px rgba(255,217,102,0.65)",
              }}
            >
              {goldMatch[1]}
            </span>
          );
        }
        return part ? (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {part}
          </span>
        ) : null;
      })}
    </>
  );
}

function renderTypewrittenContent(content: string, visibleLength: number) {
  const typedSoFar = content.slice(0, visibleLength);
  let textToParse = typedSoFar;
  if (typedSoFar.includes("[RED]") && !typedSoFar.includes("[/RED]")) {
    textToParse += "[/RED]";
  }
  if (typedSoFar.includes("[GOLD]") && !typedSoFar.includes("[/GOLD]")) {
    textToParse += "[/GOLD]";
  }
  return renderMessageContent(textToParse);
}

/** Typewriter that calls onDone exactly once. */
function Typewriter({
  text,
  speed = 25,
  onDone,
  onChar,
  enableSound = false,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
  onChar?: () => void;
  enableSound?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setVisibleCount(0);
    doneRef.current = false;
    let i = 0;

    const id = setInterval(() => {
      i++;
      setVisibleCount(i);
      onChar?.();
      if (enableSound && i <= text.length) {
        playKey("key");
      }
      if (i >= text.length) {
        clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, enableSound]);

  return <span className="whitespace-pre-wrap">{renderTypewrittenContent(text, visibleCount)}</span>;
}

function RankBadge({ rank, size = 64 }: { rank: Rank; size?: number }) {
  const info = RANKS[rank];
  return (
    <motion.div
      key={rank}
      initial={{ scale: 0.6, opacity: 0, rotateY: -90 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className="font-display rank-glow inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        clipPath:
          "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: `linear-gradient(135deg, ${info.color} 0%, #050508 100%)`,
        border: `1px solid ${info.glow}`,
        color: info.glow,
        fontSize: size * 0.45,
        fontWeight: 700,
      }}
      aria-label={info.label}
    >
      {rank}
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-2 rounded-full"
          style={{
            background: "var(--signal)",
            boxShadow: "0 0 8px var(--signal)",
          }}
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/** Parses [RED]...[/RED] blocks and renders them in red. Everything else renders as normal text. */
// renderMessageContent moved to the top of the file to support typewriter formatting

export default function InterviewApp() {
  const [step, setStep] = useState<Step>("video");
  const [gateOpen, setGateOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [langChosen, setLangChosen] = useState<Lang | null>(null);
  const [zhJoke, setZhJoke] = useState(false);
  const [introTyped, setIntroTyped] = useState(false);
  const [pwAttempts, setPwAttempts] = useState(0);
  const [pwError, setPwError] = useState(false);
  const [pwShake, setPwShake] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [rankFlash, setRankFlash] = useState<Rank | null>(null);
  const [pendingDone, setPendingDone] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [messageToPresident, setMessageToPresident] = useState("");
  const [transcriptDownloaded, setTranscriptDownloaded] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [scrollProgress, setScrollProgress] = useState(0);
  const lastRankRef = useRef<Rank>("E");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize chat input height dynamically based on content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const verifyPw = useServerFn(verifyPassword);
  const sendTurn = useServerFn(sendInterviewTurn);
  const save = useServerFn(saveInterview);
  const detectAiText = useServerFn(detectAI);
  const sendEmailReport = useServerFn(sendReport);

  const rank = rankForAnswers(answeredCount);
  const info = RANKS[rank];
  const t = I18N[lang];

  // Drive --rank-glow / --rank for whole UI
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--rank", info.color);
    root.style.setProperty("--rank-glow", info.glow);
  }, [info]);

  // Rank-up flash
  useEffect(() => {
    if (rank !== lastRankRef.current) {
      lastRankRef.current = rank;
      setRankFlash(rank);
      const id = setTimeout(() => setRankFlash(null), 1500);
      return () => clearTimeout(id);
    }
  }, [rank]);

  // Auto-scroll chat on new messages / loading changes
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, step]);

  // ---------- Handlers ----------
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Key click sound plays only when A.R.I.A types; user input typing is silent
  };

  const handleLang = (code: Lang) => {
    setLang(code);
    setLangChosen(code);
    setTimeout(() => setStep("identity"), 700);
  };

  const submitIdentity = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!fullName.trim() || loading) return;
    setFullName(fullName.trim());
    setStep("password");
  };

  const submitPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = password.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!cleaned || loading) return;
    setLoading(true);
    try {
      const res = await verifyPw({ data: { password: cleaned } });
      if (res.ok) {
        setStep("interview");
        setGateOpen(true);
        try {
          const first = await sendTurn({
            data: {
              language: lang,
              history: [],
              message: null,
            },
          });
          setMessages([{ role: "assistant", content: first.reply }]);
        } catch (apiErr) {
          console.error("Failed to start interview:", apiErr);
          setMessages([{
            role: "assistant",
            content: "[⚠ ARIA ne peut pas démarrer — vérifiez la clé API dans .env et redémarrez le serveur.]",
          }]);
        }
      } else {
        setPwError(true);
        setPwShake(true);
        setTimeout(() => setPwShake(false), 600);
        const next = pwAttempts + 1;
        setPwAttempts(next);
        setPassword("");
        if (next >= 3) setStep("locked");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    const userMsg: Msg = { role: "user", content: msg };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    const newAnsweredCount = answeredCount + 1;
    setAnsweredCount(newAnsweredCount);
    setLoading(true);
    try {
      const [detectRes, res] = await Promise.all([
        detectAiText({ data: { text: msg } }),
        sendTurn({
          data: {
            language: lang,
            history: messages,
            message: msg,
            questionNumber: newAnsweredCount,
          },
        }),
      ]);
      const userMsgWithAI: Msg = { role: "user", content: msg, aiPercent: detectRes.percent ?? undefined };
      const updatedHistory = [...messages, userMsgWithAI];
      const finalHistory = [
        ...updatedHistory,
        { role: "assistant" as const, content: res.reply },
      ];
      setMessages(finalHistory);
      if (res.complete || newAnsweredCount >= 10) {
        try {
          await save({
            data: {
              language: lang,
              conversation: finalHistory,
              rankReached: "S",
            },
          });
        } catch (e) {
          console.error("save failed", e);
        }
        setAnsweredCount(10);
        setPendingDone(true);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "[The dungeon trembles... the connection falters. Try again.]",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, lang, sendTurn, save, answeredCount, detectAiText]);

  // Smooth scroll for new messages (useEffect triggers)
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // Scroll progress → drives the PCB spine packet
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setScrollProgress(max > 0 ? el.scrollTop / max : 0);
  }, []);
  // Instant scroll used character-by-character inside Typewriter
  const scrollToBottomInstant = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Download conversation as .txt file on the PC
  const downloadConversation = useCallback(() => {
    if (!messages.length) return;
    const extra = rating !== null
      ? `\n\n=== FEEDBACK ===\nNote: ${rating}/5\nMessage au président: ${messageToPresident}`
      : "";
    const lines = messages.map((m) =>
      `[${m.role === "assistant" ? "A.R.I.A" : (fullName || "Candidat")}]\n${m.content}`
    );
    const text = [
      `=== CPU Club — Entretien Membre : ${fullName || "Candidat"} ===`,
      `Date : ${new Date().toLocaleString("fr-FR")}`,
      `Langue : ${lang.toUpperCase()}`,
      "",
      ...lines,
      extra,
    ].join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entretien_${(fullName || "membre").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setTranscriptDownloaded(true);
  }, [messages, fullName, lang, rating, messageToPresident]);

  const exitSite = async () => {
    // Seuls la note + le message sont exigés. Le téléchargement est optionnel :
    // le système envoie TOUJOURS le rapport complet par email automatiquement.
    const missing: string[] = [];
    if (rating === null) missing.push(lang === "fr" ? "la note" : "the rating");
    if (!messageToPresident.trim()) missing.push(lang === "fr" ? "le message pour l'ex-président" : "the message for the ex-president");
    if (missing.length > 0) {
      const msg = lang === "fr"
        ? `⚠️ Veuillez compléter avant de quitter :\n• ${missing.join("\n• ")}`
        : `⚠️ Please complete before exiting:\n• ${missing.join("\n• ")}`;
      alert(msg);
      return;
    }
    // Auto-send the full report by email BEFORE leaving the page
    // (awaited: leaving the page would abort the request)
    if (reportStatus !== "sent") {
      setReportStatus("sending");
      try {
        const res = await Promise.race([
          sendEmailReport({
            data: {
              language: lang,
              candidateName: fullName || "Candidat",
              conversation: messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.aiPercent !== undefined ? { aiPercent: m.aiPercent } : {}),
              })),
              rankReached: "S",
              rating,
              messageToPresident,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 25000),
          ),
        ]);
        setReportStatus(res.ok ? "sent" : "failed");
        if (!res.ok) console.error("Report email failed:", res.error);
      } catch (e) {
        console.error("Report email failed:", e);
        setReportStatus("failed");
      }
    }
    const w = window.open("", "_self");
    if (w) w.close();
    window.close();
    if (!window.closed) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050508;color:#ffd966;font-family:'Cinzel',serif;flex-direction:column;gap:1rem;text-align:center;padding:2rem;">
          <div style="font-size:3rem;">👋</div>
          <h1 style="font-size:1.5rem;letter-spacing:0.15em;">Merci, Hunter.</h1>
          <p style="color:#888;font-size:0.85rem;letter-spacing:0.1em;">${lang === "fr" ? "Tu peux fermer cet onglet." : "You can close this tab."}</p>
        </div>
      `;
    }
  };

  const reset = () => {
    setStep("lang");
    setFullName("");
    setPassword("");
    setMessages([]);
    setAnsweredCount(0);
    setPwAttempts(0);
    setPwError(false);
    setLangChosen(null);
    setIntroTyped(false);
    setPendingDone(false);
    setRating(null);
    setMessageToPresident("");
    setTranscriptDownloaded(false);
    setReportStatus("idle");
    lastRankRef.current = "E";
  };

  // ---------- Render ----------
  if (step === "video") {
    return <VideoIntro onDone={() => setStep("intro")} />;
  }

  if (step === "intro") {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
      <DungeonBackground glow={info.glow} />
      <CpuSpine progress={scrollProgress} />
        <IntroAnimation onDone={() => setStep("lang")} />
      </div>
    );
  }

  const progressPct = Math.min(100, (answeredCount / 10) * 100);

  return (
    <div
      dir={t.dir}
      className="relative h-screen max-h-screen w-full overflow-hidden text-foreground"
    >
      <DungeonBackground glow={info.glow} />

      {/* Rank-up flash banner */}
      <AnimatePresence>
        {rankFlash && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none py-6"
            style={{
              background: `radial-gradient(ellipse at center, ${RANKS[rankFlash].glow}44 0%, transparent 70%)`,
            }}
          >
            <div className="flex items-center gap-4">
              <RankBadge rank={rankFlash} size={48} />
              <div
                className="font-display rank-glow text-xl sm:text-2xl tracking-[0.25em]"
                style={{ color: RANKS[rankFlash].glow }}
              >
                {RANKS[rankFlash].label}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single full-screen dashboard */}
      <main className="relative z-10 mx-auto flex h-full max-h-full w-full max-w-7xl flex-col lg:flex-row gap-4 p-3 sm:p-6 overflow-hidden">
        {/* ───── Left status panel (30%) ───── */}
        <aside
          className="relative w-full lg:w-[30%] lg:h-full rounded-2xl border bg-black/40 backdrop-blur-md p-3 lg:p-6 flex flex-row lg:flex-col lg:gap-6 items-center lg:items-stretch justify-between lg:justify-start gap-4 overflow-hidden"
          style={{
            borderColor: "color-mix(in oklab, var(--signal) 35%, transparent)",
            boxShadow:
              "0 0 30px color-mix(in oklab, var(--signal) 18%, transparent), inset 0 0 30px rgba(0,0,0,0.6)",
          }}
        >
          {/* Mobile top status bar */}
          <div className="flex items-center justify-between w-full lg:hidden gap-3">
            {/* Logo & Hunter */}
            <div className="flex items-center gap-2">
              <img
                src={logoUrl}
                alt="CPU Club"
                className="h-8 w-8 object-contain"
                style={{
                  mixBlendMode: "screen",
                  filter: "drop-shadow(0 0 6px var(--signal))",
                }}
              />
              <div>
                <div className="font-display text-[10px] tracking-wider text-foreground select-none">
                  {fullName || "HUNTER"}
                </div>
                <div className="font-display text-[8px] text-muted-foreground uppercase tracking-widest">
                  Member
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex-1 max-w-[120px] sm:max-w-[200px] mx-2">
              <div className="flex items-center justify-between text-[8px] font-display tracking-[0.2em] text-muted-foreground mb-1">
                <span>PROGRESS</span>
                <span>{answeredCount}/10</span>
              </div>
              <div className="relative h-1.5 rounded-full overflow-hidden bg-white/5 border border-white/10">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${progressPct}%`,
                    background: `linear-gradient(90deg, ${info.color}, ${info.glow})`,
                    boxShadow: `0 0 8px ${info.glow}`,
                  }}
                />
              </div>
            </div>

            {/* Rank badge */}
            <div className="flex items-center gap-2">
              <RankBadge rank={rank} size={32} />
              <span
                className="font-display text-[9px] tracking-widest uppercase hidden sm:inline"
                style={{ color: info.glow }}
              >
                {info.label}
              </span>
            </div>
          </div>

          {/* Desktop full panel */}
          <div className="hidden lg:flex lg:flex-col lg:gap-6 lg:h-full lg:w-full lg:justify-between flex-1">
            {/* Floating rune deco */}
            <div
              className="pointer-events-none absolute -right-4 -top-4 text-7xl font-display opacity-10 select-none"
              style={{ color: "var(--signal)" }}
            >
              ᛟ
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="CPU Club"
                  className="h-10 w-10 object-contain"
                  style={{
                    mixBlendMode: "screen",
                    filter: "drop-shadow(0 0 10px var(--signal))",
                  }}
                />
                <div>
                  <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
                    CPU CLUB
                  </div>
                  <div className="font-display text-sm tracking-[0.2em]">
                    ISET'COM
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 py-2">
                <RankBadge rank={rank} size={96} />
                <div
                  className="font-display text-sm tracking-[0.25em] rank-glow"
                  style={{ color: info.glow }}
                >
                  {info.label}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-display tracking-[0.3em] text-muted-foreground mb-2">
                  <span>PROGRESS</span>
                  <span>{answeredCount}/10</span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden bg-white/5 border" style={{ borderColor: "color-mix(in oklab, var(--signal) 30%, transparent)" }}>
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{
                      background: `linear-gradient(90deg, ${info.color}, ${info.glow})`,
                      boxShadow: `0 0 12px ${info.glow}`,
                    }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Identity card */}
            <div className="space-y-3 mt-auto pt-4 border-t border-white/5">
              <div>
                <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-1">
                  HUNTER
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={fullName || "hunter"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="font-display text-base tracking-wide"
                  >
                    {fullName || "Hunter"}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div>
                <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-1">
                  ROLE
                </div>
                <span
                  className="inline-block rounded-md px-2.5 py-1 text-xs font-display tracking-[0.2em] uppercase"
                  style={{
                    background:
                      "color-mix(in oklab, var(--signal) 15%, transparent)",
                    border:
                      "1px solid color-mix(in oklab, var(--signal) 50%, transparent)",
                    color: "var(--signal)",
                  }}
                >
                  Member
                </span>
              </div>
              <div className="pt-2 space-y-1">
                <div className="font-jbmono text-[9px] tracking-[0.2em] text-[var(--signal)]/80">
                  AI // EMBEDDED // IOT
                </div>
                <div className="font-jbmono text-[9px] tracking-[0.35em] text-muted-foreground/70">
                  LANG · {lang.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ───── Right chat panel (70%) ───── */}
        <section
          className="relative flex-1 rounded-2xl border bg-black/50 backdrop-blur-md flex flex-col overflow-hidden min-h-[70vh] lg:min-h-0"
          style={{
            borderColor:
              "color-mix(in oklab, var(--signal) 35%, transparent)",
            boxShadow:
              "0 0 40px color-mix(in oklab, var(--signal) 20%, transparent), inset 0 0 40px rgba(0,0,0,0.55)",
          }}
        >
          {/* Solo Leveling gate-opening animation */}
          <GateReveal
            open={gateOpen}
            glow={info.glow}
            onDone={() => setGateOpen(false)}
          />
          {/* Scroll area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-8 py-6 space-y-5"
          >
            {/* LANG step */}
            {step === "lang" && (
              <motion.div
                key="lang"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-7"
              >
                <div
                  className="chat-msg-aria rounded-lg px-4 py-4 text-sm sm:text-base leading-relaxed font-display"
                  style={{ borderLeftWidth: 3 }}
                >
                  <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
                    A.R.I.A
                  </div>
                  <Typewriter
                    text={ARIA_INTRO}
                    speed={35}
                    onDone={() => setIntroTyped(true)}
                    enableSound={true}
                  />
                </div>

                <AnimatePresence>
                  {introTyped && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
                    >
                      {LANG_OPTIONS.map((opt) => {
                        const chosen = langChosen === opt.code;
                        const isJoke = opt.code === "zh"; // 中文: not selectable, just for fun
                        return (
                          <div key={opt.code} className="group relative">
                            <button
                              onClick={() => {
                                if (isJoke) {
                                  setZhJoke(true);
                                  setTimeout(() => setZhJoke(false), 6000);
                                } else {
                                  handleLang(opt.code);
                                }
                              }}
                              disabled={!isJoke && !!langChosen}
                              className="hunter-button hover:hunter-button-hover w-full flex flex-col items-center gap-2 py-4 disabled:cursor-default"
                              style={
                                chosen
                                  ? {
                                    borderColor: "#ffd966",
                                    color: "#ffd966",
                                    boxShadow:
                                      "0 0 30px rgba(255,217,102,0.7), inset 0 0 20px rgba(255,217,102,0.2)",
                                  }
                                  : undefined
                              }
                            >
                              <span className="text-2xl">{opt.flag}</span>
                              <span className="text-xs">{opt.label}</span>
                            </button>
                            {opt.note && !zhJoke && (
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md border border-amber-400/30 bg-black/95 px-3 py-2 text-xs text-amber-200/90 opacity-0 transition-opacity group-hover:opacity-100 z-20 shadow-lg font-body normal-case tracking-normal">
                                {opt.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Funny message when 中文 is clicked — no selection, just fun */}
                <AnimatePresence>
                  {zhJoke && (
                    <motion.div
                      key="zh-joke"
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-md border border-amber-400/40 bg-black/80 px-4 py-3 text-center text-sm text-amber-200 font-body"
                      style={{ boxShadow: "0 0 24px rgba(255,180,60,0.25)" }}
                    >
                      🐉 Très courageux... ou très ambitieux ! Le mandarin, c'est le S-Rank des langues. Respect total, Hunter 🫡
                      <span className="block mt-1 text-xs text-amber-200/60">(Choisis Français ou English pour continuer)</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* IDENTITY step — first + last name (used to identify the email report) */}
            {step === "identity" && (
              <motion.div
                key="identity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="chat-msg-aria rounded-lg px-4 py-4 text-sm sm:text-base leading-relaxed font-display"
                style={{ borderLeftWidth: 3 }}
              >
                <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
                  A.R.I.A
                </div>
                <Typewriter text={t.identityPrompt} speed={35} enableSound={true} />
              </motion.div>
            )}

            {/* PASSWORD step */}
            {step === "password" && (
              <motion.div
                key="password"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div
                  className="chat-msg-user rounded-lg px-4 py-3 text-sm sm:text-base leading-relaxed font-body ml-auto max-w-[85%]"
                  style={{ borderRightWidth: 3 }}
                >
                  {fullName}
                </div>
                <div
                  className="chat-msg-aria rounded-lg px-4 py-4 text-sm sm:text-base leading-relaxed font-display"
                  style={{ borderLeftWidth: 3 }}
                >
                  <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-2">
                    A.R.I.A
                  </div>
                  <Typewriter
                    text={t.passwordTitle}
                    speed={35}
                    enableSound={true}
                  />
                </div>
                {pwError && (
                  <p className="text-center text-sm text-red-400 font-display tracking-widest">
                    {t.passwordWrong}
                  </p>
                )}
              </motion.div>
            )}

            {/* LOCKED step */}
            {step === "locked" && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-red-500/50 bg-red-950/30 px-5 py-6 text-center font-display tracking-widest"
                style={{ boxShadow: "0 0 40px rgba(255,40,40,0.4)" }}
              >
                <div className="text-red-300 text-lg">{t.passwordLocked}</div>
              </motion.div>
            )}

            {/* INTERVIEW chat */}
            {step === "interview" &&
              messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 0,
                    x: m.role === "assistant" ? -16 : 16,
                  }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`${m.role === "assistant" ? "chat-msg-aria" : "chat-msg-user"
                      } max-w-[88%] rounded-lg px-4 py-3 text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${m.role === "assistant" ? "font-display" : "font-body"
                      }`}
                    style={{
                      borderLeftWidth: m.role === "assistant" ? 3 : undefined,
                      borderRightWidth: m.role === "user" ? 3 : undefined,
                    }}
                  >
                    {m.role === "assistant" ? (
                      <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-1">
                        A.R.I.A
                      </div>
                    ) : null}
                    {m.role === "assistant"
                      ? (i === messages.length - 1
                        ? <Typewriter
                          text={m.content}
                          speed={20}
                          enableSound={true}
                          onChar={scrollToBottomInstant}
                          onDone={() => {
                            scrollToBottom();
                            if (pendingDone) {
                              setPendingDone(false);
                              setTimeout(() => setStep("done"), 3000);
                            }
                          }}
                        />
                        : renderMessageContent(m.content))
                      : m.content}
                    {m.role === "user" && m.aiPercent !== undefined && (
                      <div
                        className="ai-badge font-display text-[10px] tracking-wider mt-1.5"
                        style={{
                          color: m.aiPercent > 60 ? "#ff5555" : m.aiPercent > 30 ? "#ffd966" : "#55ff88",
                        }}
                      >
                        Détection AI · {m.aiPercent}%
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

            {/* DONE */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative flex flex-col items-center text-center py-10 gap-6"
              >
                <div
                  className="absolute inset-0 -z-10 pulse-glow"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(240,180,41,0.35) 0%, rgba(157,0,255,0.18) 40%, transparent 70%)",
                    filter: "blur(30px)",
                  }}
                />
                <RankBadge rank="S" size={140} />
                <h2
                  className="font-display text-2xl sm:text-3xl rank-glow"
                  style={{ color: "#ffd966" }}
                >
                  {t.completeTitle}
                </h2>
                <p className="text-muted-foreground font-display tracking-widest text-sm">
                  {t.completeSub}
                </p>
                <p
                  className="font-display text-sm tracking-[0.3em]"
                  style={{ color: "#ffd966" }}
                >
                  {t.rankAchieved} — S-RANK MONARCH
                </p>



                {/* ── Star Rating ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="w-full max-w-md rounded-xl border px-5 py-5"
                  style={{
                    borderColor: "color-mix(in oklab, var(--signal) 40%, transparent)",
                    background: "rgba(0,0,0,0.55)",
                    boxShadow: "0 0 24px color-mix(in oklab, var(--signal) 15%, transparent)",
                  }}
                >
                  <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-3">
                    ⭐ RECOMMENDATION
                  </div>
                  <p className="font-display text-sm tracking-wide mb-4" style={{ color: "#ffd966" }}>
                    {lang === "fr" ? "Notez votre expérience :" : "Rate your experience:"}
                  </p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="text-3xl transition-all hover:scale-125 active:scale-95"
                        style={{
                          color: star <= (rating ?? 0) ? "#ffd966" : "#444",
                          textShadow: star <= (rating ?? 0) ? "0 0 12px #ffd966" : "none",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {rating !== null && (
                    <p className="font-display text-xs tracking-widest text-muted-foreground mt-3">
                      {rating}/5
                    </p>
                  )}
                </motion.div>

                {/* ── Message for President ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="w-full max-w-md rounded-xl border px-5 py-5"
                  style={{
                    borderColor: "color-mix(in oklab, var(--signal) 40%, transparent)",
                    background: "rgba(0,0,0,0.55)",
                    boxShadow: "0 0 24px color-mix(in oklab, var(--signal) 15%, transparent)",
                  }}
                >
                  <div className="font-display text-[10px] tracking-[0.3em] text-muted-foreground mb-3">
                    ✉️ MESSAGE FOR THE EX-PRESIDENT
                  </div>
                  <textarea
                    value={messageToPresident}
                    onChange={(e) => setMessageToPresident(e.target.value)}
                    placeholder={lang === "fr" ? "Écrivez un message pour l'ancien président..." : "Write a message for the ex-president..."}
                    rows={3}
                    className="w-full rounded-lg bg-black/60 border px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 resize-none"
                    style={{
                      borderColor: "color-mix(in oklab, var(--signal) 40%, transparent)",
                    }}
                  />
                </motion.div>

                {/* ── Download Transcript Button ── */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  onClick={downloadConversation}
                  className="hunter-button hover:hunter-button-hover px-6 py-2 text-xs"
                  style={{
                    borderColor: transcriptDownloaded ? "#55ff88" : undefined,
                    color: transcriptDownloaded ? "#55ff88" : undefined,
                  }}
                >
                  📥 {transcriptDownloaded
                    ? (lang === "fr" ? "✓ Téléchargé" : "✓ Downloaded")
                    : (lang === "fr" ? "Télécharger la transcription" : "Download Transcript")}
                </motion.button>

                {/* ── Exit Button (always visible) ── */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  onClick={exitSite}
                  className="hunter-button hover:hunter-button-hover px-8 py-3 text-sm"
                  style={{
                    borderColor: rating !== null && messageToPresident.trim() ? "#55ff88" : "#ff5555",
                    color: rating !== null && messageToPresident.trim() ? "#55ff88" : "#ff5555",
                    boxShadow: rating !== null && messageToPresident.trim()
                      ? "0 0 30px rgba(85,255,136,0.4)"
                      : "0 0 30px rgba(255,85,85,0.4)",
                  }}
                >
                  {reportStatus === "sending"
                    ? (lang === "fr" ? "📧 Envoi du rapport..." : "📧 Sending report...")
                    : (lang === "fr" ? "🚪 TERMINER ET QUITTER" : "🚪 FINISH AND EXIT")}
                </motion.button>
                {/* Email report status */}
                {reportStatus !== "idle" && (
                  <p
                    className="font-jbmono text-[11px] tracking-widest"
                    style={{
                      color:
                        reportStatus === "sent"
                          ? "#55ff88"
                          : reportStatus === "sending"
                            ? "#2BAEE0"
                            : "#ff5555",
                    }}
                  >
                    {reportStatus === "sending" &&
                      (lang === "fr" ? "▸ Envoi du rapport aux responsables..." : "▸ Sending report to staff...")}
                    {reportStatus === "sent" &&
                      (lang === "fr" ? "✓ Rapport envoyé aux responsables" : "✓ Report sent to staff")}
                    {reportStatus === "failed" &&
                      (lang === "fr" ? "⚠ Échec de l'envoi email (voir console serveur)" : "⚠ Email failed (see server console)")}
                  </p>
                )}
              </motion.div>
            )}

            {loading && step === "interview" && (
              <div className="flex justify-start">
                <div
                  className="chat-msg-aria rounded-lg px-3"
                  style={{ borderLeftWidth: 3 }}
                >
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Input bar (Enter only, no buttons) */}
          {(step === "identity" ||
            step === "password" ||
            step === "interview" ||
            step === "locked") && (
              <div
                className="border-t px-4 sm:px-6 py-4"
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--signal) 30%, transparent)",
                  background:
                    "linear-gradient(180deg, transparent, rgba(0,0,0,0.5))",
                }}
              >
                {step === "identity" && (
                  <form onSubmit={submitIdentity} className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t.identityPlaceholder}
                      disabled={loading}
                      className="hunter-input focus:hunter-input-focus w-full rounded-lg pl-4 pr-12 py-3 text-base font-body"
                    />
                    <button
                      type="submit"
                      disabled={loading || !fullName.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-signal hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </form>
                )}
                {step === "password" && (
                  <form onSubmit={submitPassword} className={pwShake ? "shake" : ""}>
                    <div className="relative">
                      <input
                        autoFocus
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPwError(false);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t.passwordPlaceholder}
                        disabled={loading}
                        className={`hunter-input focus:hunter-input-focus w-full rounded-lg px-4 py-3 text-center text-lg tracking-[0.3em] font-display ${pwError ? "!border-red-500" : ""
                          }`}
                        style={
                          pwError
                            ? { boxShadow: "0 0 30px rgba(255,60,60,0.7)" }
                            : undefined
                        }
                      />
                      <button
                        type="submit"
                        disabled={loading || !password}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-signal hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
                      >
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </div>
                  </form>
                )}

                {step === "interview" && (
                  <form onSubmit={sendChat} className="relative">
                    <textarea
                      autoFocus
                      ref={textareaRef}
                      value={input}
                      rows={1}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChat(e);
                        } else {
                          handleKeyDown(e);
                        }
                      }}
                      placeholder={t.inputPlaceholder}
                      disabled={loading}
                      style={{ resize: "none" }}
                      className="hunter-input focus:hunter-input-focus w-full rounded-lg pl-4 pr-12 py-3 block text-base font-body"
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-signal hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </form>
                )}
                {step === "locked" && (
                    <button
                      onClick={reset}
                      className="hunter-button hover:hunter-button-hover w-full"
                    >
                      {t.returnBtn}
                    </button>
                  )}
                {loading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
                    <Loader2 className="h-3 w-3 animate-spin" /> {t.thinking}
                  </div>
                )}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}
