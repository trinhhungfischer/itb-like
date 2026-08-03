<p align="center">
  <h1 align="center">🪐 VANGUARD</h1>
  <p align="center">
    <strong>A Deterministic Tactical Roguelike</strong>
    <br />
    Built with TypeScript + PixiJS + Vite — Developed under the Claude Code Game Studios Framework
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href=".claude/agents"><img src="https://img.shields.io/badge/CCGS%20agents-49-blueviolet" alt="49 Agents"></a>
  <a href=".claude/skills"><img src="https://img.shields.io/badge/CCGS%20skills-73-green" alt="73 Skills"></a>
  <a href="https://docs.anthropic.com/en/docs/claude-code"><img src="https://img.shields.io/badge/built%20for-Claude%20Code-f5f5f5?logo=anthropic" alt="Built for Claude Code"></a>
</p>

---

## 🛰️ Elevator Pitch

> **VANGUARD** is a deterministic tactical roguelike where you command a tiny squad of piloted mechs — each defined by one unique board-manipulating verb — across a procedurally routed campaign, winning every fully-telegraphed battle by **position and foresight, not damage or luck**.
>
> *"Into the Breach meets Slay the Spire"* — outsmart enemies on a chess-like grid where the roster and build change every run, but in-battle simulation remains 100% predictable and under your control.

---

## 🗺️ Table of Contents

