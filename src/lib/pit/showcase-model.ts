import {buildGauntletTape} from "./showcase-gauntlet";
import { championshipFinalists, regularSeasonComplete } from "./engine";
import { central } from "./time";
import type { Bot, ClassId, FighterSnap, PitData, Store, StoreCard } from "./types";

export type ShowcaseEventId = "striker-race" | "tank-pull" | "specialist-rescue" | "team-gauntlet";
export type ShowcasePrizeId = "rocket-tail" | "battle-tank" | "tesla-rig";
export const SHOWCASE_LOCK_AT = central(2026, 11, 21, 18).getTime();
export const SHOWCASE_WATCH_AT = central(2026, 11, 24).getTime();
export const SHOWCASE_LOCK_LABEL = "Saturday, Nov 21, 6:00 PM CT";
export const SHOWCASE_WATCH_LABEL = "Tuesday, Nov 24";

export type ShowcaseEventMeta = { id: ShowcaseEventId; title: string; description: string; classId?: ClassId; prize?: ShowcasePrizeId };
export const SHOWCASE_EVENTS: readonly ShowcaseEventMeta[] = [
  { id: "striker-race", title: "Striker Stakes", classId: "striker", prize: "rocket-tail", description: "Strikers race three laps around the oval. First across the line wins the Rocket Tail and +2 Rumble Speed while equipped." },
  { id: "tank-pull", title: "Iron Pull", classId: "tank", prize: "battle-tank", description: "Tanks haul a weighted sled. The longest pull wins the full Battle Tank skin and +2 Rumble Armor while equipped." },
  { id: "specialist-rescue", title: "Reactor Rescue", classId: "specialist", prize: "tesla-rig", description: "Specialists recover three energy cores through cycling gates. The fastest rescue wins the Tesla Rig and +2 Rumble Heat while equipped." },
  { id: "team-gauntlet", title: "Team Gauntlet", description: "Three crews of four scout, pull a barrier, return three cores, then power the exit and cross together. Fastest completed crew wins Rumble slots 9–12; at the 120-second cutoff, furthest progress wins, with an exact tie settled by the recorded seeded draw." },
];

export type ShowcaseFrame = { at: number; x: number; y: number; hp: number; progress: number; cargo: number; stage: number; carrying?: boolean };
export type ShowcaseRun = { storeId: string; teamId?: string; rank: number; score: number; distance: number; finishAt: number | null; frames: ShowcaseFrame[] };
export type ShowcaseTeam = { id: string; name: string; storeIds: string[]; roles?: Record<string,"scout"|"puller"|"carrier"|"operator"> };
export type ShowcaseObstacle = { id: string; kind: "gate"|"barrier"|"core"|"reactor"|"ramp"|"pit"|"checkpoint"; x:number; y:number; w:number; h:number; teamId?:string; openWindows?:{from:number;to:number}[]; label?:string };
export type ShowcaseCourse = { objects: ShowcaseObstacle[]; stages: string[] };
export type GauntletRole="scout"|"puller"|"carrier"|"operator";
export type GauntletCrewFrame={at:number;stage:number;phaseWork:number;progress:number;activeRole:GauntletRole|null;checkpoints:number;coresDelivered:number;finished:boolean;scoutProgress?:number;barrierX?:number;barrierY?:number;gatePower?:number;gateOpen?:boolean};
export type GauntletRecording={version:2;pace:number;nativeBestFinish:number;crews:{teamId:string;pace:number;frames:GauntletCrewFrame[]}[];leaders:{at:number;teamIds:string[]}[]};
export type ShowcaseTape = { eventId: ShowcaseEventId; title:string; seed:string; duration:number; fighters:FighterSnap[]; runs:ShowcaseRun[]; winnerIds:string[]; teams?:ShowcaseTeam[]; gauntlet?:GauntletRecording; prize?:ShowcasePrizeId; course:ShowcaseCourse; tieBreak?:{kind:"draw";contenders:string[];winnerId:string} };
export type ShowcaseEventState = { startedAt:number|null; revealedAt:number|null; tape:ShowcaseTape|null };
export type ShowcaseState = { field:string[]; teams:ShowcaseTeam[]; createdAt:number; lockedAt?:number; frozenBots?:Bot[]; frozenStores?:Pick<Store,'id'|'name'|'teamName'|'paint'>[]; cards?:StoreCard[]; preparedAt?:number; events:Partial<Record<ShowcaseEventId,ShowcaseEventState>>; entryOrder?:string[] };

