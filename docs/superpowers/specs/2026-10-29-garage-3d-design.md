# Garage 3D

The user approved the modular purple bot/arena prototype and selected Garage only as the first integration. Preserve the existing Garage editor, saved appearance, equipment permissions, crew proposal workflow, coins, unlocks and battle logic.

## Approach

Use a lazy Three.js scene in the main Bot Locker, assembled from the current `BotLookProps`. Keep the small bay portrait and other game surfaces in their existing renderer. A single generated monolithic model would not support equipment changes; replacing every site renderer exceeds this release's scope. Modular geometry follows the approved prototype and supports the current catalogue.

## Behavior

- Reflect all 15 shells, equipment families and saved cosmetics, including Team Janelle hearts and four sticker positions.
- Orbit, zoom and reset, optional rotation, with full-accessory camera framing.
- Keep hidden equipment concealed and preview crew drafts without committing them.
- Respect reduced motion and suspend offscreen work; provide classic 2D fallback.
- Load the 3D code only when the Garage viewer enters the viewport; dispose GPU resources on changes/unmount.
- No database, coins, combat calculations, unlock rules or migrations change.

Builder choices: Three.js 0.170.0 matches the reviewed prototype, one WebGL context per Garage, DPR capped at 1.5, 1024px shadow map and generated local textures. No external model download or generation cost.
