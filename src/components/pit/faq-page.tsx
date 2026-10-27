import { Link } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BOLTS, STREAK_BADGE, TUNE_UP_BONUS } from "@/lib/pit/training";
import { usePit } from "@/lib/pit/store";
import { SectionLabel } from "./bits";

type Faq = { q: string; a: React.ReactNode; text: string };
type Group = { title: string; items: Faq[] };

/** Plain text and rich answer side by side, so search can read the words. */
function faq(q: string, text: string, a?: React.ReactNode): Faq {
  return { q, text, a: a ?? text };
}

/** Exported so the rules Q&A can answer from the same plain text. */
export const GROUPS: Group[] = [
  {
    title: "Getting started",
    items: [
      faq(
        "What is the Waterman Battle Bot League?",
        "Fourteen Good Feet stores play a four-week regular season in Metro and Frontier conferences. Every store fights all four Mondays. After Week 4, the #1 store in each conference advances to Championship Saturday on November 28. That title fight continues until knockout.",
      ),
      faq(
        "How do I sign in?",
        "Tap Clipboard at the top of any page. Pick your store, type your four-digit bay code, then choose I'm pit crew and tap your name, or I'm the captain. Your captain or the desk can give you the code.",
      ),
      faq(
        "I forgot our bay code. What now?",
        "Ask your captain or the desk. The desk can see and change every store's code on the Desk page.",
      ),
      faq(
        "My name isn't on the list.",
        "Your captain can add you. They open your store's garage, find Pit crew, and add your name. It shows up on everyone's Clipboard within a few seconds.",
      ),
      faq(
        "Does it work on my phone?",
        "Yes. Everything works on a phone, a tablet, or a computer. Once the league database is connected, every device sees the same season. The dot next to the sound button turns green and says Live when you're connected.",
      ),
      faq(
        "Who does what?",
        "Pit crew (specialists) do Pit Week jobs and Sparks, make Monday picks, and can suggest parts. The captain locks the bot, spends coins and Bolts, approves jobs, and names the weekly MVP. The desk enters the official numbers on Sunday and runs Monday's card.",
      ),
    ],
  },
  {
    title: "Pit Week: jobs, Sparks, and Bolts",
    items: [
      faq(
        "What do I do during the week?",
        "Open Pit Week. Tuesday through Saturday each day has one culture job, one skill job, and a three-question Daily Spark. Tap a job, do it on the floor, write one line of proof, and check it off. Your captain approves it.",
      ),
      faq(
        "When does each day open?",
        "At midnight Central on that day. Everything for the week closes at Saturday lock (store close). Jobs must be submitted before Saturday lock. Captains may approve already-submitted jobs after lock and before the Monday card runs. No new job or Spark can be submitted after lock.",
      ),
      faq(
        "What are Bolts?",
        `Points for doing the work. An approved job is ${BOLTS.job} Bolts, each right Spark answer is ${BOLTS.sparkCorrect}, each right Monday pick is ${BOLTS.pickCorrect}, and the Wednesday Mystery Crate is ${BOLTS.crate}. The captain spends them in the Bolt Locker on looks: walk-out pyro, smoke, sparks, victory confetti, fireworks, and special paints. Bolts never buy wins.`,
      ),
      faq(
        "What is the Full Tune-Up?",
        `If every specialist finishes all ten jobs and all five Sparks, and the captain finishes the CARE job, by Saturday close, the bot gets +${TUNE_UP_BONUS} Power, Speed, Armor, and Heat for Monday. It is all or nothing for the store, so help each other finish.`,
      ),
      faq(
        "Someone is on vacation. Do we lose the Tune-Up?",
        "No. Off is for specialists unavailable for the week. Set it before Tuesday at 12:00 AM Central, when eligibility freezes. After that, ask the Desk to record a legitimate absence; unfinished training is not an absence.",
      ),
      faq(
        "What is the Mystery Crate?",
        `A surprise bonus job that shows up every Wednesday, like getting a Google review or asking for a referral. It is worth ${BOLTS.crate} Bolts. It is extra, so skipping it never costs your store the Tune-Up.`,
      ),
      faq(
        "How do I get the flame next to my name?",
        `Get ${STREAK_BADGE} perfect Daily Sparks in a row (every question right). A skipped day doesn't break the streak; a wrong answer does. The flame stays on your name for the season.`,
      ),
      faq(
        "My job got sent back.",
        "Your captain wants better proof. Open the job again, write what you actually did, and check it off again.",
      ),
      faq(
        "How do Monday picks work?",
        `On the Pit Week page, pick who wins each Monday fight before Saturday lock. Every right pick is ${BOLTS.pickCorrect} Bolts for your store.`,
      ),
    ],
  },
  {
    title: "Numbers, coins, and the garage",
    items: [
      faq(
        "Which numbers count?",
        "Six: NSNU builds the chassis, Conv % the armor, Demo Rate the drive, Demo Close % the weapon, Arch Supports the utility, and Demo Ticket Avg the brain. Each one is graded green, blue, orange, or red. The exact cutoffs are on the Rules page.",
      ),
      faq(
        "How do coins work?",
        "Each week green pays 3 coins into that part's jar, blue pays 2, orange 1, red 0. A jar only buys its own part. Week 1 coins come from your Period 11 colors, so everyone has something to spend on day one.",
      ),
      faq(
        "What do parts cost?",
        "The ladder is Sport 3, Pro 5, Super 8, paid from that part's own jar. A few chassis cost more because the battery is the part: Sprinter and Hornet 5, Hybrid and Dynamo 6, Scorpion and Crab 7, Capacitor and Mule 8, Monolith 10, Reactor 12. Season-earned parts and coins carry forward if your store reaches Championship Week.",
      ),
      faq(
        "Can we sell a part we bought?",
        "Yes. While the shop is open, the captain can sell any part the store bought for 2 coins, whatever it cost. The coins go back into that part's jar, so you can stack them toward a better part. If the part was on the bot, that slot drops to stock. Stock and championship parts can't be sold, and a sold part costs full price to buy again.",
      ),
      faq(
        "Do the arena hazards do anything?",
        "Yes, every week. Saw-type hazards bite a bot that charges in (up to 8 damage), pit-type hazards cost 7 and slow it, and water-type hazards slow it. Each arena gives them its own name, like the oil slick at the Ring or the crusher in the Junkyard. Swerve drives dodge saws, Hover and Air Cushion pass over pits, Air Cushion skates through water, and careful brains like Logic and Sniper stay clear. Watch for the orange callouts during a fight.",
      ),
      faq(
        "When is the shop open?",
        "From the moment the desk pays Week 1 coins until Saturday lock. It shuts while the bots are locked and fighting, and reopens after the Monday damage report.",
      ),
      faq(
        "Who enters our numbers?",
        "The desk, on Sunday, from the official report. Until then the garage shows a house projection so you can plan.",
      ),
      faq(
        "Does paint or a decal change the fight?",
        "No. Body shells, paint, finish, four sticker slots, trim, visor, light strips, smoke, banner, flag, toppers, walkouts, victory effects and bay numbers are just for looks. Crew can draft unlocked looks and vote in the Garage. Each person gets one vote per proposal; the captain chooses which proposal to apply. Weekly themes highlight categories without waiving unlocks or Bolt prices. Battle history stays until repaired.",
      ),
      faq(
        "What does a Scry do?",
        "Put a Scry in the utility slot to scout an opponent. Call the weapon you think they're running and it tells you if you were right. In the cage, a Scry also hits a little cleaner when your week is behind theirs. Other utilities fight: Spotlight and UV Lamp cut through bait, Decoy and Ghost Veil pull aim off you, Oil Slick dumps traction, Med Bay and the pit weld put health back, Leech steals heat, Tremor stumbles a bot that is not hovering, Blackout and Smoke Screen and Siren scramble a brain that is not lit, Grapple holds once, Mirror kicks damage back. Fog Machine and Blacklight Mode are lights in the rafters. They do not change the fight.",
      ),
      faq(
        "Can we change our bot's class?",
        "Not in Week 1. After the first fight a class change costs 3 chassis coins.",
      ),
    ],
  },
  {
    title: "Monday fights",
    items: [
      faq(
        "When do the bots lock?",
        "Week 1 locks automatically Saturday, Oct 31, at 6:00 PM Central. The Desk can lock earlier. Weeks 2 through 4 lock when the Desk presses lock at Saturday close (6 pm Central). Championship Week locks automatically Friday, Nov 27, at 6:00 PM Central, ahead of the Saturday, Nov 28 championship. The Desk can lock the two title builds earlier. Captains cannot change builds after either automatic deadline.",
      ),
      faq(
        "How does a fight work?",
        "There's a countdown, then three rounds. Both bots swing every round. The card shows the heavier blow. The floor has a pit, a water lane, and two saws every week. Grudge Night adds flame jets. If neither bot is knocked out, the one with more health wins the decision. Nothing in the cage is a coin flip: the same two builds always produce the same fight.",
      ),
      faq(
        "What decides who wins?",
        "Your six numbers set how strong the bot is that week. The whole build decides the fight: chassis and its battery, armor, drive, weapon, utility, and the brain. Better iron hits harder and soaks more. A smarter brain aims, guards, and treats the hazards differently. The wrong weapon on the wrong class is a real penalty. Counters matter: gel eats a flail, chainmail eats a saw, a wedge does not flip an Anchor, flame ignores gel, an Anchor plants an air cushion, chip flame never lights reactive armor, Lodestone turns a Tesla coil around, and Skeleton slips a hit. The Full Tune-Up adds a little on top. A great week with a bad build can still lose.",
      ),
      faq(
        "Do brains change Power, Speed, Armor, or Heat?",
        "No. Logic, Hunter, Berserker, Turtle, Sniper, Brawler, Jammer, Phoenix, and Skynet change how the bot drives. A higher tier of the same brain fights cleaner. They do not add to the four printed numbers. Berserker is the cheap aggressive one. Turtle is slow and hard to break. Sniper wants range and stays off the hazards. Brawler punishes anyone who comes in. Jammer scrambles the other brain. Phoenix gets up once. Skynet reads the floor like Logic and hits like Hunter. Phoenix wants three green Demo Ticket weeks. Skynet wants four straight green Demo Ticket weeks.",
      ),
      faq(
        "What is battery?",
        "Battery is the chassis stamina. It drains every exchange. When it is low the bot slows and the weapon weakens. Armor does not sag with it. Reactor holds the most. Sprinter and Hornet spend it faster. A Tesla Coil also drains the other bot's battery.",
      ),
      faq(
        "Which parts need green weeks?",
        "Sport armor is coins only. Pro armor wants one green Conv % week, and the Super of each new armor family wants two to four. Wrecking Ball wants two green Demo Close weeks, Impaler and Inferno three, Storm four. The battery chassis want green NSNU weeks: one for Sprinter and Hornet, two for Hybrid, Dynamo, Scorpion and Crab, three for Capacitor, Mule and Monolith. Reactor wants four straight green NSNU weeks and 12 chassis coins, which is exactly four green payouts. Three greens pay 9, so Monolith's price of 10 still needs one extra coin in the jar. Skeleton and Ghost Veil are 8 coins and on the peg all season.",
      ),
      faq(
        "Are there byes?",
        "No. Fourteen stores means seven fights every regular-season Monday, so every store fights all four weeks.",
      ),
      faq(
        "Where can we watch?",
        "Fight Day plays the whole card. For a huddle, tap Watch party and put it on the big screen: every fight plays back to back with a live standings table.",
      ),
      faq(
        "What happens to damage?",
        "After the fights the desk posts the damage report. Scratched parts cost 1 coin to fix, bent 2, dead 4, all from that part's jar. An emergency weld turns a dead part into a bent one for a week for 1 coin. Unrepaired damage stays visible on the bot. Last place gets a 3-coin repair voucher.",
      ),
    ],
  },
  {
    title: "Championship Week",
    items: [
      faq(
        "Who can work on a bot in Week 5?",
        "Only the Metro Champion and Frontier Champion. They keep the parts, coins, upgrades, damage and bot identity they earned through the season. There are no free repairs or donated upgrades. Their own Tuesday-through-Friday Championship Prep and season-earned resources are the only ways to get ready.",
      ),
      faq(
        "What is Rally?",
        "Anyone signed in from a non-finalist store can Rally behind either conference champion. Rally adds crowd support, banners and championship presentation only. It can never change Power, Speed, Armor, Heat, HP, damage, repairs, coins, parts or fight odds.",
      ),
      faq(
        "How does the Championship fight end?",
        "There are no judges and no decision. Rounds 1 through 3 use normal fight damage, then overtime gets more dangerous. The fight continues until one bot is knocked out.",
      ),
    ],
  },
  {
    title: "Standings and the trophy",
    items: [
      faq(
        "How are the standings ranked?",
        "Conference berths use record first, then head-to-head when applicable, conference record, cumulative Period 12 NSNU, total green grades, and Bolts earned through Week 4. If the championship berth is still tied, the tied stores settle it in the cage.",
      ),
      faq(
        "What if stores tie for first?",
        "Only an unresolved tie for a conference championship berth goes to the cage. Two tied stores fight; three or more use a free-for-all. The winner becomes that conference's finalist.",
      ),
      faq(
        "What do people win?",
        "The trophy goes to the store. There's a runner-up plate, a Best Build honor, and a weekly pit-crew MVP named by the captain or the desk. Every store gets a printable season recap on the Honors page.",
      ),
    ],
  },
];

