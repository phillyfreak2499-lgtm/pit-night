import {buildGauntletTape} from "./showcase-gauntlet";
import { SHOWCASE_EVENTS } from './showcase-model';
import type { ShowcaseEventId, ShowcaseFrame, ShowcaseRun, ShowcaseTeam, ShowcaseTape, ShowcaseObstacle } from './showcase-model';
import type { FighterSnap } from './types';

type Role = 'scout'|'puller'|'carrier'|'operator';
const roles:Role[]=['scout','puller','carrier','operator'];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function hash(s:string) { let h=2166136261; for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
function roleValue(f:FighterSnap,r:Role) { const s=f.stats; return r==='scout'?s.speed*2+s.heat:r==='puller'?s.power*2+s.armor:r==='carrier'?s.speed+s.power+s.armor:s.heat*2+s.speed; }
export function buildShowcaseTeams(fighters:FighterSnap[],seed:string):ShowcaseTeam[] {
 if(fighters.length!==12 || new Set(fighters.map(f=>f.id)).size!==12) throw new Error('Showcase requires twelve distinct fighters');
 const teams:ShowcaseTeam[]=Array.from({length:3},(_,i)=>({id:`crew-${i+1}`,name:`Crew ${i+1}`,storeIds:[],roles:{}}));
 // Deal each class to the currently least represented crew, preserving four places.
 for(const cls of ['striker','tank','specialist'] as const){
  const group=fighters.filter(f=>f.classId===cls).sort((a,b)=>hash(seed+a.id)-hash(seed+b.id));
  for(const f of group){
   const choices=teams.filter(t=>t.storeIds.length<4).sort((a,b)=>{
    const count=(t:ShowcaseTeam)=>t.storeIds.filter(id=>fighters.find(x=>x.id===id)?.classId===cls).length;
    return count(a)-count(b)||a.storeIds.length-b.storeIds.length||hash(seed+a.id)-hash(seed+b.id);
   }); choices[0]!.storeIds.push(f.id);
  }
 }
 for(const t of teams){
  let best=-Infinity, assignment:Record<string,Role>={};
  const members=t.storeIds.map(id=>fighters.find(f=>f.id===id)!);
  function assign(i:number,remaining:Role[],result:Record<string,Role>,score:number){
   if(i===4){if(score>best){best=score;assignment={...result};}return;}
   const f=members[i]!; for(const role of remaining){
    const preference=(role==='scout'&&f.classId==='striker')||(role==='puller'&&f.classId==='tank')||((role==='carrier'||role==='operator')&&f.classId==='specialist')?25:0;
    result[f.id]=role; assign(i+1,remaining.filter(r=>r!==role),result,score+preference+roleValue(f,role));
   }
  } assign(0,roles,{},0); t.roles=assignment;
 }
 return teams;
}
const frame=(at:number,x:number,y:number,progress:number,cargo=0,stage=0,carrying=false):ShowcaseFrame=>({at,x:clamp(x),y:clamp(y),hp:100,progress:clamp(progress),cargo,stage,carrying});
const blank=(f:FighterSnap,frames:ShowcaseFrame[],score:number,distance:number,finishAt:number|null,teamId?:string):ShowcaseRun=>({storeId:f.id,teamId,rank:0,score,distance,finishAt,frames});
export function simulateShowcaseEvent(fighters:FighterSnap[],eventId:ShowcaseEventId,teams:ShowcaseTeam[],seed:string):ShowcaseTape {
 const meta=SHOWCASE_EVENTS.find(e=>e.id===eventId); if(!meta) throw new Error('Unknown showcase event');
 if(eventId==='team-gauntlet')return buildGauntletTape(fighters,teams,seed);
 const field=meta.classId?fighters.filter(f=>f.classId===meta.classId):fighters.slice();
 const objects:ShowcaseObstacle[]=[]; let stages:string[]=[]; let runs:ShowcaseRun[]=[]; let duration=0; let tieBreak:ShowcaseTape['tieBreak']; let winnerIds:string[]=[];
 if(eventId==='striker-race'){
  stages=['Lap 1','Lap 2','Final lap','Finished'];
  runs=field.map((f,i)=>{ const frames:ShowcaseFrame[]=[]; const speed=Math.max(8, f.stats.speed); const finish= Math.ceil(1500/(20+speed*.65));
   for(let at=0;at<=finish;at++){const p=Math.min(1,at/finish),angle=p*Math.PI*6-Math.PI/2;frames.push(frame(at,.5+Math.cos(angle)*(.32+i*.008),.5+Math.sin(angle)*(.22+(field.length===1?0:i/(field.length-1))*.18),p,0,p===1?3:Math.floor(p*3)));}
   return blank(f,frames,finish,1500,finish);
  });
  runs.sort((a,b)=>a.score-b.score); if(runs.length) winnerIds=runs.filter(r=>r.score===runs[0]!.score).map(r=>r.storeId);
 } else if(eventId==='tank-pull'){
  stages=['Ready','Pulling','Stalled','Full pull']; objects.push({id:'pull-lane',kind:'checkpoint',x:.12,y:.5,w:.76,h:.08});
  runs=field.map((f,i)=>{ const frames:ShowcaseFrame[]=[]; const start=i*Math.min(36,Math.floor(84/Math.max(1,field.length-1))); let dist=0, fatigue=0, stalled=0, end=start;
   const power=Math.max(0,f.stats.power),armor=Math.max(0,f.stats.armor),heat=Math.max(0,f.stats.heat);
   for(let at=0;at<=start+35;at++){
    if(at>=start&&stalled<3&&dist<100){ const traction=(power*.075+armor*.035+1.4)-dist*.065-fatigue; const gain=Math.max(0,traction); dist=Math.min(100,dist+gain); fatigue=Math.max(0,fatigue+.045-heat*.0006); stalled=gain<.15?stalled+1:0; end=at; }
    frames.push(frame(at,.12+.76*dist/100,.5,dist/100,0,at<start?0:dist>=100?3:stalled>=3||at===start+35?2:1));
   } return blank(f,frames,Math.round(dist*100)/100,Math.round(dist*100)/100,end);
  }); runs.sort((a,b)=>b.score-a.score); if(runs.length) winnerIds=runs.filter(r=>r.score===runs[0]!.score).map(r=>r.storeId);
 } else if(eventId==='specialist-rescue'){
  stages=['Collect','Return','Gate','Finished']; const windows=Array.from({length:20},(_,i)=>({from:i*6,to:i*6+3}));
  objects.push({id:'rescue-gate',kind:'gate',x:.5,y:.5,w:.025,h:.65,openWindows:windows},{id:'rescue-base',kind:'reactor',x:.12,y:.5,w:.07,h:.12},{id:'rescue-core',kind:'core',x:.86,y:.5,w:.04,h:.06});
  runs=field.map((f,i)=>{const frames:ShowcaseFrame[]=[];let x=.12, cargo=0, carrying=false,finish:number|null=null; const y=.28+(i%6)*.085;
   const v=Math.min(.065,.025+Math.max(0,f.stats.speed)*.00045+Math.max(0,f.stats.heat)*.00015);
   for(let at=0;at<=120;at++){
    let waiting=false;
    if(finish===null){let next=x+(carrying?-v:v); const crossing=carrying?x>.5&&next<=.5:x<.5&&next>=.5; const open=windows.some(w=>at>=w.from&&at<w.to);
     if(crossing&&!open){next=carrying?.501:.499;waiting=true;}
     x=clamp(next);if(!carrying&&x>=.86){x=.86;carrying=true;} else if(carrying&&x<=.12){x=.12;carrying=false;cargo++;if(cargo===3)finish=at;}
    }
    const leg=carrying?1+( .86-x)/.74:(x-.12)/.74; const p=(cargo+clamp(leg/2))/3;
    frames.push(frame(at,x,y,finish!==null?1:p,cargo,finish!==null?3:waiting?2:carrying?1:0,carrying)); if(finish!==null)break;
   } const last=frames.at(-1)!; return blank(f,frames,finish??(120+(1-last.progress)*100),last.progress*3,finish);
  });
  runs.sort((a,b)=>{const af=a.frames.at(-1)!,bf=b.frames.at(-1)!;return bf.cargo-af.cargo||(a.finishAt??Infinity)-(b.finishAt??Infinity)||bf.progress-af.progress;});
  if(runs.length){const first=runs[0]!;const last=first.frames.at(-1)!;winnerIds=runs.filter(r=>{const f=r.frames.at(-1)!;return f.cargo===last.cargo&&r.finishAt===first.finishAt&&f.progress===last.progress;}).map(r=>r.storeId);}
 }
 runs.forEach((r,i)=>{ const previous=runs[i-1]; const tied=previous && (eventId==='specialist-rescue' ? previous.frames.at(-1)!.cargo===r.frames.at(-1)!.cargo && previous.finishAt===r.finishAt && previous.frames.at(-1)!.progress===r.frames.at(-1)!.progress : previous.score===r.score); r.rank=tied?previous!.rank:i+1; });
 duration=Math.max(0,...runs.map(r=>r.frames.at(-1)?.at??0));
 return {eventId,title:meta.title,seed,duration,fighters:field,runs,winnerIds,teams:undefined,prize:meta.prize,course:{objects,stages},tieBreak};
}



