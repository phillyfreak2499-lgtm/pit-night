import { conferencePlace, hashString, previewSaturday, recordOf, regularSeasonRecordOf } from "./engine";
import { upcomingMatchups } from "./claude-copy";
import type { ReactiveMoment } from "./reactive-commentary";
import type { Bout, PitData } from "./types";
import { buildTape } from "./replay";
import { fanSplit } from "./fan-picks";

export type BoothScene = "welcome" | "card" | "store" | "gazette" | "walkout" | "pregame";
export type BoothLine = { speaker: "Jim" | "Cathy"; text: string };
export type BoothClip = BoothLine & { audio: string };
const jim = (text: string): BoothLine => ({ speaker: "Jim", text });
const cathy = (text: string): BoothLine => ({ speaker: "Cathy", text });

export function featuredBouts(bouts: Bout[]) {
  const contests = bouts.filter(b => b.kind !== "bye");
  const main = contests.find(b => b.kind === "final" || b.title === "Main event") ?? contests.at(-1);
  return [...new Set([contests[0], main])].filter((b): b is Bout => Boolean(b));
}

export function matchupName(b: Bout) {
  const fighters = b.result?.fighters ?? [];
  return fighters.length === 2 ? fighters.map(f => f.botName).join(" versus ") : b.title;
}

function pickRead(data: PitData, bout: Bout) {
  const split = fanSplit(bout, data.picks ?? []);
  if (!split) return "";
  if (!split.total) return "No fan picks on this one yet.";
  const [a, b] = split.sides;
  if (a!.count === b!.count) return "The fans are split fifty-fifty.";
  const [fav, dog] = a!.count > b!.count ? [a!, b!] : [b!, a!];
  const name = (id: string) => bout.result?.fighters.find(f => f.id === id)?.botName ?? data.bots.find(b => b.storeId === id)?.name ?? id;
  return `${fav.percent} percent picked ${name(fav.id)}. ${name(dog.id)} comes in as the fans' underdog.`;
}

function stakes(data: PitData, bout: Bout) {
  if (bout.kind === "final" && bout.week === 5) return "Two conference champions. The winner takes the Waterman title.";
  if (bout.title.endsWith("Conference Tiebreaker")) return "A championship berth goes to the last bot standing.";
  if (bout.kind !== "bout") return "Keep an eye on the whole field when that bell rings.";
  const prior = new Map(data.bouts.map(b => [b.id, b]));
  for (const replay of data.replays ?? []) for (const b of replay.bouts) prior.set(b.id, b);
  const before = { ...data, bouts: [...prior.values()].filter(b => b.week < bout.week || b.week === bout.week && b.slot < bout.slot) };
  const ids = bout.storeIds.filter(id => data.stores.some(s => s.id === id));
  if (!ids.length) return "A regular-season win is on the line.";
  const storeId = ids[(bout.slot + bout.week) % ids.length]!;
  const record = regularSeasonRecordOf(before, storeId);
  const store = data.stores.find(s => s.id === storeId)!;
  if (!record.w && !record.l) return `${store.name} is looking for its first win.`;
  const place = conferencePlace(before, storeId);
  const tied = before.stores.some(s => s.id !== storeId && s.conference === store.conference && conferencePlace(before,s.id) === place);
  const places = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
  return `${store.name} comes in ${record.w} and ${record.l}, ${tied ? "tied for " : ""}${places[place - 1] ?? "number " + place} in ${store.conference}. ${bout.week === 4 ? "Last regular-season chance to add a win." : `A win gets them to ${record.w + 1}.`}`;
}

