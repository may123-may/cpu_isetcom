import { useEffect, useRef } from "react";

interface Props {
  /** rank-glow color as hex like "#5b3fcf" — used as a faint progress tint only */
  glow: string;
}

/**
 * SchematicBackground — hardware-brand backdrop (prompt.txt §2):
 *   L1 — ink base + faint cyan radial
 *   L2 — blueprint grid (CSS)
 *   L3 — PCB traces with flowing signal dashes (SVG)
 *   L4 — slow data-particle canvas, cyan/steel
 * No runes, no dungeon rings — line-art in the club's own language.
 */
export default function DungeonBackground({ glow }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- canvas data particles (slow, quiet) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#2BAEE0", "#1C6E8C", "#8B96A1"];
    type P = { x: number; y: number; r: number; vy: number; drift: number; phase: number; color: string; base: number };
    const particles: P[] = Array.from({ length: 55 }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.2,
      vy: 0.08 + Math.random() * 0.25,
      drift: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      base: 0.25 + Math.random() * 0.55,
    }));

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        p.y -= p.vy;
        p.x += Math.sin(t * 0.5 + p.phase) * p.drift * 0.3;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        const flicker = p.base * (0.7 + 0.3 * Math.sin(t * 2 + p.phase * 2));
        ctx.globalAlpha = Math.max(0, Math.min(1, flicker));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* L1 ink base + faint signal radial + rank progress tint */}
      <div className="absolute inset-0" style={{ background: "#0A0D11" }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(43,174,224,0.07) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 45% 35% at 80% 85%, ${glow}14 0%, transparent 70%)`,
        }}
      />

      {/* L2 blueprint grid */}
      <div className="absolute inset-0 schem-grid opacity-80" />

      {/* L3 PCB traces */}
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-40"
      >
        <g fill="none" stroke="#1C6E8C" strokeWidth="1.5">
          <path d="M -20 640 H 260 V 480 H 480 V 600 H 700" />
          <path d="M 1220 220 H 940 V 340 H 760 V 240 H 600" />
          <path d="M -20 120 H 180 V 260 H 340" />
          <path d="M 1220 660 H 1000 V 540" />
        </g>
        <g fill="none" stroke="#2BAEE0" strokeWidth="1.5" className="trace-flow">
          <path d="M -20 640 H 260 V 480 H 480 V 600 H 700" />
          <path d="M 1220 220 H 940 V 340 H 760 V 240 H 600" />
        </g>
        <g fill="#0A0D11" stroke="#2BAEE0" strokeWidth="1.5">
          <circle cx="260" cy="640" r="4" className="schem-blink" />
          <circle cx="480" cy="480" r="4" className="schem-blink" style={{ animationDelay: "0.7s" }} />
          <circle cx="940" cy="220" r="4" className="schem-blink" style={{ animationDelay: "1.3s" }} />
          <circle cx="760" cy="340" r="4" className="schem-blink" style={{ animationDelay: "1.9s" }} />
        </g>
      </svg>

      {/* L4 data particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
