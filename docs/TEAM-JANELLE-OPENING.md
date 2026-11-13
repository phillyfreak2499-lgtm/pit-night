# Team Janelle championship opening

Week 5 broadcasts and watch parties begin with a 30-second celebration before the first fight program. All 14 store bots share a tiered stage with weapons stowed, gentle synchronized dancing, and soft confetti. The stage uses a detached snapshot of public store names and bot appearances. It never changes league data, loadouts, results, or archived fight snapshots.

## Sequence

- 0–7 seconds: “Every bot. Every store. One team.”
- 7–16 seconds: “We're rooting for you.”
- 16–24 seconds: “We're proud of you.”
- 24–30 seconds: “All of us. With you. Team Janelle.”

The first fight program follows automatically. The current championship card places the third-place Royal Rumble before the title fight; the celebration does not schedule or simulate either bout.

## Playback and accessibility

The presentation clock uses real, uncapped elapsed time, independent of fight speed. Pause, hidden tabs, and an offscreen stage suspend it. Resume continues from the same point. Reduced-motion viewers see a static lineup and confetti tableau while the support text advances normally.

Watch-party controls pause/resume or skip ahead. In the standard broadcast, Next skips the opening, Back from the first program revisits it, and the Team Janelle rail item selects it. Play again includes a fresh opening. Changing weeks resets playback; regular weeks and empty cards have no celebration.

## Reconstruction verification

The reconstructed implementation has seven focused tests in `tests/celebration.test.ts`, covering public appearance snapshots and stowed weapons, missing-bot fallback, support messages, low-frame-rate timing and suspended intervals, championship-only program ordering, desktop/mobile canvas drawing with static reduced motion, and playback integration with finalist rally selection. Canvas tests use a recording context; they do not replace browser interaction testing.

Run the focused suite with:

```sh
node --experimental-strip-types --import ./scripts/register-pit-loader.mjs --test tests/celebration.test.ts
```
