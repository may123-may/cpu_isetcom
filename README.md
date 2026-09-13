# CPU Club Interview

A dungeon-themed AI interview platform built with **TanStack Start**, **React 19**, and **Tailwind CSS**. Candidates progress through a gamified interview experience with language selection, identity verification, password protection, and a final ranking system (E-Rank to S-Rank MONARCH).

##  Overview

The application simulates an interview process hosted by **A.R.I.A** (AI interviewer). Candidates navigate through several stages:

- **Video Intro** - Opening animation
- **Language Selection** - Choose between Français, English, or 中文
- **Self Definition** - Describe yourself to the AI
- **Password Protection** - Verify access code
- **Interview** - Answer questions with AI response detection
- **Ranking** - Receive E-S to S-Rank based on performance
- **Feedback** - Rate experience and message the ex-president

##  Tech Stack

| Category | Technologies |
|----------|-------------|
| Framework | [TanStack Start](https://tanstack.com/router) + React 19 |
| UI | Radix UI components, Tailwind CSS 4, Framer Motion |
| State & Query | @tanstack/react-query, @tanstack/react-router |
| Styling | Tailwind CSS, clsx, tailwind-merge |
| Icons | Lucide React |
| AI Features | Custom AI detection, key sounds |
| Internationalization | Custom i18n system (fr/en/zh) |
| Server | TanStack Start server middleware |

##  Getting Started

### Prerequisites

- Node.js >= 18
- pnpm, npm, or bun

### Installation

```bash
# Install dependencies
bun install
# or
npm install
# or
pnpm install
```

### Development

```bash
# Start development server
bun run dev
# or
npm run dev
# or
pnpm dev
```

The app will be available at `http://localhost:8080` (default TanStack Start port).

### Build

```bash
bun run build
# or
npm run build
# or
pnpm build
```

### Preview

```bash
bun run preview
# or
npm run preview
```

##  Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

The `.env.example` file contains configuration for Supabase integration and other environment variables needed for the full interview flow (AI detection, password verification, etc.).

##  Project Structure

```
src/
├── assets/           # Static assets (logo, images)
├── components/       # UI components (Radix, custom, ui/)
├── hooks/           # Custom hooks (use-mobile)
├── integrations/    # Supabase and third-party integrations
├── lib/             # Utility functions and data
│   ├── ranks.ts     # Rank system (E to S)
│   ├── i18n.ts      # Internationalization (fr/en/zh)
│   ├── utils.ts     # Helper functions (cn class merging)
│   ├── error-capture.ts
│   ├── error-page.ts
│   ├── keySound.ts
│   └── aria.functions.ts  # Server functions (identify, verifyPassword, etc.)
├── routes/          # File-based routing (TanStack Start)
│   ├── index.tsx    # Root route /
│   ├── __root.tsx   # App shell
│   └── README.md    # Route conventions
├── router.tsx       # Router configuration
├── server.ts        # Server entry point
└── start.ts         # Start instance configuration
```

### Key Routes

| File | URL |
|------|-----|
| `src/routes/index.tsx` | `/` (main interview) |
| `src/routes/__root.tsx` | App shell (wraps all pages) |

Routes follow TanStack Start file-based conventions - see `src/routes/README.md` for details.

##  Features

- **Dungeon-themed UI** with animated background and cinematic typography
- **Multi-language support** (Français, English, 中文) with right-to-left support
- **Rank system** from E-Rank to S-RANK MONARCH based on answered questions
- **AI content detection** on candidate responses
- **Transcript download** as text file with conversation, rating, and role selection
- **Supabase authentication** integration (via `attachSupabaseAuth` middleware)
- **Animated typewriter** effects for AI dialogue
- **Interactive rank badges** with gradient colors and glow effects
- **Progress tracking** throughout the interview
- **Exit validation** - ensures all steps are completed before leaving

##  Utilities

### `cn(...inputs)` (`src/lib/utils.ts`)

Merge Tailwind classes safely using `clsx` and `tailwind-merge`:

```tsx
import { cn } from "@/lib/utils";

// Example
cn("bg-blue-500", "bg-red-500") // => "bg-blue-500" (if only one matches)
```

### Rank System (`src/lib/ranks.ts`)

```typescript
type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export function rankForAnswers(n: number): Rank;
```

Maps number of answered questions (0-10) to a rank:
- 10 answers → S-Rank
- 9 → A-Rank
- 7 → B-Rank
- 5 → C-Rank
- 3 → D-Rank
- 0-2 → E-Rank

##  Available Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start development server |
| `build` | Build for production |
| `build:dev` | Build in development mode |
| `preview` | Preview production build |
| `lint` | Run ESLint |
| `format` | Format with Prettier |

##  Development Notes

- **TypeScript** is strict (`strict: true` in tsconfig)
- Path aliases: `@/*` maps to `src/*` (via tsconfig.json)
- Tailwind CSS 4 with `tailwind-merge` for class conflicts
- TanStart file-based routing - avoid creating `src/pages/`
- Supabase auth is attached via request middleware in `src/start.ts`
- ESLint configured with React hooks, Prettier, and custom plugins

##  License

This project is connected to [Lovable](https://lovable.dev). See the connected branch for published history.

---

Built the CPU Club interview process.
