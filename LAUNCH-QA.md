# PR #4 launch-gap handoff — October 22, 2026

Branch: `feat/14-store-championship-week`. Continue the existing draft PR; no merge or production deployment is authorized or performed. The fetched `main` commit `310290bf5059c22a14833a285a3a91c604b69a7d` is already an ancestor of this branch, so no rebase or merge is needed.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Week 5 Tune-Up | DONE | Completion uses the plan's four Spark days. Regression exercises all eight jobs for every eligible finalist specialist plus captain CARE; non-finalist submissions and Tune-Up remain blocked. |
| Crew cosmetic ownership | DONE | Shared proposals, server-derived proposer identity, one current proposal per person, one vote per roster identity per proposal, captain/Desk acceptance. Ownership and Week 1 shell restrictions are rechecked on acceptance. Public and other-store projections omit proposals. |
| Weekly decoration themes | DONE | Identity, Attitude, Showmanship, Battle Ready and Championship appear in Garage and Pit Week. Featured categories show earned items and achievement progress. No requirements or Bolt prices are waived. |
| Sticker slots | DONE | Left armor, right armor, top/hood and rear panel persist independently. Legacy decals map to hood; explicit empty slots remain empty. Side and overhead render distinct regions. Captain commands merge one slot against authoritative state, preventing rapid-click overwrite. |
| Damage personality | DONE | Garage shows clean / battle-worn / heavily damaged and scratched/bent/disabled counts. The same portrait renderer draws unrepaired wear. Proposals, paint and stickers preserve wear, part damage and combat builds. |
| Walkout / victory previews | DONE | All five existing effects can be rehearsed before purchase/equipping using broadcast particle primitives. Existing costs and ownership checks remain; rehearsal spends nothing. Reduced motion uses effect descriptions. |
| Tyler / Shreveport rosters | DONE | Tyler: Jeffrey Richard’s; Kasi McMillin, Yolanda Tellez, Samantha Rodriguez. Shreveport: Amy Schexnider; Daniel Rios. |
| Abilene roster | DONE | Owner confirmed Taylor VanSickle (Store Manager / captain), Nathan Burney and Philip Rodriguez (Sales consultants / specialists). Fresh and existing placeholder rosters update; surviving identity IDs and season data are preserved. No owner-data blocker remains. |
| Code rotation security | DONE | Real local endpoint tests verify Desk-only and same-origin guards, 14 rows, 28 distinct new codes and session revocation. Tested exclusively against a disposable loopback database, then restored test credentials. No production codes were rotated. |
| Automated validation | DONE locally | Dependency install, typecheck, full tests and development build pass. New files also pass scoped ESLint. Hosted workflow status is recorded on PR #4 and must be green before readiness. |
| Browser QA | PARTIAL — hosted access | Local desktop (1280×800) and phone (390×844) checks pass across all ten requested pages, with screenshots reviewed, HTTP 200, no horizontal overflow, console errors or page errors. Hosted Vercel QA remains blocked as described below. |
| Release | PENDING owner approval | Keep PR draft. Follow `LAUNCH.md` after the approved merge/deployment, including one bulk rotation and distribution of the generated list. |

## Validation performed

- `npm install --no-audit --no-fund`.
- `npm run typecheck`.
- `npm test`: all tests pass; four existing environment/external-skill skips remain. This includes league scheduling, championship-until-KO, regular-season Tune-Up, finalist-only prep, migration, unlocked cosmetics, proposal ownership, cross-store authorization, replacement vote reset, duplicate voting, rapid independent sticker edits, persistent wear and unchanged seeded fight exchanges.
- `npm run build:dev` compiles client and server output. Compiled local output also renders on desktop and phone with no browser errors or overflow. The existing holding-page gate was opened only in that disposable local preview with `SITE_OPEN=1`; source and production settings remain unchanged.
- `scripts/pit-api-check.mjs` exercises independent HTTP-only cookie sessions, same-origin enforcement, strict command schemas, server Spark grading, CAS retries, shared proposals/votes/acceptance, simultaneous sticker edits, duplicate reward claims, secret-free reads, Desk-only bulk rotation and credential revocation. Its guard requires explicit mutation opt-in and a loopback URL.
- Browser coverage: Watch Party, Titantron, Garage/Bot Locker, Pit Week, FAQ, Rules, Recap, Honors, Pit Map and authenticated Desk. Tutorial and first-body selection were inspected; a specialist proposal, idempotent vote and captain acceptance were exercised through the UI. All five effect preview buttons were exercised without purchasing/equipping.
- The repository's existing smoke script was run with temporary local Windows adapters for installed Edge, output roots and disposable authenticated sessions. Those adapters and test credentials are not part of the PR. The in-app browser was used for interactive checks; its viewport override was unreliable, so actual 390px rendering was verified by the smoke script instead.
- Runtime copy was checked for “Eleven stores,” “five fights and a bye,” “Title Monday” and the obsolete November 21 season end. Only the intentional legacy-tagline migration matcher remains in runtime source. November 21 remains a valid Week 4 lock date; the season ends November 28.
- Independent review found a rapid sticker-edit overwrite issue; it was fixed with slot-specific authoritative commands and regression/API tests, then re-reviewed without remaining important findings.

## Exact hosted QA gap

The existing preview is `https://waterman-battle-bot-league-git-feat-14-store-champ-8bbbf0-teas8.vercel.app`. Anonymous browser access redirects to Vercel login. The supported Vercel deployment lookup and temporary access-link tool both return **403** for team `teas8` (`team_K0XuIslKCrEFD1nX44MvisuQ`). The connected Vercel identity lacks authorization to that team/project. No passwords were requested, protection was not disabled, and no long-lived bypass secret was created.

Authorize the Vercel connection for that team/project, then repeat hosted desktop/phone checks on the PR's final preview. Local QA does not establish hosted Neon behavior, production cookie behavior or physical-phone performance. Those remain release checks, not claimed results.

## Required post-deployment step

After explicit owner approval to merge and deploy: **Desk → Rotate all 14 store codes once**, then distribute the generated crew/captain list to the appropriate store owners. Keep the Desk PIN private. Do not perform this against production from a preview/test branch.

Shared crew codes authenticate store membership, and roster selection identifies the voter. They do not independently verify a human identity; a holder of a store's crew code can select another name within that store. Cross-store voting and client-forged proposer/voter IDs remain blocked by server sessions.
