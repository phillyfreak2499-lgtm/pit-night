import { bannerVerdict } from "../../../scripts/copy-guard.mjs";
import { BODY_STYLES, METRICS, bodyStyle } from "./catalog";
import { championshipFinalists, gradesOf, recordOf } from "./engine";
import { sparkStreak, tunedUp } from "./week";
import type { BotBody, PitData, StatKey } from "./types";

export type CosmeticKind = "finish" | "decal" | "trim" | "eye" | "paint" | "topper" | "body" | "look" | "mask" | "weaponSkin" | "leds" | "smoke" | "banner";
export type CosmeticReward = {
  id: string;
  kind: CosmeticKind;
  value: string;
  label: string;
  requirement: string;
  progress: (data: PitData, storeId: string) => { current: number; target: number };
};

function approvedJobs(data: PitData, storeId: string) {
  return data.jobLog.filter((e) => e.storeId === storeId && e.status === "approved" && !e.jobId.endsWith("-crate")).length;
}
/** Pit Week 1 jobs only. Halloween looks are earned that week and stay unlocked after it. */
function halloweenJobs(data: PitData, storeId: string) {
  return data.jobLog.filter((e) => e.storeId === storeId && e.week === 1 && e.status === "approved" && !e.jobId.endsWith("-crate")).length;
}
/** Election Week (Week 2) activity. The looks stay unlocked after the week. */
function electionJobs(data: PitData, storeId: string) {
  return data.jobLog.filter((e) => e.storeId === storeId && e.week === 2 && e.status === "approved" && !e.jobId.endsWith("-crate")).length;
}
function electionPicks(data: PitData, storeId: string) {
  return data.picks.filter((p) => p.storeId === storeId && p.week === 2).length;
}
function electionPerfectSparks(data: PitData, storeId: string) {
  return data.sparkLog.filter((e) => e.storeId === storeId && e.week === 2 && e.total > 0 && e.correct === e.total).length;
}
/** One week's approved jobs, Monday picks and perfect Sparks. Seasonal looks earned that week stay unlocked after it. */
function jobsInWeek(week: number) {
  return (data: PitData, storeId: string) =>
    data.jobLog.filter((e) => e.storeId === storeId && e.week === week && e.status === "approved" && !e.jobId.endsWith("-crate")).length;
}
function picksInWeek(week: number) {
  return (data: PitData, storeId: string) => data.picks.filter((p) => p.storeId === storeId && p.week === week).length;
}
function perfectSparksInWeek(week: number) {
  return (data: PitData, storeId: string) =>
    data.sparkLog.filter((e) => e.storeId === storeId && e.week === week && e.total > 0 && e.correct === e.total).length;
}
function crates(data: PitData, storeId: string) {
  return data.jobLog.filter((e) => e.storeId === storeId && e.status === "approved" && e.jobId.endsWith("-crate")).length;
}
function correctSparkAnswers(data: PitData, storeId: string) {
  return data.sparkLog.filter((e) => e.storeId === storeId).reduce((n,e)=>n+e.correct,0);
}
function perfectSparks(data: PitData, storeId: string) {
  return data.sparkLog.filter((e) => e.storeId === storeId && e.total > 0 && e.correct === e.total).length;
}
function bestStreak(data: PitData, storeId: string) {
  return data.crew.filter(c=>c.storeId===storeId).reduce((best,c)=>Math.max(best,sparkStreak(data,c.id).best),0);
}
function correctPicks(data: PitData, storeId: string) {
  return data.picks.filter((p) => {
    if (p.storeId !== storeId) return false;
    const bout = data.bouts.find(b=>b.id===p.boutId && b.result);
    return Boolean(bout?.result?.winnerIds.includes(p.pick));
  }).length;
}
function tuneUps(data: PitData, storeId: string) {
  return data.weeks.filter(w=>w.number <= Math.min(5,data.week)).filter(w=>tunedUp(data,storeId,w.number)).length;
}
function wins(data: PitData, storeId: string) {
  return data.bouts.filter(b=>b.result?.winnerIds.includes(storeId) && b.result.method !== "scrimmage" && b.week <= 4).length;
}
function koWins(data: PitData, storeId: string) {
  return data.bouts.filter(b=>b.result?.winnerIds.includes(storeId) && b.result.method === "ko" && b.week <= 4).length;
}
function shouts(data: PitData, storeId: string) {
  return data.shouts.filter(s=>s.storeId===storeId).length;
}
/** Championship Week shouts only. Thanksgiving looks are earned in Week 5 and stay unlocked after it. */
function week5Shouts(data: PitData, storeId: string) {
  return data.shouts.filter(s=>s.storeId===storeId && s.week===5).length;
}
function week5PerfectSparks(data: PitData, storeId: string) {
  return data.sparkLog.filter((e) => e.storeId === storeId && e.week === 5 && e.total > 0 && e.correct === e.total).length;
}
/** A hit pick on the Week 5 title bout — the Waterman Championship final. */
function titlePick(data: PitData, storeId: string) {
  return data.picks.filter((pick) => {
    if (pick.storeId !== storeId) return false;
    const bout = data.bouts.find(b=>b.id===pick.boutId && b.week===5 && b.kind==="final" && b.result);
    return Boolean(bout?.result?.winnerIds.includes(pick.pick));
  }).length;
}
function finalist(data: PitData, storeId: string) {
  return championshipFinalists(data).includes(storeId) ? 1 : 0;
}
function champion(data: PitData, storeId: string) {
  return data.honors.pitBelt === storeId ? 1 : 0;
}
/** Desk-finalized regular-season cards. House projections are not grades yet. */
function finalizedCard(card: { storeId: string; week: number; projected: boolean }, storeId: string) {
  return card.storeId === storeId && card.week <= 4 && card.projected === false;
}
function greenWeeks(stat: StatKey) {
  return (data: PitData, storeId: string) =>
    data.storeCards.filter((card) => finalizedCard(card, storeId) && gradesOf(card)[stat] === "green").length;
}
function perfectWeeks(data: PitData, storeId: string) {
  return data.storeCards.filter(
    (card) => finalizedCard(card, storeId) && METRICS.every((metric) => gradesOf(card)[metric.stat] === "green"),
  ).length;
}
function serviceMarks(data: PitData, storeId: string) {
  const bot = data.bots.find((row) => row.storeId === storeId);
  if (!bot) return 0;
  const welded = Object.values(bot.weldForWeek ?? {}).some((week) => typeof week === "number");
  return (bot.services ?? 0) > 0 || bot.repairSpent > 0 || welded ? 1 : 0;
}
function bestWinStreak(data: PitData, storeId: string) {
  const bouts = data.bouts
    .filter((bout) => bout.week <= 4 && bout.result && bout.result.method !== "scrimmage")
    .filter((bout) => bout.result!.winnerIds.includes(storeId) || bout.result!.loserIds.includes(storeId))
    .sort((a, b) => a.week - b.week || a.slot - b.slot);
  let current = 0;
  let best = 0;
  for (const bout of bouts) {
    if (bout.result!.winnerIds.includes(storeId)) {
      current += 1;
      best = Math.max(best, current);
    } else current = 0;
  }
  return best;
}
function bestPickStreak(data: PitData, storeId: string) {
  const picks = data.picks.filter((pick) => pick.storeId === storeId).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  let current = 0;
  let best = 0;
  for (const pick of picks) {
    const bout = data.bouts.find((row) => row.id === pick.boutId && row.result);
    if (!bout?.result) continue;
    if (bout.result.winnerIds.includes(pick.pick)) {
      current += 1;
      best = Math.max(best, current);
    } else current = 0;
  }
  return best;
}
function storeWins(data: PitData, storeId: string) {
  return recordOf(data, storeId).w;
}
const p = (fn:(d:PitData,s:string)=>number,target:number) => (data:PitData,storeId:string) => ({current:fn(data,storeId),target});

