import { Link } from "@tanstack/react-router";
import { SectionLabel } from "./bits";
import { KeyLadder, UpgradeHowTo } from "./key-ladder";

export function RulesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <SectionLabel>How it works</SectionLabel>
        <h1 className="font-display text-5xl leading-none">The store is the bot</h1>
        <p className="mt-3 text-muted">
          The Waterman Battle Bot League is the Monday morning card for The Waterman Group. Period 12 runs October 25 through November 21. Eleven Good Feet stores. One bot each. Four fight days: November 2, 9, 16, and 23. The trophy hangs in a building. Pit crew get a name on the titantron. They do not take hardware home.
        </p>
        <p className="mt-2 text-sm">
          New here? Start with the{" "}
          <Link to="/faq" className="text-amber">
            FAQ
          </Link>
          .
        </p>
      </div>
      <Rule title="The clock">
        Monday through Saturday the store runs the floor. That whole week is the card. Saturday at close is one lock: chassis, drive, weapon, armor, utility, brain. The captain locks before the final numbers are in, so the lock is a bet on the week. Sunday the official numbers come out and the desk clicks in each store's six colors. Monday morning the desk runs the card live: five fights and one bye. The bye counts as a win and does not damage the bot. Monday afternoon is the damage report, the coins pay out, and the shop opens for the next week. Week 1 is different: Period 11 colors pay the opening coins and set the seeds. The 1 seed takes the first bye, 2 fights 11, 3 fights 10, and so on.
      </Rule>
      <Rule title="What scores">
        Six numbers, graded green, blue, orange, or red. NSNU: green $1,000+, blue $900–$999, orange $800–$899. Conv %: green 64%+, blue 56–63%, orange 47–55%. Demo Rate: green 88%+, blue 80–87%, orange 72–79%. Demo Close %: green 73%+, blue 70–72%, orange 65–69%. Arch Supports: green 3.8+, blue 3.0–3.7, orange 2.5–2.9. Demo Ticket Avg: green $1,800+, blue $1,600–$1,799, orange $1,400–$1,599. Anything under orange is red. The better the week, the higher the bot's rating going into the fight.
      </Rule>
      <Rule title="Grades and coins">
        Each number pays coins into one part's jar every Monday: green 3, blue 2, orange 1, red 0. NSNU fills the chassis jar. Conv % fills armor. Demo Rate fills drive. Demo Close % fills weapon. Arch Supports fill utility. Demo Ticket Avg fills the brain, which is how smart the bot fights. A jar only buys its own part, and repairs on that part come out of the same jar. Last place gets a 3-coin repair voucher that fixes any part.
      </Rule>
      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="font-display text-2xl">Upgrades in one look</h2>
        <UpgradeHowTo compact />
        <KeyLadder />
      </section>
      <Rule title="The triangle">
        It works like rock, paper, scissors. Strikers (fed by Demo Rate and Demo Close) hit hard and fast but fade in a long fight, so they beat Tanks early. Tanks (fed by Demo Ticket and Conv %) soak hits and win late, so they beat Specialist bots. Specialist bots (fed by Arch Supports and NSNU; this is the bot class, not the job title) grab and burn, so they shut Strikers down. The right matchup can flip a fight you should lose. A great week with a bad build can still lose, and a Super part on bent wheels is not a Super.
      </Rule>
      <Rule title="Iron">
        Every bot starts stock, and you choose which stock weapon and which brain. Before Week 1 the desk pays opening coins from Period 11 colors, and the shop opens. It shuts at Saturday lock and reopens after each damage report. Sport costs 3 coins from that part's jar, Pro 5, Super 8. One green week buys a Sport. A green and a blue buys a Pro. Green, green, blue buys a Super, so a store that stays green on Demo Close all month brings a Super weapon to the title fight. Championship is a Title Monday drop or salvage off a wrecked Super after a win. Never sold. Changing class after Week 1 costs 3 chassis coins. A disabled chassis fights stock of the same class. You do not get a free swap off a wreck.
      </Rule>
      <Rule title="The card">
        Eleven stores. Seeds 1 through 11 come from Period 11 colors. Each week the wheel turns one spot. The store at the top of that week's wheel draws the bye. Seeds 1 through 4 each get one bye across the four weeks. A bye is a win. It is not a scrimmage. Week 4 is the last card, not a semifinal. The best record takes the trophy. Same wins and same losses is a tie, and those stores battle it out for the trophy. In the standings table, actual NSNU dollars recorded by the Desk break ties. On Title Monday (the Week 4 fight card) the stakes go up: bolts earned in Pit Week break a tie first, then NSNU. Two stores fight. Three or more go in one cage. Best Build can still come from any bay.
      </Rule>
      <Rule title="Pit Week">
        Tuesday through Saturday every specialist gets two jobs a day, one culture and one skill, plus a three-question Daily Spark. Write one line of proof and the captain gives the thumbs-up. Bolts: 2 for each approved job, 1 for each right Spark answer, 2 for each right Monday pick, and 5 for Wednesday's Mystery Crate, a surprise bonus job that is not part of the Tune-Up. Five perfect Sparks in a row puts a flame badge on your name. Bolts buy looks in the Bolt Locker, never wins. The Full Tune-Up is the one thing that touches the fight: if every specialist who is not marked off finishes all ten jobs and all five Sparks, and the captain finishes CARE, by Saturday lock, the bot gets +4 Power, Speed, Armor, and Heat on Monday.
      </Rule>
      <Rule title="The bay">
        Paint, finish, decals, trim, eye color, the flag, garage floor, stripes, and the bay number are decoration. They do not change Power, Speed, Armor, or Heat. A Scry on the utility slot is the spy, and it stays shut until the bay calls the weapon family out loud. Then it says whether that call was right, and whether the weapon belongs on their class. It does not name the part. One call per fight. They can still change the draft until Saturday close. Captains can test the build against three house drills. That tape does not post damage, scrap, or a record. Captains rename the crew, add up to eight specialists, and keep at least one. Staff edits are not the lock.
      </Rule>
      <Rule title="Damage">
        Clean, scratched, bent, disabled. Bent is half effect. Disabled falls back to a stock loaner until you pay (a dead utility just goes empty). Winners still scratch. Blowouts can kill weapon and drive. Repairs come out of that part's jar: scratched 1 coin, bent 2, disabled 4. An emergency weld turns Disabled into Bent for one week for 1 coin. Salvage strips a rare part for a few coins back and drops the slot to stock.
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