export function FaqPage() {
  const [query, setQuery] = useState("");
  const live = usePit((s) => s.session.role);
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, items: g.items.filter((f) => !q || f.q.toLowerCase().includes(q) || f.text.toLowerCase().includes(q)) })).filter(
        (g) => g.items.length,
      ),
    [q],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="faq">
      <div>
        <SectionLabel>Help</SectionLabel>
        <h1 className="font-display text-5xl leading-none">Questions</h1>
        <p className="mt-3 text-muted">
          Quick answers about Pit Week, coins, and Monday fights. The full rules are on the{" "}
          <Link to="/rules" className="text-amber">
            Rules page
          </Link>
          .
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-2 border border-line bg-deep px-3 focus-within:border-amber">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: bolts, bay code, tune-up…"
          aria-label="Search questions"
          className="min-h-11 w-full bg-transparent outline-none"
        />
      </label>
      {groups.length === 0 ? <p className="text-muted">Nothing matches that. Try another word, or ask your captain.</p> : null}
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="font-display text-2xl leading-none">{g.title}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {g.items.map((f) => (
              <details key={f.q} className="group border border-line bg-surface open:border-amber/60" open={Boolean(q)}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-display text-lg leading-tight">
                  {f.q}
                  <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-3 pb-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-muted">
        Still stuck? {live === "public" ? "Sign in on the Clipboard, or ask" : "Ask"} your captain, or tap How to play at the top for the walkthrough.
      </p>
    </div>
  );
}
