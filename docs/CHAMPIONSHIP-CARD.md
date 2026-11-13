# Championship card

## Rules

- Conference berths use regular-season win-loss record only. A first-place tie automatically adds a fight after the Week 4 regular card. Two contenders duel; three or more battle together. Head-to-head, sales, grades, seed, and Bolts do not narrow the field.
- Every store must have exactly one posted regular fight in each of Weeks 1–4 before a berth can resolve. A recorded berth fight must contain the complete tied field in its teams, store IDs, and fighter snapshots.
- Equal records share a displayed place. Alphabetical listing is not a tiebreak. Berth fights do not alter the four-game regular-season record.
- Week 5 starts with all non-finalists in the Third Place Royal Rumble. With the current league this is 12 bots. The last surviving bot earns third place; the two finalists follow in the Waterman Championship.
- Title and berth duels end only with a completed pit throw. The Rumble and multi-bot berth fights continue until one survivor. No judge, round cap, or HP-based winner is used in these modes. Physical progress toward the pit comes from the existing combat state, with a minimum positive shove ensuring continuation terminates. Ordinary duels, tag fights, and generic melees retain their rules.
- The weekly last-place repair voucher is unchanged. Championship preparation remains finalist-only. Non-finalists bring their earned builds; no free upgrades, currency, or combat advantage is added.

## Presentation

The shared Week 5 opening brings all store bots together for Team Janelle before the first fight, with pause, skip, replay, and reduced-motion support. It contains no medical specifics. The title has two 12-second finalist hero stages with spotlights, smoke, sparks, and pyro. Actual pit falls get debris and an IN THE PIT replay label, followed by a gold winner reveal, confetti, and fireworks.

Large fields use a wider arena and camera, scaled bots, contestant numbering, a compact roster, and expandable build details. Pit positions are recorded with the result, so replays use the correct arena. Presentation never changes results or grants equipment.

## One-time Week 3 repairs

Only the Vercel production deployment can activate the gift. Preview, development, and missing VERCEL_ENV fail closed. The gate also requires Period 12, Week 3, phase open/locked/inspected, and a time from November 13, 2026 00:00 UTC until November 16, 2026 06:00 UTC, exclusive. Fought waits for inspection so pending damage is not consumed prematurely.

The repair clears all bot and owned-part wear, weld state, and repair quotes without spending or changing coins, vouchers, Bolts, builds, history, or results. Activation uses an exact verified backup, compare-and-swap revision update, persistent once-only marker, readback checks, and audit log. Live verification must confirm the production context and successful audit; deployment alone is not proof that repairs occurred. Do not extend the date window silently.

## Fresh validation

This source was reconstructed after a workspace loss and tested again. Earlier lost-tree results do not certify this version.

- 334 league tests passed.
- 201 script tests passed; four pre-existing skips.
- 55 auth/app-data tests passed.
- 590 passed in total, plus four skips.
- Typecheck, production build without database credentials, and development build passed.
- Independent review includes a five-week simulation and authoritative backup/CAS/idempotence/failure tests.
- Desktop/mobile native canvas renders were inspected. Full interactive browser QA remains unverified because the local browser route was unavailable; no access restriction was bypassed.
- Long title duels can take about 39 minutes at normal playback speed; existing 2x/4x controls remain available. The fight outcome is never shortened by an arbitrary winner.

No database migration or deployment configuration changes are included. GitHub CI and the exact production deployment must be checked separately before calling the release live.
