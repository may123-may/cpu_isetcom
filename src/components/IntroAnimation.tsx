import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import logoUrl from "@/assets/cpu-logo.png";

const BOOT_LINES = [
  "> initializing CPU_ROBOTICS_CLUB ... OK",
  "> domains: AI // EMBEDDED // IOT ... OK",
  "> access: GRANTED",
];

const TRACE_PATH =
  "M -20 460 H 200 V 320 H 360 V 200 H 520 V 300 H 680 V 160 H 830";

/**
 * BootSequence — the site's ONE big animation moment (prompt.txt §3):
 *  1. cyan PCB trace draws itself (SVG stroke animation)
 *  2. CPU wordmark snaps in with flicker/glitch, cyan ignites
 *  3. terminal types the boot log, monospace
 * Total < 2.5s, click to skip, instant for reduced-motion users.
 */
export default function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  const [logoOn, setLogoOn] = useState(false);
  const [typed, setTyped] = useState<string[]>([]);
  const calledRef = useRef(false);

  const finish = () => {
    if (calledRef.current) return;
    calledRef.current = true;
    setShow(false);
    setTimeout(onDone, 380);
  };

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = setTimeout(finish, 350);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Logo snaps in as the trace finishes
    timers.push(setTimeout(() => setLogoOn(true), 550));

    // Terminal typing — fast, staggered after the logo ignites
    const full = BOOT_LINES.join("\n");
    let i = 0;
    const startTyping = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setTyped(full.slice(0, i).split("\n"));
        if (i >= full.length) {
          clearInterval(id);
          timers.push(setTimeout(finish, 420));
        }
      }, 11);
      timers.push(id as unknown as ReturnType<typeof setTimeout>);
    }, 950);
    timers.push(startTyping);

    // Hard cap — never trap the user
    timers.push(setTimeout(finish, 4000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="boot"
          exit={{ y: "-100%", opacity: 0.4 }}
          transition={{ duration: 0.35, ease: [0.7, 0, 0.3, 1] }}
          onClick={finish}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden cursor-pointer"
          style={{ background: "#0A0D11" }}
          role="button"
          aria-label="Skip intro"
        >
          {/* 1 — PCB trace drawing itself */}
          <svg
            aria-hidden
            viewBox="0 0 800 600"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full opacity-70"
          >
            <path
              d={TRACE_PATH}
              fill="none"
              stroke="#2BAEE0"
              strokeWidth="2"
              className="boot-trace"
            />
            {[
              [200, 460], [200, 320], [360, 320],
              [360, 200], [520, 200], [520, 300], [680, 300], [680, 160],
            ].map(([cx, cy], k) => (
              <circle
                key={k}
                cx={cx}
                cy={cy}
                r="4"
                fill="#0A0D11"
                stroke="#2BAEE0"
                strokeWidth="2"
                className="boot-node"
                style={{ animationDelay: `${0.15 + k * 0.06}s` }}
              />
            ))}
          </svg>

          <div className="relative z-10 flex flex-col items-center gap-6 px-6">
            {/* 2 — wordmark power-on: flicker, then cyan ignites */}
            {logoOn && (
              <img
                src={logoUrl}
                alt="CPU Club ISET'COM Branch"
                className="boot-flicker w-[52vmin] max-w-[440px]"
                style={{ mixBlendMode: "screen" }}
                onAnimationEnd={(e) => {
                  if (e.animationName === "boot-flicker") {
                    (e.target as HTMLImageElement).classList.add("boot-ignite");
                  }
                }}
              />
            )}

            {/* 3 — terminal boot log */}
            <div className="font-jbmono text-[11px] sm:text-xs leading-relaxed text-left w-[52vmin] max-w-[440px] min-h-[3.5rem]">
              {typed.map((line, k) => (
                <div key={k} style={{ color: line.includes("GRANTED") ? "#2BAEE0" : "#8B96A1" }}>
                  {line}
                  {k === typed.length - 1 && <span className="term-caret" />}
                </div>
              ))}
            </div>
          </div>

          {/* skip hint */}
          <div className="absolute bottom-6 font-jbmono text-[10px] tracking-[0.3em] text-[#8B96A1]/60 select-none">
            CLICK TO SKIP
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
