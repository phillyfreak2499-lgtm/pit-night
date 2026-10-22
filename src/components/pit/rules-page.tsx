import { Link } from "@tanstack/react-router";
import { SectionLabel } from "./bits";
import { KeyLadder, UpgradeHowTo } from "./key-ladder";
import { RulebookQa } from "./claude-copy";

/** The rulebook as plain text. The Rules page renders it; the rules Q&A answers only from it. */
export const RULES: { title: string; text: string }[] = [
  {
    title: "The clock",
    text: "Monday through Saturday the store runs the floor. That whole week is the card. Saturday at close is one lock: chassis, drive, weapon, armor, utility, brain. The captain locks before the final numbers are in, so the lock is a bet on the week. Sunday the official numbers come out and the Desk clicks in each store's six colors. Monday morning the Desk runs seven fights live: every store fights and there are no byes. Monday afternoon is the damage report, the coins pay out, and the shop opens for the next week. Week 1 is different only because Period 11 colors pay the opening coins and set seeds inside Metro and Frontier.",
  },
  {
    title: "Crew owns the look; captain has the final call",
    text: "In the Garage, specialists propose only cosmetics their store has unlocked. Each person may keep one current proposal and vote once on each open proposal. Votes never equip a look: the captain accepts it. Left armor, right armor, top/hood and rear panel each have their own sticker. Weekly themes are Identity, Attitude, Showmanship, Battle Ready and Championship; all achievement requirements and Bolt prices still apply. Cosmetic changes never repair wear or change combat stats. Rehearse walkouts and victory effects before buying.",
  },
  {
    title: "What scores",
    text: "Six numbers, graded green, blue, orange, or red. NSNU: green $1,000+, blue $900–$999, orange $800–$899. Conv %: green 64%+, blue 56–63%, orange 47–55%. Demo Rate: green 88%+, blue 80–87%, orange 72–79%. Demo Close %: green 73%+, blue 70–72%, orange 65–69%. Arch Supports: green 3.8+, blue 3.0–3.7, orange 2.5–2.9. Demo Ticket Avg: green $1,800+, blue $1,600–$1,799, orange $1,400–$1,599. Anything under orange is red. The better the week, the higher the bot's rating going into the fight.",
  },
  {
    title: "Grades and coins",
    text: "Each number pays coins into one part's jar every Monday: green 3, blue 2, orange 1, red 0. NSNU fills the chassis jar. Conv % fills armor. Demo Rate fills drive. Demo Close % fills weapon. Arch Supports fill utility. Demo Ticket Avg fills the brain, which is how smart the bot fights. A jar only buys its own part, and repairs on that part come out of the same jar. Last place gets a 3-coin repair voucher that fixes any part.",
  },
  {
    title: "The triangle",
    text: "It works like rock, paper, scissors. Strikers (fed by Demo Rate and Demo Close) hit hard and fast but fade in a long fight, so they beat Tanks early. Tanks (fed by Demo Ticket and Conv %) soak hits and win late, so they beat Specialist bots. Specialist bots (fed by Arch Supports and NSNU; this is the bot class, not the job title) grab and burn, so they shut Strikers down. The right matchup can flip a fight you should lose. A great week with a bad build can still lose, and a Super part on bent wheels is not a Super.",
  },
  {
    title: "Iron",
    text: "Every bot starts stock. On the first verified store sign-in, the team chooses its Week 1 fighting style and starter body shell; that choice is frozen through the first fight. Before Week 1 the Desk pays opening coins from Period 11 colors, and the shop opens. It shuts at Saturday lock and reopens after each damage report. Sport costs 3 coins from that part's jar, Pro 5, Super 8. One green week buys a Sport. A green and a blue buys a Pro. Green, green, blue buys a Super. Changing class after Week 1 costs 3 chassis coins. A disabled chassis fights stock of the same class. You do not get a free swap off a wreck.",
  },
  {
    title: "The card",
    text: "Fourteen stores. Period 11 colors seed Metro and Frontier separately. Every store gets four regular-season fights and no repeated opponent. Each store gets conference games plus at least one crossover. After Week 4, each conference sends one store to Championship Saturday. The berth tiebreak order is: record, head-to-head when applicable, conference record, cumulative Period 12 NSNU, total green grades, then Bolts earned through Week 4. If the berth is still tied, the tied stores settle it in the cage. Best Build can still come from any bay.",
  },
  {
    title: "Pit Week",
    text: "Tuesday through Saturday every specialist gets two jobs a day, one culture and one skill, plus a three-question Daily Spark. Write one line of proof and the captain gives the thumbs-up. Bolts: 2 for each approved job, 1 for each right Spark answer, 2 for each right Monday pick, and 5 for Wednesday's Mystery Crate, a surprise bonus job that is not part of the Tune-Up. Five perfect Sparks in a row puts a flame badge on your name. Bolts buy looks in the Bolt Locker, never wins. The Full Tune-Up is the one thing Pit Week completion adds to combat: if every eligible specialist finishes all ten jobs and all five Sparks, and the captain finishes CARE, the bot gets +4 Power, Speed, Armor, and Heat on Monday. Championship Week is finalist-only: eight jobs, four Sparks and captain CARE Tuesday through Friday can earn the same +4 for Saturday.",
  },
  {
    title: "Championship Saturday",
    text: "After the fourth Monday, only the Metro Champion and Frontier Champion can work on championship bots. Their Week 4 sales card carries forward; there is no fifth Sunday scorecard. Non-finalist stores may Rally behind either finalist, but Rally is presentation-only and can never change fight math, repairs, parts or resources. The championship has no judges and no decision. After three normal rounds, damage escalates in overtime until one bot is knocked out.",
  },
  {
    title: "The bay",
    text: "Paint, finish, decals, trim, eye color, the flag, garage floor, stripes, and the bay number are decoration. They do not change Power, Speed, Armor, or Heat. A Scry on the utility slot is the spy, and it stays shut until the bay calls the weapon family out loud. Then it says whether that call was right, and whether the weapon belongs on their class. It does not name the part. One call per fight. They can still change the draft until Saturday close. Captains can test the build against three house drills. That tape does not post damage, scrap, or a record. Captains rename the crew, add up to eight specialists, and keep at least one. Staff edits are not the lock.",
  },
  {
    title: "Damage",
    text: "Clean, scratched, bent, disabled. Bent is half effect. Disabled falls back to a stock loaner until you pay (a dead utility just goes empty). Winners still scratch. Blowouts can kill weapon and drive. Repairs come out of that part's jar: scratched 1 coin, bent 2, disabled 4. An emergency weld turns Disabled into Bent for one week for 1 coin. Salvage strips a rare part for a few coins back and drops the slot to stock.",
  },
];

export function RulesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <SectionLabel>How it works</SectionLabel>
        <h1 className="font-display text-5xl leading-none">The store is the bot</h1>
        <p className="mt-3 text-muted">
          The Waterman Battle Bot League is the Monday morning card for The Waterman Group. Period 12 has fourteen Good Feet stores in two seven-store conferences. Every store fights November 2, 9, 16, and 23. The Metro Champion and Frontier Champion then meet Saturday, November 28. The trophy hangs in a building. Pit crew get a name on the titantron. They do not take hardware home.
        </p>
        <p className="mt-2 text-sm">
          New here? Start with the{" "}
          <Link to="/faq" className="text-amber">
            FAQ
          </Link>
          .
        </p>
      </div>
      <RulebookQa />
      {RULES.slice(0, 4).map((rule) => (
        <Rule key={rule.title} title={rule.title}>
          {rule.text}
        </Rule>
      ))}
      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="font-display text-2xl">Upgrades in one look</h2>
        <UpgradeHowTo compact />
        <KeyLadder />
      </section>
      {RULES.slice(4).map((rule) => (
        <Rule key={rule.title} title={rule.title}>
          {rule.text}
        </Rule>
      ))}
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
