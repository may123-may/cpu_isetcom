import { createFileRoute } from "@tanstack/react-router";
import InterviewApp from "@/components/InterviewApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CPU Club — ARIA Hunter Trials" },
      {
        name: "description",
        content:
          "Enter the dungeon. CPU Club's AI-powered ranking trials, led by ARIA — Autonomous Ranking Intelligence Agent.",
      },
      { property: "og:title", content: "CPU Club — ARIA Hunter Trials" },
      {
        property: "og:description",
        content: "Solo Leveling-style AI interview for CPU Club ISET'COM Branch.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <InterviewApp />;
}
