// Mechanical keyboard click synthesized with Web Audio API.
// No assets needed. Slight randomization so it doesn't feel robotic.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function playKey(variant: "key" | "enter" | "backspace" = "key") {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Short noise burst → mechanical "tac"
  const bufferSize = Math.floor(ac.sampleRate * 0.04);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Decaying noise
    const decay = Math.pow(1 - i / bufferSize, 3);
    data[i] = (Math.random() * 2 - 1) * decay;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value =
    variant === "enter" ? 1400 : variant === "backspace" ? 1800 : 2200 + Math.random() * 600;
  bp.Q.value = 6;

  const gain = ac.createGain();
  const peak = variant === "enter" ? 0.18 : 0.09;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  noise.connect(bp).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.06);

  // Subtle low thud for the "key bottom-out"
  if (variant === "enter") {
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
    og.gain.setValueAtTime(0.15, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(og).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

export function keyHandler(e: { key: string }) {
  if (e.key === "Enter") playKey("enter");
  else if (e.key === "Backspace" || e.key === "Delete") playKey("backspace");
  else if (e.key.length === 1) playKey("key");
}
