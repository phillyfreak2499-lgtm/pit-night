# Championship entrance and finale presentation

Reconstructed on the current source base after the previous local workspace was lost. This is a new implementation checkpoint, not recovery of the former commit.

## Finalist entrances

Only the two-bot Week 5 title fight receives the hero stages. Each finalist gets 12 seconds at normal presentation speed, even when the fight-speed control is set to 2× or 4×. Every later combat beat remains intact. Their actual equipped bot and public names are shown against store-colored/gold spotlights, a lit platform, smoke, spark curtains and four pyro jets. These temporary effects do not equip or award cosmetics.

The health overlay and overhead camera yield the stage during the entrances. Regular-season and conference berth bouts retain their existing presentation. Pausing freezes particles. Hidden/offscreen playback resets the real-time anchor instead of skipping the entrances on return.

## Pit finish

Sparks and tumbling armor debris follow the actual recorded loser falling into the pit. The slow-motion replay says “IN THE PIT”; ordinary knockout replays still say “K.O.” The recorded winner receives a gold spotlight and champion nameplate with confetti and fireworks at the decision. These effects cannot add damage, change a winner, or grant rewards.

Reduced motion uses static finalist stages, a static champion reveal, and a stationary replay label. It suppresses the added particles and moving spotlights.

## Validation

Six focused tests cover title-only timing, retained combat beats, public identities and result immutability, pause/resize particle preservation, visible armor debris, correct finish-phase gating, camera alignment and replay wording. The combined release checkpoint must rerun its complete tests, typecheck and builds.

Direct desktop/mobile canvas rendering checks presentation only. Interactive browser QA remains unverified because the available browser routes were blocked by the environment; it is not replaced by tests or native rendering.