export const COSMETIC_REWARDS: CosmeticReward[] = [
  { id:"reward-hazard", kind:"decal", value:"hazard", label:"Hazard Stripes", requirement:"Approve 2 Pit Week jobs", progress:p(approvedJobs,2) },
  { id:"reward-red-trim", kind:"trim", value:"red", label:"Red Trim", requirement:"Approve 5 Pit Week jobs", progress:p(approvedJobs,5) },
  { id:"reward-matte", kind:"finish", value:"matte", label:"Matte Finish", requirement:"Approve 10 Pit Week jobs", progress:p(approvedJobs,10) },
  { id:"reward-checker", kind:"decal", value:"checker", label:"Race Checks", requirement:"Approve 20 Pit Week jobs", progress:p(approvedJobs,20) },
  { id:"reward-antenna", kind:"topper", value:"antenna", label:"Whip Antenna", requirement:"Approve 30 Pit Week jobs", progress:p(approvedJobs,30) },
  { id:"reward-blue-eye", kind:"eye", value:"blue", label:"Blue Visor", requirement:"Score one perfect Daily Spark", progress:p(perfectSparks,1) },
  { id:"reward-blue-trim", kind:"trim", value:"blue", label:"Blue Trim", requirement:"Score 2 perfect Daily Sparks", progress:p(perfectSparks,2) },
  { id:"reward-lightning", kind:"decal", value:"lightning", label:"Lightning Decal", requirement:"Score 3 perfect Daily Sparks", progress:p(perfectSparks,3) },
  { id:"reward-flames", kind:"decal", value:"flames", label:"Flame Decal", requirement:"Score 5 perfect Daily Sparks", progress:p(perfectSparks,5) },
  { id:"reward-mohawk", kind:"topper", value:"mohawk", label:"Steel Mohawk", requirement:"Reach a 5-perfect-Spark streak", progress:p(bestStreak,5) },
  { id:"reward-electric", kind:"paint", value:"electric", label:"Electric Blue Paint", requirement:"Get 10 Spark answers right", progress:p(correctSparkAnswers,10) },
  { id:"reward-hotpink", kind:"paint", value:"hotpink", label:"Hot Pink Paint", requirement:"Get 20 Spark answers right", progress:p(correctSparkAnswers,20) },
  { id:"reward-green-trim", kind:"trim", value:"green", label:"Green Trim", requirement:"Get 25 Spark answers right", progress:p(correctSparkAnswers,25) },
  { id:"reward-toxic", kind:"paint", value:"toxic", label:"Toxic Lime Paint", requirement:"Get 35 Spark answers right", progress:p(correctSparkAnswers,35) },
  { id:"reward-circuit", kind:"decal", value:"circuit", label:"Circuit Board Decal", requirement:"Get 50 Spark answers right", progress:p(correctSparkAnswers,50) },
  { id:"reward-arch", kind:"decal", value:"arch", label:"Arch Badge", requirement:"Complete one Mystery Crate", progress:p(crates,1) },
  { id:"reward-white-eye", kind:"eye", value:"white", label:"White Visor", requirement:"Complete 2 Mystery Crates", progress:p(crates,2) },
  { id:"reward-satin", kind:"finish", value:"satin", label:"Satin Finish", requirement:"Complete 2 Mystery Crates", progress:p(crates,2) },
  { id:"reward-pearl", kind:"paint", value:"pearl", label:"Pearl White Paint", requirement:"Complete 3 Mystery Crates", progress:p(crates,3) },
  { id:"reward-camo", kind:"decal", value:"camo", label:"Camo Decal", requirement:"Complete 4 Mystery Crates", progress:p(crates,4) },
  { id:"reward-red-eye", kind:"eye", value:"red", label:"Red Visor", requirement:"Hit one Monday pick", progress:p(correctPicks,1) },
  { id:"reward-horns", kind:"topper", value:"horns", label:"Pit Horns", requirement:"Hit 3 Monday picks", progress:p(correctPicks,3) },
  { id:"reward-stars", kind:"decal", value:"stars", label:"Victory Stars", requirement:"Post 3 shout-outs", progress:p(shouts,3) },
  { id:"reward-pink-trim", kind:"trim", value:"pink", label:"Pink Trim", requirement:"Post 5 shout-outs", progress:p(shouts,5) },
  { id:"reward-splash", kind:"decal", value:"splash", label:"Paint Splash", requirement:"Post 6 shout-outs", progress:p(shouts,6) },
  { id:"reward-teeth", kind:"decal", value:"teeth", label:"Shark Teeth", requirement:"Win by knockout", progress:p(koWins,1) },
  { id:"reward-worn", kind:"finish", value:"worn", label:"Battle-Worn Finish", requirement:"Win 2 fights", progress:p(wins,2) },
  { id:"reward-carbon", kind:"finish", value:"carbon", label:"Carbon Finish", requirement:"Win 3 fights", progress:p(wins,3) },
  { id:"reward-obsidian", kind:"paint", value:"obsidian", label:"Obsidian Paint", requirement:"Win 3 fights", progress:p(wins,3) },
  { id:"reward-full-tune", kind:"finish", value:"chrome", label:"Chrome Finish", requirement:"Earn one Full Tune-Up", progress:p(tuneUps,1) },
  { id:"reward-elite-body", kind:"body", value:"elite", label:"Elite Body Shell", requirement:"Earn one Full Tune-Up", progress:p(tuneUps,1) },
  { id:"reward-iridescent", kind:"finish", value:"iridescent", label:"Iridescent Finish", requirement:"Earn 2 Full Tune-Ups", progress:p(tuneUps,2) },
  { id:"reward-purple-eye", kind:"eye", value:"purple", label:"Purple Visor", requirement:"Earn 2 Full Tune-Ups", progress:p(tuneUps,2) },
  { id:"reward-finalist-body", kind:"body", value:"finalist", label:"Conference Champion Body", requirement:"Reach Championship Saturday", progress:p(finalist,1) },
  { id:"reward-gold-trim", kind:"trim", value:"gold", label:"Gold Trim", requirement:"Reach Championship Saturday", progress:p(finalist,1) },
  { id:"reward-crown", kind:"topper", value:"crown", label:"Champion Crown", requirement:"Win the Waterman Championship", progress:p(champion,1) },
  { id:"reward-champion-finish", kind:"finish", value:"gold", label:"Champion Gold Finish", requirement:"Win the Waterman Championship", progress:p(champion,1) },
  { id:"reward-champion-decal", kind:"decal", value:"champion", label:"Champion Crest", requirement:"Win the Waterman Championship", progress:p(champion,1) },
  { id:"reward-pumpkin", kind:"decal", value:"pumpkin", label:"Pumpkin Sticker", requirement:"Approve 1 Pit Week 1 job", progress:p(halloweenJobs,1) },
  { id:"reward-lantern-mask", kind:"mask", value:"lantern", label:"Lantern Mask", requirement:"Approve 2 Pit Week 1 jobs", progress:p(halloweenJobs,2) },
  { id:"reward-hockey-mask", kind:"mask", value:"hockey", label:"Hockey Mask", requirement:"Approve 4 Pit Week 1 jobs", progress:p(halloweenJobs,4) },
  { id:"reward-hockey-machete", kind:"weaponSkin", value:"hockey-machete", label:"Hockey Mask Machete", requirement:"Approve 6 Pit Week 1 jobs", progress:p(halloweenJobs,6) },
  { id:"reward-turkey", kind:"decal", value:"turkey", label:"Turkey Sticker", requirement:"Rally in Championship Week — post 1 shout-out in Week 5", progress:p(week5Shouts,1) },
  { id:"reward-pilgrim-hat", kind:"topper", value:"pilgrimhat", label:"Pilgrim Hat", requirement:"Post 3 shout-outs in Championship Week", progress:p(week5Shouts,3) },
  { id:"reward-wishbone", kind:"decal", value:"wishbone", label:"Wishbone Decal", requirement:"Call the title fight — hit your pick in the Waterman Championship", progress:p(titlePick,1) },
  { id:"reward-harvest-wreath", kind:"topper", value:"wreath", label:"Harvest Wreath", requirement:"Score a perfect Daily Spark in Championship Week", progress:p(week5PerfectSparks,1) },
  { id:"reward-ivoted", kind:"decal", value:"ivoted", label:"I Voted Sticker", requirement:"Cast your vote: make a Monday pick on the Week 2 card", progress:p(electionPicks,1) },
  { id:"reward-ballot", kind:"decal", value:"ballot", label:"Ballot Box Sticker", requirement:"Approve 2 Pit Week 2 jobs (Election Week)", progress:p(electionJobs,2) },
  { id:"reward-capitol", kind:"decal", value:"capitol", label:"Capitol Dome Sticker", requirement:"Score a perfect Daily Spark in Election Week", progress:p(electionPerfectSparks,1) },
  { id:"reward-tophat", kind:"topper", value:"tophat", label:"Top Hat", requirement:"Approve 4 Pit Week 2 jobs (Election Week)", progress:p(electionJobs,4) },
  { id:"reward-dogtags", kind:"decal", value:"dogtags", label:"Dog Tags", requirement:"Make a Monday pick on the Week 3 card (Veterans Day week)", progress:p(picksInWeek(3),1) },
  { id:"reward-yellowribbon", kind:"decal", value:"yellowribbon", label:"Yellow Ribbon", requirement:"Approve 2 Pit Week 3 jobs (Veterans Day week)", progress:p(jobsInWeek(3),2) },
  { id:"reward-medal", kind:"decal", value:"medal", label:"Service Medal", requirement:"Score a perfect Daily Spark in Veterans Day week", progress:p(perfectSparksInWeek(3),1) },
  { id:"reward-bugle", kind:"topper", value:"bugle", label:"Bugle", requirement:"Approve 4 Pit Week 3 jobs (Veterans Day week)", progress:p(jobsInWeek(3),4) },
  { id:"reward-recycle", kind:"decal", value:"recycle", label:"Recycling Arrows", requirement:"Make a Monday pick on the Week 4 card (America Recycles Day week)", progress:p(picksInWeek(4),1) },
  { id:"reward-bottlecap", kind:"decal", value:"bottlecap", label:"Bottle Cap", requirement:"Approve 2 Pit Week 4 jobs (America Recycles Day week)", progress:p(jobsInWeek(4),2) },
  { id:"reward-sprout", kind:"decal", value:"sprout", label:"Sprout", requirement:"Score a perfect Daily Spark in America Recycles Day week", progress:p(perfectSparksInWeek(4),1) },
  { id:"reward-tincan", kind:"topper", value:"tincan", label:"Tin Can Hat", requirement:"Approve 4 Pit Week 4 jobs (America Recycles Day week)", progress:p(jobsInWeek(4),4) },
  { id:"reward-gear", kind:"decal", value:"gear", label:"Gear", requirement:"Post a green NSNU grade", progress:p(greenWeeks("nsnu"),1) },
  { id:"reward-wrench", kind:"decal", value:"wrench", label:"Wrench", requirement:"Survive a repair or an emergency weld", progress:p(serviceMarks,1) },
  { id:"reward-optics", kind:"decal", value:"optics", label:"Robot Eyes", requirement:"Hit 2 Monday picks", progress:p(correctPicks,2) },
  { id:"reward-skull", kind:"decal", value:"skull", label:"Cartoon Skull", requirement:"Win by knockout", progress:p(koWins,1) },
  { id:"reward-bullseye", kind:"decal", value:"bullseye", label:"Bullseye", requirement:"Post a green Demo Close grade", progress:p(greenWeeks("demoClose"),1) },
  { id:"reward-plate", kind:"decal", value:"plate", label:"Armor Plate", requirement:"Post a green Conv % grade", progress:p(greenWeeks("conv"),1) },
  { id:"reward-gearhead", kind:"decal", value:"gearhead", label:"Gearhead Garage", requirement:"Post a green NSNU grade", progress:p(greenWeeks("nsnu"),1) },
  { id:"reward-brace", kind:"decal", value:"brace", label:"Bolt & Brace Co.", requirement:"Post a green Conv % grade", progress:p(greenWeeks("conv"),1) },
  { id:"reward-fuel", kind:"decal", value:"fuel", label:"Pit Fuel", requirement:"Post a green Demo Rate grade", progress:p(greenWeeks("demoRate"),1) },
  { id:"reward-tonic", kind:"decal", value:"tonic", label:"Torque Tonic", requirement:"Post a green Demo Close grade", progress:p(greenWeeks("demoClose"),1) },
  { id:"reward-archlabs", kind:"decal", value:"archlabs", label:"Arch Labs", requirement:"Post a green Arch Supports grade", progress:p(greenWeeks("arch"),1) },
  { id:"reward-turbo", kind:"decal", value:"turbo", label:"Ticket Turbo", requirement:"Post a green Demo Ticket grade", progress:p(greenWeeks("ticket"),1) },
  { id:"reward-foil", kind:"decal", value:"foil", label:"Holo foil stickers", requirement:"Post a perfect week with 6 greens, or buy foil for 4 Bolts", progress:p(perfectWeeks,1) },
  { id:"reward-led-nsnu", kind:"leds", value:"nsnu", label:"NSNU light strip", requirement:"Post 3 green NSNU grades", progress:p(greenWeeks("nsnu"),3) },
  { id:"reward-led-conv", kind:"leds", value:"conv", label:"Conv light strip", requirement:"Post 3 green Conv % grades", progress:p(greenWeeks("conv"),3) },
  { id:"reward-led-demo", kind:"leds", value:"demoRate", label:"Demo Rate light strip", requirement:"Post 3 green Demo Rate grades", progress:p(greenWeeks("demoRate"),3) },
  { id:"reward-led-close", kind:"leds", value:"demoClose", label:"Demo Close light strip", requirement:"Post 3 green Demo Close grades", progress:p(greenWeeks("demoClose"),3) },
  { id:"reward-led-arch", kind:"leds", value:"arch", label:"Arch light strip", requirement:"Post 3 green Arch Supports grades", progress:p(greenWeeks("arch"),3) },
  { id:"reward-led-ticket", kind:"leds", value:"ticket", label:"Ticket light strip", requirement:"Post 3 green Demo Ticket grades", progress:p(greenWeeks("ticket"),3) },
  { id:"reward-beacon", kind:"topper", value:"beacon", label:"Beacon", requirement:"Win 3 fights in a row", progress:p(bestWinStreak,3) },
  { id:"reward-dish", kind:"topper", value:"dish", label:"Satellite Dish", requirement:"Score 3 perfect Daily Sparks", progress:p(perfectSparks,3) },
  { id:"reward-flagpole", kind:"topper", value:"flagpole", label:"Flag Pole", requirement:"Hit 3 Monday picks in a row", progress:p(bestPickStreak,3) },
  { id:"reward-holo", kind:"finish", value:"holographic", label:"Holographic Finish", requirement:"Earn Full Tune-Ups in 3 weeks, or buy it for 14 Bolts", progress:p(tuneUps,3) },
  { id:"reward-smoke-black", kind:"smoke", value:"black", label:"Black Smoke", requirement:"Win by knockout", progress:p(koWins,1) },
  { id:"reward-banner", kind:"banner", value:"on", label:"Pit Banner", requirement:"Win a fight", progress:p(storeWins,1) },
];