export function showcaseField(data: PitData): string[] {
  if (!regularSeasonComplete(data)) return [];
  const finalists = championshipFinalists(data);
  if (finalists.length !== 2) return [];
  return data.stores.filter(s=>!finalists.includes(s.id)).map(s=>s.id);
}

/** A deliberately fictional house exhibition, never a forecast of league events. */
export function showcaseDemo(eventId: ShowcaseEventId): ShowcaseTape {
  const meta=SHOWCASE_EVENTS.find(e=>e.id===eventId)!;
  const classes:ClassId[]=["striker","striker","striker","tank","tank","tank","specialist","specialist","specialist","specialist","specialist","specialist"];
  const all:FighterSnap[]=classes.map((classId,i)=>({id:`house-${i+1}`,name:`House ${i+1}`,storeName:`House ${i+1}`,botName:["COMET","DASH","BLAZE","BULLDOZER","IRONCLAD","MULE","CIRCUIT","NOVA","SPARK","ORBIT","PULSE","VECTOR"][i]!,classId,paint:["amber","red","blue","mint"][i%4]!,stats:{power:30+i%4,speed:30+(i*3)%7,armor:30+(i*5)%6,heat:30+i%5},rating:120,fit:1,weekQ:0.5,weaponFamily:classId==="tank"?"hammer":classId==="specialist"?"claw":"saw",weaponName:"House tool",driveName:"House drive",armorName:"House plate",utilityName:null,chassisName:"House shell",look:"stripe",number:String(i+1)}));
  const fighters=meta.classId?all.filter(f=>f.classId===meta.classId):all;
  const teams:ShowcaseTeam[]=[0,1,2].map(i=>({id:`house-crew-${i+1}`,name:`House crew ${i+1}`,storeIds:[all[i]!.id,all[i+3]!.id,all[6+i*2]!.id,all[7+i*2]!.id]}));
  for(const team of teams) team.roles=Object.fromEntries(team.storeIds.map((id,i)=>[id,(['scout','puller','carrier','operator'] as const)[i]!]));
  if(eventId==="team-gauntlet") {
    const fictional=all.map((f,i)=>({...f,stats:{power:55+i%3*4,speed:55+i%3*4,armor:55+i%3*4,heat:55+i%3*4}}));
    return {...buildGauntletTape(fictional,teams,"house-exhibition:team-gauntlet"),title:"House exhibition · Team Gauntlet"};
  }
  const duration=eventId==="tank-pull"?45:60;
  const stages=eventId==="striker-race"?["Lap 1","Lap 2","Final lap","Finished"]:eventId==="tank-pull"?["Ready","Pulling","Stalled","Full pull"]:eventId==="specialist-rescue"?["Collect","Return","Gate","Finished"]:["Scout","Clear","Recover","Exit"];
  const runs:ShowcaseRun[]=fighters.map((f,i)=>{
    const frames:ShowcaseFrame[]=[];
    const finish=duration-8+i*2;
    for(let at=0;at<=duration;at++){
      const p=Math.min(1,at/finish);let x=.12+p*.76,y=.3+(i%3)*.2;
      if(eventId==="striker-race"){x=.5+Math.cos(p*Math.PI*6-Math.PI/2)*(.33+i*.012);y=.5+Math.sin(p*Math.PI*6-Math.PI/2)*(.22+(fighters.length===1?0:i/(fighters.length-1))*.18);}
      if(eventId==="specialist-rescue"){const leg=(p*6)%2;x=.15+(leg<=1?leg:2-leg)*.7;y=.18+(fighters.length===1?0:i/(fighters.length-1))*.64;}
      frames.push({at,x,y,hp:100,progress:p,cargo:eventId==="specialist-rescue"?Math.min(3,Math.floor(p*3)):0,carrying:eventId==="specialist-rescue"&&p<1&&((p*6)%2)>=1,stage:Math.min(3,Math.floor(p*4))});
    }
    return {storeId:f.id,teamId:undefined,rank:i+1,score:eventId==="tank-pull"?95-i*7:finish,distance:100,finishAt:finish,frames};
  });
  return {eventId,title:`House exhibition · ${meta.title}`,seed:`house-exhibition:${eventId}`,duration,fighters,runs,winnerIds:[fighters[0]!.id],teams:undefined,prize:meta.prize,course:{stages,objects:[{id:"gate-1",kind:"gate",x:.4,y:.35,w:.04,h:.3,openWindows:[{from:8,to:18},{from:28,to:38},{from:48,to:60}]},{id:"reactor",kind:"reactor",x:.12,y:.5,w:.08,h:.1},{id:"core",kind:"core",x:.82,y:.5,w:.04,h:.06}]}};
}
