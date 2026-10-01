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

const GROUPS: Group[] = [
  {
    title: "Getting started",
    items: [
      faq(
        "What is the Waterman Battle Bot League?",
        "A four-week competition for Period 12 (October 25 to November 21). Each of the eleven Good Feet stores has one robot. The store's weekly sales numbers build it, and every Monday morning the robots fight. The best record after four Mondays takes the trophy home to the store.",
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
        "At midnight Central on that day. Everything for the week closes at Saturday lock (store close). Jobs you sent before the lock can still be approved afterward.",
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
        "No. The captain can mark them Off this week on the Pit Week page. They won't count toward the Tune-Up that week.",
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
        "Sport 3 coins, Pro 5, Super 8, paid from that part's own jar. A store that stays green on one number all month can bring a Super part to Title Monday.",
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
        "No. Paint, finish, decals, trim, eye color, the flag, and the bay number are just for looks.",
      ),
      faq(
        "What does a Scry do?",
        "Put a Scry in the utility slot to scout an opponent. Call the weapon you think they're running and it tells you if you were right. Other utility parts help you fight instead.",
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
        "Saturday at close (6 pm Central). Whatever is on the bot at the lock is what fights Monday.",
      ),
      faq(
        "How does a fight work?",
        "There's a countdown, then three rounds. Each round the bots circle and trade blows, then one lands the big hit. Damage, combos, and knockouts show on screen. If neither bot is knocked out, the one with more health wins the decision.",
      ),
      faq(
        "What decides who wins?",
        "Your six numbers set how strong the bot is that week. Your build decides how well it fights: the parts you bought, whether they're repaired, and whether your weapon matches up well. The Full Tune-Up adds a little on top. A great week with a bad build can still lose.",
      ),
      faq(
        "What's a bye?",
        "Eleven stores means one store sits out each week. A bye counts as a win and the bot takes no damage. Week 1's bye goes to the top seed from Period 11, and the bye moves down the seeds each week after.",
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
    title: "Standings and the trophy",
    items: [
      faq(
        "How are the standings ranked?",
        "By record first. Ties in the table are broken by NSNU. On Title Monday (Week 4), Bolts earned in Pit Week break ties first, then NSNU.",
      ),
      faq(
        "What if stores tie for first?",
        "They settle it in the cage. Two tied stores fight each other; three or more go in one free-for-all, and the last bot moving wins.",
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
