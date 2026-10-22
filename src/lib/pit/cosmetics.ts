import { BODY_STYLES, bodyStyle } from "./catalog";
import { championshipFinalists } from "./engine";
import { sparkStreak, tunedUp } from "./week";
import type { BotBody, PitData } from "./types";

export type CosmeticKind = "finish" | "decal" | "trim" | "eye" | "paint" | "topper" | "body" | "look";
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
function finalist(data: PitData, storeId: string) {
  return championshipFinalists(data).includes(storeId) ? 1 : 0;
}
function champion(data: PitData, storeId: string) {
  return data.honors.pitBelt === storeId ? 1 : 0;
}
const p = (fn:(d:PitData,s:string)=>number,target:number) => (data:PitData,storeId:string) => ({current:fn(data,storeId),target});

export const COSMETIC_REWARDS: CosmeticReward[] = [
  { id:"reward-hazard", kind:"decal", value:"hazard", label:"Hazard Stripes", requirement:"Approve 2 Pit Week jobs", progress:p(approvedJobs,2) },
  { id:"reward-red-trim", kind:"trim", value:"red", label:"Red Trim", requirement:"Approve 5 Pit Week jobs", progress:p(approvedJobs,5) },
  { id:"reward-matte", kind:"finish", value:"matte", label:"Matte Finish", requirement:"Approve 10 Pit Week jobs", progress:p(approvedJobs,10) },
  { id:"reward-checker", kind:"decal", value:"checker", label:"Race Checks", requirement:"Approve 20 Pit Week jobs", progress:p(approvedJobs,20) },
  { id:"reward-antenna", kind:"topper", value:"antenna", label:"Whip Antenna", requirement:"Approve 30 Pit Week jobs", progress:p(approvedJobs,30) },
  { id:"reward-blue-eye", kind:"eye", value:"blue", label:"Blue Visor", requirement:"Score one perfect Daily Spark", progress:p(perfectSparks,1) },
  { id:"reward-lightning", kind:"decal", value:"lightning", label:"Lightning Decal", requirement:"Score 3 perfect Daily Sparks", progress:p(perfectSparks,3) },
  { id:"reward-mohawk", kind:"topper", value:"mohawk", label:"Steel Mohawk", requirement:"Reach a 5-perfect-Spark streak", progress:p(bestStreak,5) },
  { id:"reward-green-trim", kind:"trim", value:"green", label:"Green Trim", requirement:"Get 25 Spark answers right", progress:p(correctSparkAnswers,25) },
  { id:"reward-arch", kind:"decal", value:"arch", label:"Arch Badge", requirement:"Complete one Mystery Crate", progress:p(crates,1) },
  { id:"reward-satin", kind:"finish", value:"satin", label:"Satin Finish", requirement:"Complete 2 Mystery Crates", progress:p(crates,2) },
  { id:"reward-red-eye", kind:"eye", value:"red", label:"Red Visor", requirement:"Hit one Monday pick", progress:p(correctPicks,1) },
  { id:"reward-horns", kind:"topper", value:"horns", label:"Pit Horns", requirement:"Hit 3 Monday picks", progress:p(correctPicks,3) },
  { id:"reward-stars", kind:"decal", value:"stars", label:"Victory Stars", requirement:"Post 3 shout-outs", progress:p(shouts,3) },
  { id:"reward-teeth", kind:"decal", value:"teeth", label:"Shark Teeth", requirement:"Win by knockout", progress:p(koWins,1) },
  { id:"reward-worn", kind:"finish", value:"worn", label:"Battle-Worn Finish", requirement:"Win 2 fights", progress:p(wins,2) },
  { id:"reward-carbon", kind:"finish", value:"carbon", label:"Carbon Finish", requirement:"Win 3 fights", progress:p(wins,3) },
  { id:"reward-full-tune", kind:"finish", value:"chrome", label:"Chrome Finish", requirement:"Earn one Full Tune-Up", progress:p(tuneUps,1) },
  { id:"reward-elite-body", kind:"body", value:"elite", label:"Elite Body Shell", requirement:"Earn one Full Tune-Up", progress:p(tuneUps,1) },
  { id:"reward-iridescent", kind:"finish", value:"iridescent", label:"Iridescent Finish", requirement:"Earn 2 Full Tune-Ups", progress:p(tuneUps,2) },
  { id:"reward-finalist-body", kind:"body", value:"finalist", label:"Conference Champion Body", requirement:"Reach Championship Saturday", progress:p(finalist,1) },
  { id:"reward-gold-trim", kind:"trim", value:"gold", label:"Gold Trim", requirement:"Reach Championship Saturday", progress:p(finalist,1) },
  { id:"reward-crown", kind:"topper", value:"crown", label:"Champion Crown", requirement:"Win the Waterman Championship", progress:p(champion,1) },
  { id:"reward-champion-finish", kind:"finish", value:"gold", label:"Champion Gold Finish", requirement:"Win the Waterman Championship", progress:p(champion,1) },
  { id:"reward-champion-decal", kind:"decal", value:"champion", label:"Champion Crest", requirement:"Win the Waterman Championship", progress:p(champion,1) },
];

const FREE: Record<CosmeticKind, Set<string>> = {
  finish:new Set(["factory"]),
  decal:new Set(["none"]),
  trim:new Set(["steel","black","white"]),
  eye:new Set(["green","amber"]),
  paint:new Set(["amber","rust","bone","teal","crimson","gold","steel","mud","brass","olive","copper"]),
  topper:new Set(["none"]),
  body:new Set(),
  look:new Set(["plain","stripe"]),
};

export function earnedRewardIds(data: PitData, storeId: string) {
  return new Set(COSMETIC_REWARDS.filter(r=>{const x=r.progress(data,storeId);return x.current>=x.target}).map(r=>r.id));
}
export function rewardFor(kind: CosmeticKind, value: string) {
  return COSMETIC_REWARDS.find(r=>r.kind===kind && r.value===value);
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
  if(FREE[kind].has(value)) return true;
  const reward=rewardFor(kind,value);
  if(reward && earnedRewardIds(data,storeId).has(reward.id)) return true;
  const store=data.stores.find(s=>s.id===storeId);
  if(kind==="paint" && store?.unlocks?.includes(`paint-${value}`)) return true;
  return false;
}
export function cosmeticProgress(data:PitData,storeId:string) {
  const earned=earnedRewardIds(data,storeId);
  return COSMETIC_REWARDS.map(reward=>({reward,earned:earned.has(reward.id),...reward.progress(data,storeId)}));
}
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
