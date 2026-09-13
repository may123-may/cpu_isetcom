export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export interface RankInfo {
  rank: Rank;
  label: string;
  /** rank color (rgba/hex) and glow color */
  color: string;
  glow: string;
}

export const RANKS: Record<Rank, RankInfo> = {
  E: { rank: "E", label: "E-Rank Hunter", color: "#1a3a5c", glow: "#3a7ab8" },
  D: { rank: "D", label: "D-Rank Hunter", color: "#1e6fc8", glow: "#3aa0ff" },
  C: { rank: "C", label: "C-Rank Hunter", color: "#5b3fcf", glow: "#8a6cff" },
  B: { rank: "B", label: "B-Rank Hunter", color: "#7b2fd4", glow: "#b276ff" },
  A: { rank: "A", label: "A-Rank Hunter", color: "#9d00ff", glow: "#d27bff" },
  S: { rank: "S", label: "S-RANK MONARCH", color: "#f0b429", glow: "#ffd966" },
};

/** Map number of answered questions (0..10) to a rank. */
export function rankForAnswers(n: number): Rank {
  if (n >= 10) return "S";
  if (n >= 9) return "A";
  if (n >= 7) return "B";
  if (n >= 5) return "C";
  if (n >= 3) return "D";
  return "E";
}
