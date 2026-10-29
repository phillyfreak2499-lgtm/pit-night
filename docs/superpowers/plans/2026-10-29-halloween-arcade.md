# Halloween Arcade Implementation Plan

**Goal:** Deliver three daily Halloween team games for captains through October 31 with real, once-daily backend rewards and paid retries.

**Architecture:** A dedicated server function invokes a pure, tested reducer, using the existing season revision compare-and-swap to commit attempt records and balances together. A lazy shell modal consumes only the authorized view and applies returned season snapshots through the existing sync queue.

**Tech Stack:** Existing React, TypeScript, TanStack server functions, Zustand, Zod, PostgreSQL season document and Node crypto. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-halloween-arcade-design.md`

## Global constraints

October 29–31, 2026, America/Chicago. Captain only. One free attempt and at most one win per store/day. Every retry after a loss costs 10 Bolts, explicitly confirmed by its button. Reward 2–4 coins in one random existing category. Invite teammates before starting. Server owns date, difficulty, puzzle and payout; never accept a client verdict.

## Review focus

- Multiple tabs and repeated requests: no duplicate rewards or retry charges.
- Midnight/event expiry and stale attempts: no playing another day’s challenge.
- Public, crew, commissioner and cross-store access: no gameplay or answer leakage.
- Login/logout during requests and overlapping dialogs: no stale modal or cross-session data application.
- Mobile and reduced motion: all three games understandable, operable and fully visible.

## Tasks

- [x] Backend: write failing tests for date boundaries, roles, difficulty, challenge grading, coins, retries, idempotency and unchanged balances on rejection; implement `halloween-arcade.ts` and its server endpoint.
- [x] Persistence: preserve optional game records through seed normalization/shared serialization, strip them from all client projections, and test those boundaries.
- [x] Sync: add an awaited, queued game wrapper that applies only verified snapshots and returns errors to its caller.
- [x] UI: build the team invitation, three distinct game boards, explicit retries and result screen; mount behind existing shell modal priorities.
- [x] Verify targeted tests, full suite, typecheck, focused lint, production build, plus desktop/mobile browser flows and all three game presentations. CI will independently run the development build.
- [ ] Review, merge and deploy through the existing GitHub/Vercel pipeline, then verify production state and record release evidence.

## Pre-release evidence

- Full test suite: 473 passed, 4 existing skips, 0 failed. Includes 20 new arcade/persistence tests and real PGlite races for duplicate claims, starts, retries, rewards and competing Bolt purchases.
- TypeScript, focused ESLint and production build passed. No dependency or database-schema changes.
- Development browser: a correct hat answer awarded 2 Drive coins, persisted after reload, and closed the day's reward opportunity. Friday pumpkin memory and Saturday potion sequence were played successfully using an isolated, temporary board harness that was removed before the production build.
- Production-build browser: verified captain sign-in, starter selection, automatic invitation, dismissal/reload without a repeated invitation, and preserved free attempt. Phone viewport 390×844 had no horizontal overflow; future-day boards also fit phone widths.
- Independent final review found no release blockers. Reduced-motion swap directions are provided; OS-level reduced-motion emulation was not exercised.
- Tests use isolated local data. Production account play requires an actual captain code; release verification must not spend real store Bolts or claim their daily rewards.
