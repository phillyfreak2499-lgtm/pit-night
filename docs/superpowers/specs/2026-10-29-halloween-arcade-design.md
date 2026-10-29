# Halloween daily captain games

The user requested a different Halloween mini-game on each remaining day through Saturday, appearing only for a captain once per day, with a team invitation, random difficulty, category-coin rewards and 10-Bolt retries after losing.

## Scope and builder choices

- Event dates are October 29–31, 2026 in America/Chicago. Thursday: three witch hats shuffle around a hidden coin. Friday: remember which pumpkins lit up. Saturday: repeat a potion sequence. After midnight ending Saturday, gameplay and invitations stop automatically.
- Each store gets one free attempt per day and at most one winning reward. A loss permits another attempt for exactly 10 earned Bolts; every further loss has the same retry price. A win pays 2–4 coins into one randomly selected existing bot upgrade category.
- Difficulty is selected by the server once per store/day and remains stable through reloads and paid retries. A retry uses a fresh challenge. Easy/medium/hard alter sequence length, shuffle count or reveal speed, with each puzzle remaining solvable.
- On the first verified captain session activation that day, claim an invitation atomically. One device receives the automatic invitation; later logins do not repeat it. A captain-only entry lets the team resume after dismissing it without spending the free attempt. Other roles do not receive or play games.
- Show “Get the rest of your team so they can help!” before starting, including before a paid retry. Buttons explicitly state the free attempt or 10-Bolt price. No automatic spending.

## Approach

Use a dedicated server function and a pure game reducer with the existing whole-season revision/CAS transaction. Save game records, coin credits and Bolt spending atomically. Existing generic client commands cannot supply a win, category, reward, date or difficulty. This reuses the current account and wallet model without adding a second economy or a database migration.

A client-only game would allow duplicate claims and tampered outcomes. Separate tables would add migration and cross-document transaction complexity to this short event. The chosen implementation keeps the event in the existing season document, with private records removed from every client projection and a safe per-captain view returned by the dedicated endpoint.

## Behavior and boundaries

- Start requests carry the expected previous attempt ID; duplicate starts return the current attempt without another charge. Answers carry the current attempt ID and chosen positions/sequence. Repeated answers never pay twice; stale attempts cannot settle a newer attempt.
- Server time controls dates and minimum observation time. Server cryptographic randomness supplies difficulty, puzzle, reward and opaque attempt IDs. Reloading resumes the same puzzle rather than drawing another free one.
- A failed network response offers a retry of the same operation. Insufficient Bolts, invalid choices, wrong roles and expired dates return understandable errors without partial mutations.
- Use the existing accessible modal, keyboard buttons and mobile layout. Delay the invitation behind sign-in, tutorial and starter-body dialogs. Suspend gameplay while closed; resume the authoritative current attempt when reopened.
- Existing battle statistics, cosmetics, unlock rules and daily work remain unchanged. Won category coins use the existing purchasing and battle-upgrade system.

The user supplied the feature and release scope; reward quantity, game choices, daily difficulty persistence and manual resume are implementation defaults stated in the conversation.
