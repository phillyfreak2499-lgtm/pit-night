# Site Upgrade Implementation Plan

> Use superpowers:executing-plans. User approved the written design and explicitly requested implementation on the existing draft PR.

**Goal:** Implement the approved fundamentals entrance, visual/usability improvements and reduced rendering/polling work.
**Architecture:** A shared server-only request gate runs before Vite and Nitro, with a Vercel routing rule protecting static files. Existing role authorization remains behind it. Focused scheduling and UI primitives support the current canvas renderer.
**Tech Stack:** React, Radix Dialog, Canvas 2D, TanStack Start, Nitro, Node crypto, PostgreSQL/PGLite.
**Spec:** ../specs/2026-10-22-site-upgrade.md

## Global Constraints
Keep draft PR #4, fourteen-store rules, existing authentication and cosmetics unchanged. No production merge/deploy/code rotation. Eight-hour entrance cookie; randomized numbered challenge; bounded typo tolerance. Preserve platform branding and preview bridge.

## Review Focus
Cookie forgery/expiry, direct API and CDN asset access, role changes at unchanged revision, overlapping polls, paused/hidden playback seek and resume.

### Task 1: Server entrance
Files: scripts/fundamentals-gate.mjs + test, scripts/fundamentals-vite.mjs, server/middleware/01-fundamentals.ts, vite.config.ts, vercel.json.
Interface: handleFundamentalsRequest(Request): Promise<Response|null>; null allows the request. answerMatches(number, answer): boolean.
- [ ] Tests first: exact/typo/wrong-number answers, tampering, expiration, origin, direct paths and assets, rate limits.
- [ ] Shared gate implementation with opaque encrypted challenge, signed entry cookie, persisted attempt counters, no-store HTML/form; production and development adapters.
- [ ] Run gate tests; verify built routing protects static paths.

### Task 2: Rendering and synchronization
Files: frame-loop.ts, broadcast.tsx, bot-portrait.tsx, secure-sync.ts, store.ts, authoritative.ts.
Interface: createFrameLoop(draw, options) yields invalidate/dispose; draw returns whether another frame is needed.
- [ ] Test scheduling suspension/resumption, equality and single-flight polling first.
- [ ] Stop idle/paused/offscreen work; guard unchanged state, persistence and session projections. Cheap authenticated revision path after versioned normalization.
- [ ] Run tests/typecheck; record browser scheduling measurements.

### Task 3: Garage and overlays
Files: modal.tsx, garage-page.tsx, shell.tsx, starter-body-picker.tsx, tutorial.tsx, bay-lock.tsx.
- [ ] Accessible shared Radix dialog; convert overlays; lazy starter selector; More navigation.
- [ ] Collapsible cosmetics with owned filter and touch-readable locked-item requirement dialogs; keep previews and proposal controls intact.
- [ ] Desktop/phone/keyboard browser verification.

### Task 4: Physical bot detail
Files: cage-draw.ts, material-detail.ts.
- [ ] Add size-aware armor seams, bevel lighting, vents, fasteners and wheel depth consistently to side/top views. Preserve cosmetics, scars and hidden weapons.
- [ ] Compare representative body/finish/wear views at desktop and phone sizes; verify combat tests unchanged.

### Task 5: Verify and publish
- [ ] Full tests, typecheck, build:dev, local API and browser QA, fresh independent review.
- [ ] Update release documents and PR #4, publish changes, confirm hosted checks. Record hosted access gap accurately.

## Execution ledger
Ruling: execute directly following the user's explicit instruction to take care of the approved design; no further design approval round.
Pre-flight: gate's request adapter is shared by dev and production; frame loop is shared by portrait and broadcast; dialog supports details, navigation and existing overlays.

Tasks 1–4 complete. Gate and rendering/persistence tests passed; the real local API suite passed behind the entrance. Browser QA caught and fixed native rAF binding and delayed dialog-focus restoration. Independent review caught redirect normalization, negation and edge environment binding; regressions pass. Task 5 is in final compiled QA/publishing; hosted interactive QA remains blocked by Vercel team access. No production mutation occurred.
