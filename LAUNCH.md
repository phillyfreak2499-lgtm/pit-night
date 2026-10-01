# Launch configuration and validation

The public league uses its own server-verified roles. The legacy template's external sign-in gate stays disabled in `.grok/app-env.json`; this does not disable league authorization.

## Before deployment

1. Back up the Neon `pit_season` row. Apply migrations using `npm run db:migrate` with the production `DATABASE_URL`. Migration 0003 preserves the season, removes the exposed PIN/passcodes, and creates hashed credentials and expiring sessions.
2. Rotate **every previously exposed code**. Configure server-only Vercel variables, never `VITE_` variables:
   - `PIT_DESK_PIN`: a new 4–8 digit commissioner code.
   - `PIT_CAPTAIN_CODES`: JSON mapping all 11 store IDs to separate new captain codes.
   - `PIT_BAY_CODES`: JSON mapping all 11 store IDs to new crew codes. A store's crew and captain codes must differ.
   - `PIT_CODE_VAULT_KEY`: a private random 32-byte key encoded as 64 hex characters. Keep it unchanged and backed up: it encrypts the recoverable store codes in the Desk panel. Never prefix it with `VITE_`.
   - Store IDs: `waco`, `arlington`, `rockwall`, `southlake`, `college`, `hulen`, `allen`, `plano`, `temple`, `alliance`, `waxahachie`.
3. Codes are salted and hashed on first sign-in. Subsequent environment changes do not replace stored hashes: use the authenticated Desk code controls or an administrative database migration for later rotations. Changing a stored code invalidates that role's existing sessions. Sessions expire after eight hours.
   The Desk's **Store access codes** panel loads all 11 stores on demand, with separate captain and crew codes hidden until **Show codes** is pressed. Codes travel only through the commissioner-only endpoint and never enter shared state or local storage. Copies at rest use authenticated encryption, while sign-in still verifies salted hashes. Switching away from the tab clears the list. Existing hash-only codes can be recovered from matching initial server configuration; otherwise set a new code in the panel. The admin code itself is never stored in recoverable form.
4. Do not set `PIT_ALLOW_PREVIEW_DB` in production. Without Neon, production league actions fail closed. The explicit value `1` is only for a disposable local production-preview check; its embedded database resets on restart.
5. The Desk must record each store's **actual Sunday NSNU dollars** before running Monday. Clicking a color does not certify a projected amount. Official NSNU is separate from color-based robot grades and coin payments. Historical projections are deliberately not promoted to official totals.

## Availability and rewards

Captains plan vacation before Tuesday midnight Central. Availability and roster changes freeze when Pit Week starts, or at the first training submission in accelerated practice. The Desk can record a legitimate absence afterward; the paper tape records who changed eligibility and when. An all-Off store never qualifies for Full Tune-Up. Jobs submitted before Saturday lock may be approved until the card runs; new submissions and Sparks stop at lock. Duplicate job/Spark/crate/purchase requests cannot multiply rewards.

## Local QA

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `scripts/pit-api-check.mjs` exercises actual server endpoints using independent cookie sessions. Run against a disposable loopback dev server with temporary access-code variables and `PIT_QA_ALLOW_MUTATIONS=1`. It resets the local season. Set `PIT_QA_SETUP_FIGHTS=1` to leave a posted first-week card for visual QA.
- Browser QA should cover desktop, 390px phone width, crew-to-captain switching, Watch Party, a complete decision and a complete KO with replay. Repeat on a staging Neon deployment before launch to verify secure cookies, the production migration, serverless concurrency, and physical phone performance.

## Practical limits

Shared crew codes authenticate the store role; they do not uniquely authenticate individual specialists. Anyone holding a store's crew code can choose a specialist on that store's roster. Keep captain and commissioner codes private. Opponent drafts, inventories and coins are masked before the card posts, and scouting/proposal notes are limited to the verified store. Posted builds remain public as before. No production database or deployment is changed by this PR.
