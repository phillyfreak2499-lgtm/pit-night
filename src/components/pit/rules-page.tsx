import { SectionLabel } from "./bits";

export function RulesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <SectionLabel>How it works</SectionLabel>
        <h1 className="font-display text-5xl leading-none">The store is the bot</h1>
        <p className="mt-3 text-muted">
          Pit Night is the Saturday card for The Waterman Group. Period 12 runs October 25 through November 21. Ten Good Feet stores. One bot each. Four Saturdays. The trophy hangs in a building. Pit crew get a name on the titantron. They do not take hardware home.
        </p>
      </div>
      <Rule title="The clock">
        Monday through Friday the store runs the floor and the scrap lands in that bay. Friday night is one lock: chassis, drive, weapon, armor, utility. Saturday is five fights, each a short broadcast. No bye this period. Saturday afternoon is the damage report. Sunday the stores are closed. The site stays up. Nothing new gets fought and nothing new gets scrapped.
      </Rule>
      <Rule title="What scores">
        Demo percent is demos divided by opportunities, not a traffic count. Closing percent is sales divided by demos. NSNU is judged against that store's weekly goal, never as raw units. A short week is a prorated goal, set by the commissioner. Reviews are named 5-stars, capped at two per pit-crew member on the clock. Former-customer average ticket is the armor stat. There is no traffic field and no volume field.
      </Rule>
      <Rule title="Grades and scrap">
        Green pays 3 scrap, blue 2, orange 1, red 0. Every green after the first adds one more. The bank caps at 18. Repair bills spend the bank. They are not a second tax, and a last-place stipend is repair-only voucher that does not sit in the cap. Green Demo is a drive key. Green closing is a weapon key. Green NSNU-to-goal is a chassis key. Green ticket is armor. Green reviews unlock utility keys.
      </Rule>
      <Rule title="The triangle">
        Striker — Shrike. Demo and closing. Hits first. Dies if it goes long. Pressures a tank early. Tank — Keystone. Ticket and a stack of greens. Wins late. Smothers a specialist if the claw misses. Specialist — Windlass. Reviews and NSNU-to-goal. Grapple and Heat. Shuts a striker down when Heat is real. A correct counter can flip a modest underdog. The best week with the worst lock can still lose. A Super on bent wheels is not a Super.
      </Rule>
      <Rule title="Iron">
        Week 1 is all stock. The shop opens after Saturday 1. Sport wants one green week. Pro wants two greens and the matching key. Super wants the scrap and two keys. Championship is a Title Saturday drop or salvage off a wrecked Super after a win. Never sold. Open cage has no Super. Changing class after Week 1 costs scrap. A disabled chassis fights stock of the same class. You do not get a free swap off a wreck.
      </Rule>
      <Rule title="The card">
        Ten stores, five bouts, no bye. Week 1 is Shakedown, Saturday October 31, stock versus stock. Week 2 is Class Night, Saturday November 7, still one-on-one, grouped on the titantron. Week 3 is Grudge Night, Saturday November 14: rematches, an optional allied tag, and the last-place stipend. Week 4 is Title Saturday, November 21. Top four play semis and a final for the trophy. The other six run a last-bot melee. A plate to the runner-up. Best Build can come from any of the ten.
      </Rule>
      <Rule title="The bay">
        Paint, garage floor, stripes, and the bay number are decoration. They do not change Power, Speed, Armor, or Heat. A Scry on the utility slot is the spy, and it stays shut until the bay calls the weapon family out loud. Then it says whether that call was right, and whether the weapon belongs on their class. It does not name the part. One call per fight. They can still change the draft until Friday. Captains can test the build against three house drills. That tape does not post damage, scrap, or a record. Captains rename the crew, add up to eight specialists, and keep at least one. Staff edits are not the Friday lock.
      </Rule>
      <Rule title="Damage">
        Clean, scratched, bent, disabled. Bent is half effect. Disabled falls back to a stock loaner until you pay. Winners still scratch. Blowouts can kill weapon and drive. Emergency weld turns Disabled into Bent for one week. Salvage strips a rare part for a little scrap and drops the slot to stock.
      </Rule>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: string }) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </section>
  );
}