export const HALLOWEEN_REWARD_IDS = ["reward-pumpkin", "reward-lantern-mask", "reward-hockey-mask", "reward-hockey-machete"] as const;

export const THANKSGIVING_REWARD_IDS = ["reward-turkey", "reward-pilgrim-hat", "reward-wishbone", "reward-harvest-wreath"] as const;

export const ELECTION_REWARD_IDS = ["reward-ivoted", "reward-ballot", "reward-capitol", "reward-tophat"] as const;

export const VETERANS_REWARD_IDS = ["reward-dogtags", "reward-yellowribbon", "reward-medal", "reward-bugle"] as const;

export const RECYCLES_REWARD_IDS = ["reward-recycle", "reward-bottlecap", "reward-sprout", "reward-tincan"] as const;

const FREE: Record<CosmeticKind, Set<string>> = {
  finish:new Set(["factory"]),
  decal:new Set(["none","roundel"]),
  trim:new Set(["steel","black","white"]),
  eye:new Set(["green","amber"]),
  paint:new Set(["amber","rust","bone","teal","crimson","gold","steel","mud","brass","olive","copper","cobalt","sky","lime","forest","violet","magenta","cherry","graphite"]),
  topper:new Set(["none", "janelle-pink", "janelle-red", "janelle-purple", "janelle-blue", "janelle-teal", "janelle-gold"]),
  body:new Set(),
  look:new Set(["plain","stripe","chevron","rivets"]),
  mask:new Set(["none"]),
  weaponSkin:new Set(["none"]),
  leds:new Set(["none",""]),
  smoke:new Set(["","none"]),
  banner:new Set([""]),
};