export function boothScript(data: PitData, scene: BoothScene, id = ""): BoothLine[] {
  if (scene === "pregame") {
    const week = Number(id);
    if (!Number.isInteger(week) || week < 1 || week > data.week || week > 5) return [];
    const featured = featuredBouts(buildTape(data, week).bouts);
    const first = featured[0];
    if (!first) return [];
    const other = featured[1];
    const title = data.weeks.find(w => w.number === week)?.name;
    return [jim(`Welcome to the Waterman Battle Bot League! Week ${week}${title ? ", " + title : ""}. Up first, ${matchupName(first)}.`),
      cathy([other ? `Also on the card, ${matchupName(other)}.` : "", stakes(data, other ?? first)].filter(Boolean).join(" "))];
  }
  if (scene === "store") {
    const store = data.stores.find(s => s.id === id);
    const bot = data.bots.find(b => b.storeId === id);
    if (!store || !bot) return [];
    const { w, l } = recordOf(data, id);
    return [jim(`Out of ${store.name}, from bay ${bot.number}… ${bot.name}!`),
      cathy(w + l ? `And this ${bot.classId} comes in with ${w} wins and ${l} losses.` : `First win still up for grabs. Keep an eye on this ${bot.classId}.`)];
  }
  if (scene === "walkout") {
    const archived = data.replays?.flatMap(r => r.bouts).find(b => b.id === id);
    const posted = data.bouts.find(b => b.id === id && b.result && (b.week < data.week ||
      ["fought", "inspected", "complete"].includes(data.phase)));
    const preview = !archived && !posted && !data.bouts.some(b => b.week === data.week && b.result);
    const bout = archived ?? posted ?? (preview ? previewSaturday(data).find(b => b.id === id) : undefined);
    if (!bout?.result || bout.kind === "bye") return [];
    const fighters = bout.result.fighters;
    if (fighters.length < 2) return [];
    if (fighters.length === 2) {
      const reads = [jim(`From ${fighters[0]!.storeName}, ${fighters[0]!.botName}! Across the cage, ${fighters[1]!.botName}!`),
        cathy([pickRead(data, bout), stakes(data, bout)].filter(Boolean).join(" "))];
      const seed = hashString("shout:" + bout.week);
      if ((bout.slot + seed) % 3 === 0) {
        const shouts = (data.shouts ?? []).filter(s => s.week === bout.week && s.to.trim() && s.text?.trim());
        const shout = shouts[hashString(bout.id) % Math.max(1, shouts.length)];
        const crew = fighters[hashString(bout.id) % fighters.length]!.storeName;
        if (shout) {
          reads.push(jim(`A shout-out from ${shout.fromName} to ${shout.to}. Cathy, what did they write?`), cathy(shout.text.trim()));
        } else {
          reads.push(jim(`Shout-out to the pit crew in ${crew}!`));
        }
      }
      return reads;
    }
    return [jim(`${fighters.length} bots in the cage! Here come ${fighters.slice(0, 2).map(f => f.botName).join(" and ")}!`),
      cathy(fighters.length <= 4 ? `And joining them, ${fighters.slice(2).map(f => f.botName).join(" and ")}!` : "Watch the outside lanes. Nobody gets a clean one-on-one for long.")];
  }
  if (scene === "gazette") {
    const lead = data.gazette[0];
    return lead ? [cathy(`From the Pit Gazette, here's the headline. ${lead.headline}`)] : [];
  }
  const weekName = data.weeks.find(w => w.number === data.week)?.name;
  const card = data.bouts.filter(b => b.week === data.week && b.kind !== "bye");
  const featured = card.find(b => b.title === "Main event") ?? card[0] ?? upcomingMatchups(data)[0];
  const names = featured?.storeIds.map(s => data.bots.find(b => b.storeId === s)?.name).filter(Boolean) ?? [];
  const opening = scene === "welcome" ? `Welcome to Pit Night! I'm Jim. Cathy, what have you got for week ${data.week}?` :
    `Week ${data.week}${weekName ? ", " + weekName : ""}. Let's take a look at the card!`;
  const read = names.length === 2 ? `Here's one to circle. ${names[0]} and ${names[1]} share the cage this week.` :
    names.length > 2 ? `I'd keep an eye on the group fight. ${names.length} bots have to share that floor.` :
    "The matchups haven't been posted yet. The team pages have the tale of the tape.";
  return [jim(opening), cathy(scene === "welcome" ? "Thanks, Jim. " + read : read)];
}

export function analystReply(m: ReactiveMoment, meterCall?: string): string | undefined {
  if (meterCall && (m.kind === "big-hit" || m.kind === "momentum-shift" || m.kind === "half-health")) return meterCall;
  if (m.kind === "big-hit" && m.index > 0 && m.index % 3 !== 1) return undefined;
  const d = m.defender;
  if (m.counterDamage && m.counterDamage > 0)
    return `Costly for the attacker too, Jim. ${d} sent ${m.counterDamage} damage back.`;
  const options = {
    "momentum-shift": [`${d} had the edge going in. Look who's chasing now.`, `That's the lead changing hands, Jim. ${d} needs an answer.`, `Watch ${d} on the next exchange. That cushion is gone.`],
    "near-knockout": [`${d} is hanging on with ${m.defenderHp} health.`, `There's precious little left for ${d} to trade with.`, `Jim, look at the health on ${d}. One clean shot could do it.`],
    "half-health": [`${d} is down to ${m.defenderHp}. That's an expensive trade.`, `Half the tank was the line, Jim. ${d} just went under it.`, `The next hit costs more when you're this low. Ask ${d}.`],
    "knockout": [`Watch the health on ${d}, Jim. It goes straight to zero.`, `${d} couldn't absorb that last one.`, `That's where the tape ends for ${d}. Nothing left on the meter.`],
    "big-hit": [`Check the meter on ${d}, Jim. ${m.defenderHp} health left.`, `${d} paid ${m.damage} health for that exchange.`, `Look what that did to ${d}'s cushion. Down to ${m.defenderHp}.`],
  }[m.kind];
  return options[(hashString(m.attacker + d) + m.index) % options.length];
}
