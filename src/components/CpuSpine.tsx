/**
 * CpuSpine — the signature motif (prompt.txt §2): a thin cyan trace line
 * running down the left edge of the page. A bright packet travels along it,
 * driven by scroll progress. Quiet, technical, always present.
 */
export default function CpuSpine({ progress = 0 }: { progress?: number }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 bottom-0 z-40 hidden sm:block w-[3px]"
    >
      {/* base trace */}
      <div
        className="absolute inset-y-0 left-0 w-[1px]"
        style={{ background: "rgba(28,110,140,0.55)" }}
      />
      {/* flowing signal */}
      <div className="absolute inset-y-0 left-0 w-[1px] spine-flow opacity-70" />
      {/* scroll packet */}
      <div
        className="spine-packet absolute left-1/2 -translate-x-1/2 w-[5px] h-[26px] rounded-full"
        style={{ top: `calc(${pct}% - 13px)`, background: "#2BAEE0" }}
      />
      {/* nodes */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[7px] h-[7px] rotate-45"
        style={{ top: 8, background: "#0A0D11", border: "1px solid #2BAEE0" }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[7px] h-[7px] rotate-45"
        style={{ bottom: 8, background: "#0A0D11", border: "1px solid #2BAEE0" }}
      />
    </div>
  );
}