export function earnedRewardIds(data: PitData, storeId: string) {
  return new Set(COSMETIC_REWARDS.filter(r=>{const x=r.progress(data,storeId);return x.current>=x.target}).map(r=>r.id));
}
export function rewardFor(kind: CosmeticKind, value: string) {
  return COSMETIC_REWARDS.find(r=>r.kind===kind && r.value===value);
}
function lockerOwned(data: PitData, storeId: string, itemId: string) {
  return Boolean(data.stores.find((store) => store.id === storeId)?.unlocks?.includes(itemId));
}
function rewardHeld(data: PitData, storeId: string, rewardId: string, earned: Set<string>) {
  if (earned.has(rewardId)) return true;
  if (rewardId === "reward-foil" && lockerOwned(data, storeId, "sticker-foil")) return true;
  if (rewardId === "reward-holo" && lockerOwned(data, storeId, "finish-holographic")) return true;
  return false;
}
function bodyRewardValue(data:PitData,storeId:string,value:string) {
  const bot=data.bots.find(b=>b.storeId===storeId);
  if(!bot) return false;
  const meta=bodyStyle(value);
  if(!meta || meta.classId!==bot.classId) return false;
  if(meta.starter) return data.week > 1 || bot.style?.body === value;
  const ids=earnedRewardIds(data,storeId);
  if(["viper","fortress","phantom"].includes(value)) return ids.has("reward-elite-body");
  if(["warhawk","colossus","reaper"].includes(value)) return ids.has("reward-finalist-body");
  return false;
}
export function cosmeticUnlocked(data:PitData,storeId:string,kind:CosmeticKind,value:string) {
  if(kind==="body") return bodyRewardValue(data,storeId,value);
  if(kind==="banner") {
    if(!value) return true;
    if(!bannerVerdict(value).ok) return false;
    return earnedRewardIds(data,storeId).has("reward-banner");
  }
  if(kind==="decal" && value.endsWith("-foil")) {
    const base=value.slice(0,-5);
    if(!cosmeticUnlocked(data,storeId,"decal",base)) return false;
    const earned=earnedRewardIds(data,storeId);
    return rewardHeld(data,storeId,"reward-foil",earned);
  }
  if(FREE[kind].has(value)) return true;
  const earned=earnedRewardIds(data,storeId);
  const reward=rewardFor(kind,value);
  if(reward && rewardHeld(data,storeId,reward.id,earned)) return true;
  if(kind==="paint" && lockerOwned(data,storeId,`paint-${value}`)) return true;
  if(kind==="finish" && value==="holographic" && lockerOwned(data,storeId,"finish-holographic")) return true;
  if(kind==="smoke" && value && lockerOwned(data,storeId,`smoke-${value}`)) return true;
  return false;
}
export function cosmeticProgress(data:PitData,storeId:string) {
  const earned=earnedRewardIds(data,storeId);
  return COSMETIC_REWARDS.map(reward=>({reward,earned:rewardHeld(data,storeId,reward.id,earned),...reward.progress(data,storeId)}));
}
export { bannerVerdict };
export function eliteBodyFor(classId:string): BotBody {
  return classId==="tank" ? "fortress" : classId==="specialist" ? "phantom" : "viper";
}
export function finalistBodyFor(classId:string): BotBody {
  return classId==="tank" ? "colossus" : classId==="specialist" ? "reaper" : "warhawk";
}
export function validBodyForClass(value:string,classId:string) {
  const meta=BODY_STYLES.find(row=>row.id===value);
  return Boolean(meta && meta.classId===classId);
}
