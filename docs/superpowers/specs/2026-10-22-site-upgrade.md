# Pit Night upgrade design

## Outcome

Implement every recommendation from the site review, add the requested fundamentals entry challenge before any league content or login, and make the existing bots look more like physical combat robots. Continue on `feat/14-store-championship-week` and draft PR #4. Production merge/deployment still require explicit approval.

## Entry experience

A visitor first sees a compact branded entrance screen. It randomly asks “What is key fundamental #1?” through “What is key fundamental #5?” It does not print the answer or the list. The answer must match the chosen number:

1. Seat everyone instantly.
2. Fit everyone.
3. Close 3-step systems.
4. Follow up with each client.
5. Get referrals and reviews.

Ignore capitalization, punctuation and extra/missing spaces. Accept small spelling errors and clear equivalents such as “three” for “3,” “every client” for “each client,” and “get”/“gets.” Require the important meaning: a bare number, “everyone,” “close,” or a different fundamental must fail. Use a bounded deterministic matcher, not an AI service. Limit answer length and attempts. Errors explain that spelling flexibility is allowed without revealing the answer.

The server chooses the challenge, verifies the answer and issues an HttpOnly, SameSite cookie lasting eight hours. The challenge is short-lived and tamper-resistant. Use purpose-separated signing derived from the existing server-only code-vault key, with no browser-exposed secret. Expired or forged cookies require the challenge again. Missing production configuration fails closed with a generic availability message.

Enforce this before normal pages, store login, league server functions and protected site assets; unauthenticated API requests receive an authorization response rather than league data. Only the entry screen, its minimal resources and necessary platform infrastructure are exempt. Direct-link destinations remain internal and are restored after success. Responses containing entry/session information use no-store caching. Preserve the existing pre-launch holding-page switch and platform preview/branding integration. Verify both development and built-output request paths; middleware alone must not be assumed to protect development server functions.

The fundamentals challenge is a shared knowledge entrance gate. Existing crew/captain/Desk credentials continue to enforce privileged access. Passing it grants no role or store permissions.

## Looks and phone usability

- Garage: collapsible cosmetic categories, an owned-items filter, and a compact equipped-look summary. Preserve proposal/voting, four sticker slots, weekly themes and closest-unlock progress.
- Locked items: an enabled details action opens the exact unlock requirement and current progress on touch and keyboard; unavailable items remain unequippable.
- Navigation: retain primary phone destinations and add a More menu for all secondary destinations, with current-page indication and predictable dismissal.
- Overlays: shared accessible dialog behavior for Clipboard, tutorial and bay login, including labels, initial focus, focus containment, Escape, focus restoration and an inert background. Preserve existing role checks and mobile sheet styling.

## Bot realism

Improve the shared side and overhead canvas renderer with layered metal shading, beveled armor edges, seams, fasteners, recessed vents, wheel/tread depth, weapon-mount detail and stronger contact shadows. Paint, rare finishes, stickers, store numbers and persistent damage must remain readable. Use restrained lighting so material differences and silhouettes stand out. Keep each body shell visually distinct.

Apply the improvements consistently to Garage, map and fight presentation. Do not replace real equipped geometry with unrelated pictures. Preserve hidden-loadout tarps, all earned cosmetics, existing costs and fight math. No new 3D engine or generated video is needed for this pass. Cache reusable detail where useful and scale detail to canvas size so small map portraits do not incur full-size rendering cost.

## Performance changes

- Broadcast: stop drawing while paused except on seek, resize or visual-state change; suspend offscreen/hidden-tab work and avoid per-frame React state updates when displayed values are unchanged. Resume without advancing through hidden wall-clock time.
- Portraits: draw idle and reduced-motion views once; animate hover/focus and active effects; cancel offscreen callbacks. Include tarp animation in reduced-motion handling.
- Synchronization: skip unchanged document/session writes, narrow expensive subscriptions, avoid overlapping polls and unnecessary persistence. Continue checking session revocation and refresh the projected document when identity changes, even if the season revision is unchanged.
- Server polling: separate normalization/bootstrap from steady-state pulls; cheaply check revision and verified identity before loading/projecting the full season. Preserve concurrent-write checks and authorization. Never cache one role's document for another role.
- Startup: lazy-load the occasional starter selector and its renderer from the shell. Inspect the production import graph and transfer sizes to confirm the boundary actually helps text pages.

## Verification and handoff

Write behavioral tests for challenge matching, wrong-number answers, typo boundaries, signed-cookie/challenge tampering, expiry, direct URL/API protection, attempt limits and continued role authorization. Add meaningful regressions for poll races, identity changes and renderer scheduling. Run typecheck, the full suite, build:dev and hosted PR checks.

Compare production-build performance traces before/after for paused/playing/offscreen broadcasts, the fourteen-store map and Garage. Report measurements actually obtained, without inventing Web Vitals or physical-phone results.

Inspect desktop and 390px phone views, including the entrance, keyboard dialogs, More navigation, locked-item details, Garage proposals and side/overhead bots. Exercise deep links, wrong/correct entry answers, expiry and crew/captain sign-in. Repeat hosted QA through supported Vercel access when available; retain the exact access gap if still blocked.

Update the existing PR and release checklist. Keep the confirmed Abilene roster. Do not rotate production codes, merge, deploy production or mark the draft ready as part of this work.
