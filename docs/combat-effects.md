# Combat effects and saved battle evidence

The server runs the same combat engine for regular duels, championships, conference
melees, and legacy tag matches. A part can change printed stats, behavior, a
conditional counter, or several of these. A brain's zero printed stat nudge does
not make it cosmetic: targeting, guard, hazards, interference, and revival use
its family and tier directly.

## What affects a fight

| Choice           | Combat inputs and effects                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Class            | Power/speed/armor/heat distribution and class matchup behavior                                               |
| Weekly grades    | Week quality, rating, printed stats, and quality advantage                                                   |
| Chassis          | Weighted stat nudges, fit, battery capacity/drain, affinities, opening attacks, evasion and hazard movement  |
| Drive            | Stat nudges, tier attack scaling, movement lanes, opening burst, counters, battery use and flip finishes     |
| Weapon           | Stat nudges, tier damage scaling, range/timing, armor matchups, burning, stun/drain and control finishes     |
| Armor            | Stat nudges, tier defense, weapon counters, opening protection and reflected damage                          |
| Utility          | Stat nudges, fit, damage/healing/guard modifiers, disruption, vision, heat transfer and conditional counters |
| Brain            | Family/tier targeting, guard, route selection, interference, hazard avoidance, and one-use Phoenix revival   |
| Wear and repairs | Per-part condition, scaled performance, disabled-part loaners, and temporary weld expiry                     |
| Full Tune-Up     | +4 power, speed, armor and heat after the crew completes the required approved work                          |

Only the equipped/locked loadout fights; owning an unused part does not add its
stats. Grade/coin/green-week gates control purchases, and title parts remain earned
items. Scry also reveals scouting information; its battle bonus is conditional on
facing a stronger week. Counters and tradeoffs mean a meaningful choice need not
win every matchup or visibly change every rounded exchange.

Paint, bodies selected as presentation, finishes, decals, masks, weapon skins,
numbers, lighting/show effects, walkouts, victory effects, banners, and other
Bolt Locker presentation rewards do not change combat. The actual chassis/weapon
part is separate from its visual body/skin.

## What is stored

`mutateSeason` validates the command, authorizes the server session, loads the
saved season, and executes the store action on the server. `runSaturday` freezes
the loadouts and computes the card. `sharedDoc` persists the results in
`pit_season.doc` using the existing revision check.

Each `FightResult.fighters` entry contains the fighter's printed stats, rating,
fit, week quality, effective part IDs, families, tiers, wear multipliers, battery
capacity and affinity. Disabled parts record the effective stock loaner ID.

New `Exchange.combat[fighterId]` records both participants independently:

- `before` and `after`: HP, battery, effective heat, pending burn, stun multiplier,
  and whether Phoenix has been used.
- `damageDealt`: direct attack damage, before the target's remaining-HP cap.
- `reflectedDamageTaken`: damage returned by armor/utility counters, separated
  from the opponent's direct weapon damage.
- `hazardDamage`, `burnDamage`, `healing`, and `revived`.

Heat/dump finishers and championship sudden death also carry combat traces.
`FightResult.hp` remains the final health after finishing effects. The featured
exchange's `damage` remains compatible with existing replay presentation; inspect
`combat` for both bots' actual contribution. Traces are backend data, not a new UI
dashboard. Historical results omit optional trace fields and are not recalculated.

Melee/tag combat retains each bot's own kit, health, battery and status memory.
Opening abilities use that bot's first exchange even when it sits out an odd
round. Tag teammates do not attack each other. Surviving health and the existing
build tiebreak decide bounded unresolved fights; elimination order ranks knocked
out melee fighters.

## Audit and regression checks

`npm run test:combat` covers all 231 catalog parts: 41 stock choices and 190
purchasable/title parts, including adjacent tiers on builds at the fit cap.
Comparisons use numerical HP/damage outcomes, not item names, commentary, tags,
or the tier tiebreak. Targeted regressions cover armor repair direction, utility
tier scaling, worn defensive effects, seasonal timing, Flip Kit finishes,
multi-bot equipment, part-specific wear, and persisted battle traces.

The persistence test performs purchase, lock and card-resolution actions and
round-trips the saved document through a disposable Postgres-compatible PGlite
database. It verifies effective part IDs and trace data survive reload and
cosmetics do not alter numerical battle results. The separate API check exercises
the actual local server's authorization, saving and concurrency path.

The audit establishes mechanical effects and regression coverage; it does not
claim every part is equally strong. Newly implemented effects change future
balance, so inspect actual match results before further tuning coefficients.
