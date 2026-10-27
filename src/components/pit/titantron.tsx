import { Link } from "@tanstack/react-router";
import { CLASS_META } from "@/lib/pit/catalog";
import { useEffect, useMemo, useState } from "react";
import { botFor, buildCard, championshipFinalists, conferenceStandings, randomHouseTape, regularSeasonRecordOf } from "@/lib/pit/engine";
import { paintHex, usePit } from "@/lib/pit/store";
import { programWeek } from "@/lib/pit/training";
import { weekDeadline } from "@/lib/pit/time";
import { tunedUp } from "@/lib/pit/week";
import { ArenaHero } from "./arena-hero";
import { BotPortrait, useBotLook } from "./bot-portrait";
import { BoutWatch, ClassTag, formatRemain, nextLock, Panel, PERIOD_OPENS, ResultLine, SectionLabel, useNow } from "./bits";

export function Titantron() {
  const data = usePit();
  const weekMeta = data.weeks.find((w) => w.number === data.week);
  const now = useNow();
  const beforeOpen = !now || now.getTime() < PERIOD_OPENS.getTime();
  const deadline = weekDeadline(data.week);
  const remain = now ? formatRemain((beforeOpen ? PERIOD_OPENS : nextLock(now, data.week)).getTime() - now.getTime()) : "—";
  const gazette = data.gazette[0];
  const featured =
    data.bouts.find((b) => b.week === data.week && b.title === "Main event") ??
    data.bouts.find((b) => b.week === data.week && b.kind === "final") ??
    data.bouts.find((b) => b.week === data.week && b.kind === "bout") ??
    buildCard(data).find((b) => b.kind === "final" || b.title === "Main event");
  const boss = data.session.role === "commissioner";
  const replay = featured?.result && featured.result.fighters.length === 2 ? featured.result : null;
  // Between real cards the screen runs house fights: a new pair of random builds and looks every loop.
  const [houseSeed, setHouseSeed] = useState(1);
  useEffect(() => setHouseSeed(Math.floor(Math.random() * 1_000_000_000) + 1), []);
  const house = useMemo(() => randomHouseTape(houseSeed).result, [houseSeed]);
  const heroTape = replay ?? house;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <section className="cage-floor relative overflow-hidden border border-line bg-deep">
        <div className="hazard h-2" />
        <div className="relative lg:min-h-[25rem]">
          <ArenaHero result={heroTape} onLap={replay ? undefined : () => setHouseSeed((s) => s + 1)} className="aspect-video w-full lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:h-full lg:w-[64%]" />
          <div className="pointer-events-none absolute inset-y-0 left-[36%] hidden w-48 bg-gradient-to-r from-deep to-transparent lg:block" />
          <span className="absolute top-3 right-3 flex items-center gap-2 bg-deep/80 px-2 py-1 font-display text-xs tracking-widest text-fg uppercase">
            <span className="live-dot h-2 w-2 rounded-full bg-spark" />
            {replay ? `Replay · ${featured?.title ?? "Main event"}` : "House drill · live"}
          </span>
          <div className="relative px-4 py-6 md:px-8 md:py-10 lg:w-[44%]">
            <SectionLabel>The Waterman Group · Good Feet</SectionLabel>
            <h1 className="glow-text mt-2 max-w-4xl font-display text-5xl leading-[0.85] tracking-wide md:text-7xl">
              THE WATERMAN
              <span className="block">BATTLE BOT</span>
              <span className="block text-amber">LEAGUE</span>
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-muted">{data.tagline}</p>
          </div>
        </div>
        <div className="relative grid gap-3 border-t border-line bg-deep/60 px-4 py-4 md:grid-cols-3 md:px-8">
          <Panel className="p-4">
            <p className="text-xs tracking-widest text-muted uppercase">Week {data.week}</p>
            <p className="font-display text-3xl leading-none">{weekMeta?.name}</p>
            <p className="mt-2 text-sm text-muted">{weekMeta?.blurb}</p>
          </Panel>
          <Panel className="p-4">
            <p className="text-xs tracking-widest text-muted uppercase">{beforeOpen ? "Opens Oct 25" : data.week === 5 ? "Friday Nov 27 lock" : data.week === 1 ? "Saturday Oct 31 lock" : "Saturday lock"}</p>
            <p className="font-display text-4xl leading-none text-amber tabular-nums">{data.phase === "open" || beforeOpen ? remain : phaseWord(data.phase)}</p>
            <p className="mt-2 text-sm text-muted">
              {beforeOpen
                ? "October 25, 2026. Build now. The first bell has not rung."
                : data.week === 5
                  ? "Only the two finalists prep this week. Title builds lock automatically Friday, Nov 27, at 6:00 PM CT, ahead of Saturday, Nov 28."
                  : data.week === 1
                    ? `Builds lock automatically ${deadline?.label ?? "Saturday, Oct 31, 6:00 PM CT"}. That build fights Monday.`
                    : "Each store locks one build at Saturday close. That build fights Monday."}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="text-xs tracking-widest text-muted uppercase">Last gazette</p>
            <p className="font-display text-2xl leading-tight">{gazette?.headline}</p>
            <Link to="/gazette" className="mt-2 inline-block text-sm text-amber">
              Read the sheet
            </Link>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <div className="flex items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <SectionLabel>Featured</SectionLabel>
              <h2 className="font-display text-3xl leading-none">
                {featured ? featured.title : "Main event"}
              </h2>
            </div>
            {featured?.result ? <BoutWatch bout={featured} /> : <Link to="/watch" className="text-sm text-amber">Watch party</Link>}
          </div>
          <div className="grid gap-px bg-line md:grid-cols-2">
            <FighterCard storeId={featured?.teamA[0] ?? "plano"} facing={1} />
            <FighterCard storeId={featured?.teamB[0] ?? "allen"} facing={-1} />
          </div>
          <div className="px-4 py-3 text-sm text-muted">
            {featured?.result ? <ResultLine bout={featured} /> : data.week === 5 ? "Championship Saturday, Nov 28. Title builds lock automatically Friday, Nov 27, at 6:00 PM CT. The fight runs until knockout." : data.week === 1 ? "Card posts Monday morning. Builds lock automatically Saturday, Oct 31, at 6:00 PM CT." : "Card posts Monday morning. Lock your build by Saturday close."}
          </div>
        </Panel>
        <Panel className="p-4">
          <SectionLabel>The only trophy</SectionLabel>
          <h2 className="mt-1 font-display text-3xl leading-none">It hangs in a store</h2>
          <p className="mt-3 text-sm text-muted">
            Pit crew get their names on the titantron and a weekly MVP. They do not get a personal bot, a personal bracket, or a personal record. The six numbers are the stats: NSNU, Conv %, Demo Rate, Demo Close %, Arch Supports, and Demo Ticket Avg.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/broadcast" className="inline-flex min-h-11 items-center bg-amber px-4 font-display text-sm tracking-wide text-deep uppercase">
              {data.week === 5 ? "Championship broadcast" : "Monday broadcast"}
            </Link>
            <Link to="/preview" className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
              Watch a house fight
            </Link>
            <Link to="/map" className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
              Fourteen doors
            </Link>
            <Link to="/rules" className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
              How it works
            </Link>
            <Link to="/honors" className="inline-flex min-h-11 items-center border border-line px-4 font-display text-sm tracking-wide uppercase">
              Honors
            </Link>
          </div>
          {boss ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs tracking-widest text-muted uppercase">Desk is live</p>
              <Link to="/desk" className="mt-2 inline-flex min-h-11 items-center bg-spark px-4 font-display text-sm tracking-wide text-deep uppercase">
                Run the card
              </Link>
            </div>
          ) : null}
        </Panel>
      </section>

      <PitWeekCallout />

      <section>
        <div className="mb-3">
          <h2 className="font-display text-3xl leading-none">Conference standings</h2>
          <p className="mt-1 text-sm text-muted">
            Record · head-to-head when applicable · conference record · cumulative NSNU · green grades · Bolts earned.
            A still-unresolved championship berth tie goes to the cage.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["metro", "frontier"] as const).map((conference) => (
            <div key={conference} className="border border-line bg-surface">
              <div className="border-b border-line px-3 py-2 font-display text-xl text-amber uppercase">
                {conference} Conference
              </div>
              <ol>
                {conferenceStandings(data, conference).map((store, index) => {
                  const bot = botFor(data, store.id);
                  const rec = regularSeasonRecordOf(data, store.id);
                  const finalist = data.week === 5 && championshipFinalists(data).includes(store.id);
                  return (
                    <li key={store.id}>
                      <Link
                        to="/stores/$storeId"
                        params={{ storeId: store.id }}
                        data-bot-hover
                        className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 ${finalist ? "bg-amber/10" : ""}`}
                      >
                        <span className="w-6 font-display text-xl text-muted">{index + 1}</span>
                        <span className="min-w-0">
                          <span className="block font-display">{store.name}</span>
                          <span className="block text-xs text-muted">
                            {bot.name}{finalist ? " · CONFERENCE CHAMPION" : ""}
                          </span>
                        </span>
                        <span className="font-display text-xl">{rec.w}–{rec.l}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {gazette ? (
        <div className="overflow-hidden border border-line bg-deep">
          <div className="ticker flex w-[200%] gap-12 py-2 whitespace-nowrap">
            <p className="px-4 text-sm text-muted">{gazette.kicker} — {gazette.headline}</p>
            <p className="px-4 text-sm text-muted">{gazette.kicker} — {gazette.headline}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FighterCard({ storeId, facing }: { storeId: string; facing: 1 | -1 }) {
  const data = usePit();
  const look = useBotLook(storeId);
  const store = data.stores.find((s) => s.id === storeId);
  if (!store) return null;
  const bot = botFor(data, storeId);
  return (
    <Link to="/garage/$storeId" params={{ storeId }} data-bot-hover className="group bg-surface p-4 transition-colors hover:bg-surface-2">
      <span className="mb-3 block h-1 w-16" style={{ background: paintHex(store.paint) }} />
      <span className="relative -mx-4 mb-3 block h-32 bg-gradient-to-b from-transparent to-black/40">
        <BotPortrait look={look} facing={facing} zoom={0.85} className="h-full w-full" />
      </span>
      <ClassTag classId={bot.classId} />
      <p className="font-display text-3xl leading-none">{bot.name}</p>
      <p className="mt-1 text-muted">{store.name}</p>
      <p className="mt-3 text-sm text-muted">{CLASS_META[bot.classId].blurb}</p>
    </Link>
  );
}

function phaseWord(phase: string) {
  if (phase === "locked") return "LOCKED";
  if (phase === "fought") return "LIVE CARD";
  if (phase === "inspected") return "QUOTES UP";
  return "CLOSED";
}

function PitWeekCallout() {
  const data = usePit();
  const plan = programWeek(Math.min(5, Math.max(1, data.week)));
  if (!plan) return null;
  const tuned = data.stores.filter((s) => tunedUp(data, s.id, plan.week)).length;
  return (
    <Link to="/week" className="lift group grid gap-3 border border-amber/60 bg-surface p-4 md:grid-cols-[1fr_auto] md:items-center">
      <span>
        <span className="block font-display text-xs tracking-[0.22em] text-amber uppercase">{plan.week === 5 ? "Championship Prep · finalists only" : "Pit Week · Tuesday to Saturday"}</span>
        <span className="mt-1 block font-display text-3xl leading-none">
          Week {plan.week}: {plan.theme}
        </span>
        <span className="mt-1 block text-sm text-muted">
          {plan.week === 5 ? "The two conference champions earn their own Saturday preparation Tuesday through Friday. Everybody else can Rally without changing the fight." : "Two jobs and a Daily Spark every day. Finish the whole week as a crew and your bot fights Monday with a Full Tune-Up: +4 to every stat."}
        </span>
      </span>
      <span className="flex items-center gap-3 font-display">
        <span className="text-sm text-muted">{plan.week === 5 ? `${tuned} finalists tuned` : `${tuned} of ${data.stores.length} bays tuned`}</span>
        <span className="bg-amber px-4 py-2 text-sm tracking-wide text-deep uppercase">{plan.week === 5 ? "Open Championship Week" : "Open Pit Week"}</span>
      </span>
    </Link>
  );
}
