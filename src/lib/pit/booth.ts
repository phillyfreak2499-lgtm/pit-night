import { previewSaturday, recordOf } from "./engine";
import { upcomingMatchups } from "./claude-copy";
import type { ReactiveMoment } from "./reactive-commentary";
import type { PitData } from "./types";

export type BoothScene = "welcome" | "card" | "store" | "gazette" | "walkout";
export type BoothLine = { speaker: "Jim" | "Kathy"; text: string };
export type BoothClip = BoothLine & { audio: string };
const jim = (text: string): BoothLine => ({ speaker: "Jim", text });
const kathy = (text: string): BoothLine => ({ speaker: "Kathy", text });

export function boothScript(data: PitData, scene: BoothScene, id = ""): BoothLine[] {
  if (scene === "store") {
    const store = data.stores.find(s => s.id === id);
    const bot = data.bots.find(b => b.storeId === id);
    if (!store || !bot) return [];
    const { w, l } = recordOf(data, id);
    return [jim(`Out of ${store.name}, from bay ${bot.number}… ${bot.name}!`),
      kathy(w + l ? `And this ${bot.classId} comes in with ${w} wins and ${l} losses.` : `First win still up for grabs. Keep an eye on this ${bot.classId}.`)];
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
    if (fighters.length === 2) return [jim(`From ${fighters[0]!.storeName}, ${fighters[0]!.botName}!`),
      kathy(`Across the cage, representing ${fighters[1]!.storeName}… ${fighters[1]!.botName}!`)];
    return [jim(`${fighters.length} bots in the cage! Here come ${fighters.slice(0, 2).map(f => f.botName).join(" and ")}!`),
      kathy(fighters.length <= 4 ? `And joining them, ${fighters.slice(2).map(f => f.botName).join(" and ")}!` : "Watch the outside lanes. Nobody gets a clean one-on-one for long.")];
  }
  if (scene === "gazette") {
    const lead = data.gazette[0];
    return lead ? [kathy(`From the Pit Gazette, here's the headline. ${lead.headline}`)] : [];
  }
  const weekName = data.weeks.find(w => w.number === data.week)?.name;
  const card = data.bouts.filter(b => b.week === data.week && b.kind !== "bye");
  const featured = card.find(b => b.title === "Main event") ?? card[0] ?? upcomingMatchups(data)[0];
  const names = featured?.storeIds.map(s => data.bots.find(b => b.storeId === s)?.name).filter(Boolean) ?? [];
  const opening = scene === "welcome" ? `Welcome to Pit Night! I'm Jim, here with Kathy for week ${data.week}.` :
    `Week ${data.week}${weekName ? ", " + weekName : ""}. Let's take a look at the card!`;
  return [jim(opening), kathy(names.length === 2 ? `Here's one to circle. ${names[0]} and ${names[1]} share the cage this week.` :
    names.length > 2 ? `I'd keep an eye on the group fight. ${names.length} bots have to share that floor.` :
    "The matchups haven't been posted yet. The team pages have the tale of the tape.")];
}

export function analystReply(m: ReactiveMoment): string | undefined {
  switch (m.kind) {
    case "momentum-shift": return `That's the swing, Jim. Now ${m.defender} has to chase.`;
    case "near-knockout": return `And look at ${m.defender}. There's almost no margin left.`;
    case "half-health": return `That leaves ${m.defender} with less than half its health. Every exchange matters now.`;
    case "knockout": return `Right there, Jim. That last contact put ${m.defender} out.`;
    case "big-hit": return undefined;
  }
}