- [Core Identity & Design Pillars](#-core-identity--design-pillars)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [How to Play / Playtest Demo](#-how-to-play--playtest-demo)
- [Claude Code Game Studios (CCGS) Framework](#-claude-code-game-studios-ccgs-framework)
  - [The Collaborative Protocol](#the-collaborative-protocol)
  - [Studio Agent Hierarchy](#studio-agent-hierarchy)
  - [Useful Slash Commands (Skills)](#useful-slash-commands-skills)
  - [Automated Safety & Quality Hooks](#automated-safety--quality-hooks)
  - [Path-Scoped Rules](#path-scoped-rules)
- [Project Directory Structure](#-project-directory-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Core Identity & Design Pillars

VANGUARD is built upon five unshakeable pillars, ensuring a tight, satisfying tactical experience:

### 1. Perfect Information, Perfect Blame
Every enemy action is fully telegraphed one turn ahead. A comprehensive **move preview** shows the full consequence of every action before you commit. There are no hit-chance RNGs or critical rolls. Success is a product of calculation; failure is a legible lesson.

### 2. Positioning Over Power
Battles are won by altering space, not racing damage numbers. Shoving, pulling, swapping, and throwing units into terrain hazards (Chasms, Smoke, Water) or into each other are your primary tools.

### 3. Variety Lives in the Draft, Not the Dice
Roguelike replayability comes from the choices you make *between* battles — drafting mechs, selecting pilots, and unlocking modules. Once you enter a battle, the system is fully deterministic.

### 4. Every Mech is a Verb
Mechs are not generic stat-sticks. Each mech is defined by one signature board-manipulation verb (e.g., *Shove*, *Pull*, *Swap*, *Wall*, *Zone*) and a distinct movement pattern.

### 5. Read in Ten Seconds
The entire state of a battle must be understandable in a single glance. Silhouettes are distinct, hazard markers are high-contrast, and enemy intents are displayed via clear icons on the tiles.

---

## 💻 Technology Stack

VANGUARD is a pure web game that runs entirely in the browser without requiring heavy native engines:

*   **Language:** TypeScript (strict mode)
*   **Rendering & Graphics:** [PixiJS 8.x](https://pixijs.com/) (High-performance 2D WebGL with Canvas2D fallback)
*   **Build System & Development Server:** [Vite 6.x](https://vite.dev/)
*   **Testing Suite:** [Vitest 3.x](https://vitest.dev/)
*   **State Persistence:** `localStorage` (with cryptographic checksum integrity validation and robust save-schema versioning)

---

## 🚀 Getting Started

Follow these steps to set up the local development environment:

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and [npm](https://www.npmjs.com/) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Donchitos/Claude-Code-Game-Studios.git vanguard
   cd vanguard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Command Reference

| Command | Action |
|---------|--------|
| `npm run dev` | Starts the Vite local development server on `http://localhost:5173` |
| `npm run build` | Runs the TypeScript compiler (`tsc`) and builds the production bundle via Vite |
| `npm run preview` | Previews the compiled production build locally |
| `npm run typecheck` | Validates TypeScript type safety across the source and test directories |
| `npm test` | Runs the Vitest deterministic unit and integration test suites |
| `npm run test:watch` | Runs Vitest in watch mode for active test-driven development |

---

## 🎮 How to Play / Playtest Demo

VANGUARD includes an interactive command-line **Playtest Demo** showcasing the core mechanics of Sprint 2, including:
- Unit placement and initial state query
- Enemy intent generation and AI behavior
- Active hazard placement (Smoke Grenades)
- Real-time enemy re-evaluation (determinism & AI)
- Combat resolution (Passive: Shatter Strike)

Run the demo script locally:
```bash
npx tsx demo.ts
```

---

## 🤖 Claude Code Game Studios (CCGS) Framework

This repository is built as part of **Claude Code Game Studios**, a framework that coordinates **49 specialized subagents** across **73 skills** inside a single [Claude Code](https://docs.anthropic.com/en/docs/claude-code) AI session. It models the operational structure of a real-world game development studio.

### The Collaborative Protocol

The AI subagents in this repository do **not** run autonomously. They operate under a strict **Collaborative Protocol** designed to keep you, the Creative Director, in absolute control:

```
Question ──> Options ──> Decision ──> Draft ──> Approval ──> Write
```

1.  **Ask:** The subagent asks clarifying questions before writing or modifying files.
2.  **Options:** The subagent presents 2-4 distinct solutions with pros/cons.
3.  **Decision:** You choose the path that matches your vision.
4.  **Draft:** The subagent drafts the change or design document.
5.  **Approval:** You review the draft and provide feedback. No file writes happen without your explicit confirmation.

### Studio Agent Hierarchy

The studio is organized into three tiers matching professional production teams:

```
Tier 1 — Directors (Opus)
  creative-director    technical-director    producer

Tier 2 — Department Leads (Sonnet)
  game-designer        lead-programmer       art-director
  audio-director       narrative-director    qa-lead
  release-manager      localization-lead

Tier 3 — Specialists (Sonnet/Haiku)
  gameplay-programmer  engine-programmer     ai-programmer
  network-programmer   tools-programmer      ui-programmer
  systems-designer     level-designer        economy-designer
  technical-artist     sound-designer        writer
  world-builder        ux-designer           prototyper
  performance-analyst  devops-engineer       analytics-engineer
  security-engineer    qa-tester             accessibility-specialist
  live-ops-designer    community-manager
```

### Useful Slash Commands (Skills)

When running a session in `claude`, use these built-in slash commands to manage the studio workflows:

*   `/start` — Triggers guided onboarding and stage detection.
*   `/help` — Displays the comprehensive workflow catalog.
*   `/design-system [system]` — Crafts a structured design document.
*   `/create-stories` — Breaks an epic into actionable, scoped stories.
*   `/dev-story` — Launches a specialist to implement a story.
*   `/story-done` — Runs QA checks and marks a story complete.
*   `/skill-test` — Validates the CCGS agent/skill framework structures.
*   `/code-review` — Triggers a comprehensive code quality gate.

### Automated Safety & Quality Hooks

To prevent regressions, hardcoding, and broken states, several automated hooks run within the session (defined under `.claude/hooks/`):

-   `validate-commit.sh` — Checks for hardcoded magic numbers, TODO formats, and malformed files before permitting a git commit.
-   `detect-gaps.sh` — Scans for missing design documents or mismatched source code on session start.
-   `validate-assets.sh` — Validates naming conventions and structure for all static resources.

### Path-Scoped Rules

Specific coding standards are automatically enforced by Claude depending on where in the repository code is being written (defined under `.claude/rules/`):

| Path | Standard Enforced |
|------|-------------------|
| `src/gameplay/**` | Data-driven variables, delta-time execution, no UI dependencies. |
| `src/core/**` | Zero allocations in hot paths, absolute thread safety, high performance. |
| `src/ui/**` | Complete decoupling from core game states, localization readiness, strict accessibility gates. |

---

## 📂 Project Directory Structure

```
├── .claude/                        # Claude Code configuration, hooks, rules, and agents
├── CCGS Skill Testing Framework/   # Behavioral testing specs for agents and skills (optional)
├── assets/                         # Art bibes, static textures, and localized audio files
├── design/                         # Game Design Documents (GDDs), GDD reviews, and UX specs
│   ├── architecture/               # System and contract documentation
│   ├── content/                    # Roster tables, enemy catalogs, and weapon schemas
│   └── gdd/                        # Core system GDDs (combat, board, abilities, draft)
├── docs/                           # Technical documentation, diagrams, and ADRs
│   └── architecture/               # Architectural Decision Records (ADRs 0001-0013)
├── production/                     # Agile sprint management and milestone tracking
│   ├── epics/                      # Epic backlogs and individual story sheets
│   └── qa/                         # Quality plans, smoke check scripts, and test evidence
├── prototypes/                     # Isolated throwaway prototypes and exploratory code
├── src/                            # Vanguard core production source code
│   ├── core/                   # Pure deterministic engine logic (board, combat, preview)
│   ├── feature/                # Feature-level modules (enemies, pilots, HUD, settings)
│   ├── foundation/             # Base primitives (PRNG, persistence layer, accessibility)
│   └── presentation/           # Rendering layer (PixiJS canvas components & UI)
└── tests/                          # Automated Vitest suites (unit, integration, and features)
```

---

## 🤝 Contributing

This project is built to showcase professional game design pipelines integrated with AI agent assistance. Contributions are welcome for bug fixes, code optimizations, and skill enhancements! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

When submitting changes, please follow the [Conventional Commits](https://www.conventionalcommits.org/) convention:
```bash
feat: add /retrospective skill for end-of-sprint reviews
fix: resolve board boundary collision edge case
docs: update technical-preferences with PixiJS 8 constraints
```

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
