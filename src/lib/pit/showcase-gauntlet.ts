import type {FighterSnap} from './types';
import type {GauntletRole,GauntletCrewFrame,ShowcaseFrame,ShowcaseRun,ShowcaseTeam,ShowcaseTape,ShowcaseObstacle} from './showcase-model';

export const GAUNTLET_ROLES:GauntletRole[]=['scout','puller','carrier','operator'];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function roleValue(f:FighterSnap,r:GauntletRole){const s=f.stats;return r==='scout'?s.speed*2+s.heat:r==='puller'?s.power*2+s.armor:r==='carrier'?s.speed+s.power+s.armor:s.heat*2+s.speed;}

/** Nonsecret Showcase course only. Team allocation and season access stay on the server. */
export function buildGauntletTape(fighters:FighterSnap[],teams:ShowcaseTeam[],baseSeed:string):ShowcaseTape {
  const runs:ShowcaseRun[]=[],objects:ShowcaseObstacle[]=[],crews:{teamId:string;pace:number;frames:GauntletCrewFrame[]}[]=[];
  const summaries:{team:ShowcaseTeam;finish:number|null;progress:number;runs:ShowcaseRun[]}[]=[];
  let tieBreak:ShowcaseTape['tieBreak'];let winnerIds:string[]=[];
  const nominalSteps=teams.flatMap(team=>{
    const members=team.storeIds.map(id=>fighters.find(f=>f.id===id)).filter((f):f is FighterSnap=>!!f);if(members.length!==4)return [];
    const byRole=GAUNTLET_ROLES.map((role,i)=>members.find(f=>team.roles?.[f.id]===role)??members[i]!);
    const steps=GAUNTLET_ROLES.map((role,i)=>{const rate=i===3?(members.reduce((sum,f)=>sum+f.stats.speed,0)/4+roleValue(byRole[3]!,'operator')/3)/2:roleValue(byRole[i]!,role)/3;return Math.ceil(1/Math.max(.006,.010+rate*.00048));});
    return [steps.reduce((sum,n)=>sum+n,0)];
  });
  const bestSteps=nominalSteps.length?Math.min(...nominalSteps):0;
  // One shared course pace only when the native field cannot demonstrate a finish.
  const pace=bestSteps-1>120?bestSteps/109:1;
  for(let ti=0;ti<teams.length;ti++){
    const team=teams[ti]!,members=team.storeIds.map(id=>fighters.find(f=>f.id===id)).filter((f):f is FighterSnap=>!!f);if(members.length!==4)continue;
    const assigned=team.roles??{},byRole=GAUNTLET_ROLES.map((r,i)=>members.find(f=>assigned[f.id]===r)??members[i]!);
    const lane=.18+ti*.32,pullSide=members.indexOf(byRole[1]!)<2?.10:-.10;
    const row=(fighter:FighterSnap)=>lane+(members.indexOf(fighter)-1.5)*.08;
    const pullRow=row(byRole[1]!),parkRow=lane+pullSide;
    const barrierAt=(w:number)=>({barrierX:.4-.18*clamp(w/.5),barrierY:pullRow+(parkRow-pullRow)*clamp((w-.5)/.15),barrierWidth:30,barrierHeight:28});
    const pullPhaseX=(w:number,role:number)=>role===1?(w<=.5?.30-.18*clamp(w/.5):w<=.65?.12:.12+.34*clamp((w-.65)/.35)):.30+.16*clamp((w-.65)/.35);
    const frames:GauntletCrewFrame[]=[],teamRuns=members.map(f=>({storeId:f.id,teamId:team.id,rank:0,score:0,distance:0,finishAt:null,frames:[]} as ShowcaseRun));
    let phase=0,work=0,finish:number|null=null;
    for(let at=0;at<=120;at++){
      // Original role-stat weights and checkpoint resets; one field-wide pace multiplies every crew.
      if(finish===null){const active=byRole[Math.min(phase,3)]!;const rate=phase===3?(members.reduce((sum,f)=>sum+f.stats.speed,0)/4+roleValue(active,'operator')/3)/2:roleValue(active,GAUNTLET_ROLES[phase]!)/3;
        work+=Math.max(.006,.010+rate*.00048)*pace;if(work>=1){phase++;work=0;if(phase===4)finish=at;}}
      const progress=finish!==null?1:(phase+work)/4,stage=Math.min(3,phase),delivered=phase>=3?3:phase===2?Math.floor(work*3):0;
      const gateOpen=finish!==null||(phase===3&&work>=.5);
      const barrier=barrierAt(phase>1?1:phase===1?work:0);
      frames.push({at,stage,phaseWork:work,progress,activeRole:finish!==null||gateOpen?null:GAUNTLET_ROLES[stage]!,checkpoints:finish!==null?4:phase,coresDelivered:delivered,finished:finish!==null,
        scoutProgress:phase>0?1:clamp(work/.6),...barrier,
        gatePower:phase>3?1:phase===3?clamp((work-.25)/.25):0,gateOpen});
      for(let j=0;j<members.length;j++){
        const member=members[j]!,role=GAUNTLET_ROLES.indexOf((assigned[member.id]??GAUNTLET_ROLES[j]) as GauntletRole);
        let x=.16,carrying=false;
        if(finish!==null)x=.88;
        else if(phase===0)x=.16+.14*clamp(role===0?work/.6:(work-.6)/.4);
        else if(phase===1)x=pullPhaseX(work,role);
        else if(phase===2){x=.46;if(role===2){const cycle=(work*3)%1;x+=.20*(cycle<.5?cycle*2:2-cycle*2);carrying=cycle>=.5;}}
        else {const convoy=clamp((work-.5)/.5);x=role===3?.46+.26*clamp(work/.25)+.16*convoy:.46+.42*convoy;}
        teamRuns[j]!.frames.push({at,x,y:lane+(j-1.5)*.08,hp:100,progress,cargo:delivered,stage,carrying});
      }
      if(finish!==null)break;
    }
    // Record the tow/shift/return corners explicitly so interpolation cannot cut across them.
    const phaseFrames=frames.slice();
    for(let i=1;i<phaseFrames.length;i++){
      const a=phaseFrames[i-1]!,b=phaseFrames[i]!;if(a.stage!==1||b.stage!==1)continue;
      for(const work of [.5,.65])if(a.phaseWork<work&&b.phaseWork>work){
        const fraction=(work-a.phaseWork)/(b.phaseWork-a.phaseWork),at=a.at+(b.at-a.at)*fraction;
        frames.push({...a,at,phaseWork:work,progress:a.progress+(b.progress-a.progress)*fraction,...barrierAt(work)});
        for(let j=0;j<members.length;j++){
          const run=teamRuns[j]!,member=members[j]!,role=GAUNTLET_ROLES.indexOf((assigned[member.id]??GAUNTLET_ROLES[j]) as GauntletRole),pose=poseAt(run.frames,at,false)!;
          run.frames.push({...pose,at,x:pullPhaseX(work,role)});run.frames.sort((a,b)=>a.at-b.at);
        }
      }
    }
    frames.sort((a,b)=>a.at-b.at);
    // Path turns occur at the recorded delivery ticks, with explicit pickup poses
    // between ticks so interpolation cannot skip the depot or a recovered core.
    const carrierId=byRole[2]!.id,carrier=teamRuns.find(r=>r.storeId===carrierId)!;
    const recoveryStart=frames.find(f=>f.stage===2)?.at;
    if(recoveryStart!==undefined){
      const boundaries=[recoveryStart,...frames.filter((f,i)=>i>0&&f.coresDelivered>frames[i-1]!.coresDelivered).map(f=>f.at)];
      const recordedEnd=frames.at(-1)!;
      if(recordedEnd.stage===2){
        const rate=roleValue(byRole[2]!,'carrier')/3,increment=Math.max(.006,.010+rate*.00048)*pace;
        let futureWork=recordedEnd.phaseWork,futureAt=recordedEnd.at;
        while(Math.floor(futureWork*3)<=recordedEnd.coresDelivered&&futureWork<1){futureWork+=increment;futureAt++;}
        boundaries.push(futureAt);
      }
      const end=boundaries.at(-1)!;
      const interval=(at:number)=>{let i=0;while(i<boundaries.length-2&&at>=boundaries[i+1]!)i++;return i;};
      for(const pose of carrier.frames)if(pose.at>=recoveryStart&&pose.at<=end&&boundaries.length>1){const i=interval(pose.at),t=clamp((pose.at-boundaries[i]!)/(boundaries[i+1]!-boundaries[i]!));pose.x=.46+.20*(t<=.5?t*2:2-t*2);pose.carrying=t>=.5&&t<1;}
      for(let i=0;i<boundaries.length-1;i++){const at=(boundaries[i]!+boundaries[i+1]!)/2;if(at>recordedEnd.at)continue;
        const existing=carrier.frames.find(f=>f.at===at);if(existing){existing.x=.66;existing.carrying=true;}
        else {const prior=lastAt(carrier.frames,at)!;carrier.frames.push({...prior,at,x:.66,carrying:true,cargo:i});carrier.frames.sort((a,b)=>a.at-b.at);}}
    }
    crews.push({teamId:team.id,pace,frames});
    for(const [id,kind,x,label] of [['scout','checkpoint',.28,'1 SCOUT'],['barrier','barrier',.4,'2 PULL'],['depot','reactor',.46,'CORE HOME'],['core','core',.66,'3 CORES'],['gate','gate',.76,'4 EXIT'],['control','checkpoint',.76,undefined],['finish','checkpoint',.85,'FINISH']] as const)
      objects.push({id:`${team.id}:${id}`,teamId:team.id,kind,x,
        y:id==='core'||id==='depot'?row(byRole[2]!):id==='scout'?row(byRole[0]!):id==='barrier'?pullRow:id==='control'?row(byRole[3]!):lane,
        w:id==='barrier'?.03:id==='control'?.018:.025,h:id==='barrier'?28/560:id==='control'?34/560:.12,label});
    const progress=frames.at(-1)!.progress;
    for(const run of teamRuns){run.finishAt=finish;run.score=finish??120+(1-progress)*100;run.distance=progress*100;}
    summaries.push({team,finish,progress,runs:teamRuns});
  }
  summaries.sort((a,b)=>(a.finish??Infinity)-(b.finish??Infinity)||b.progress-a.progress);
  if(summaries.length){const best=summaries[0]!,tied=summaries.filter(s=>s.finish===best.finish&&s.progress===best.progress);let winner=best;
    if(tied.length>1){const contenders=tied.map(s=>s.team.id).sort(),id=contenders[hash(baseSeed+':gauntlet-draw')%contenders.length]!;winner=tied.find(s=>s.team.id===id)!;tieBreak={kind:'draw',contenders,winnerId:id};}
    winnerIds=winner.team.storeIds.slice();
  }
  let previousRank=1;const winner=summaries.find(s=>s.team.storeIds.every(id=>winnerIds.includes(id))),ordered=winner?[winner,...summaries.filter(s=>s!==winner)]:summaries;
  ordered.forEach((s,i)=>{const prior=ordered[i-1],tied=i>1&&prior&&s.finish===prior.finish&&s.progress===prior.progress;const rank=tied?previousRank:i+1;previousRank=rank;s.runs.forEach(r=>{r.rank=rank;runs.push(r);});});
  const duration=Math.max(0,...runs.map(r=>r.frames.at(-1)?.at??0)),leaders=[];
  for(let at=0;at<=duration;at++)leaders.push({at,teamIds:currentLeaders(crews.map(c=>({id:c.teamId,frame:lastAt(c.frames,at)!,finish:summaries.find(s=>s.team.id===c.teamId)!.finish})),at)});
  return {eventId:'team-gauntlet',title:'Team Gauntlet',seed:baseSeed+'|gauntlet-course-v2',duration,fighters:fighters.slice(),runs,winnerIds,teams,course:{objects,stages:['Scout route','Move barrier','Recover cores','Power exit / convoy']},tieBreak,gauntlet:{version:2,pace,nativeBestFinish:Math.max(0,bestSteps-1),crews,leaders}};
}

function lastAt<T extends {at:number}>(frames:T[],at:number):T|undefined {let result=frames[0];for(const f of frames){if(f.at>at)break;result=f;}return result;}
function currentLeaders(crews:{id:string;frame:GauntletCrewFrame;finish:number|null}[],at:number){
  const completed=crews.filter(c=>c.finish!==null&&c.finish<=at);
  if(completed.length){const best=Math.min(...completed.map(c=>c.finish!));return completed.filter(c=>c.finish===best).map(c=>c.id);}
  const best=Math.max(...crews.map(c=>c.frame.progress));return crews.filter(c=>c.frame.progress===best).map(c=>c.id);
}
function poseAt(frames:ShowcaseFrame[],at:number,reduced:boolean){const a=lastAt(frames,at);if(!a)return undefined;const b=frames[frames.indexOf(a)+1];if(reduced||!b)return a;const t=clamp((at-a.at)/(b.at-a.at));return {...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
export type GauntletCrewView={team:ShowcaseTeam;frame:GauntletCrewFrame;legacy:boolean;members:{fighter:FighterSnap;run:ShowcaseRun;frame:ShowcaseFrame}[]};
/** Reads recorded states only; historical tapes receive no synthetic course actions. */
export function gauntletAt(tape:ShowcaseTape,at:number,reduced=false):{crews:GauntletCrewView[];leaderIds:string[]} {
  const crews=(tape.teams??[]).map(team=>{
    const members=team.storeIds.flatMap(id=>{const fighter=tape.fighters.find(f=>f.id===id),run=tape.runs.find(r=>r.storeId===id),frame=run&&poseAt(run.frames,at,reduced);return fighter&&run&&frame?[{fighter,run,frame}]:[];});
    const record=tape.gauntlet?.crews.find(c=>c.teamId===team.id),a=record&&lastAt(record.frames,at);
    if(a){const b=record!.frames[record!.frames.indexOf(a)+1],t=!reduced&&b?clamp((at-a.at)/(b.at-a.at)):0;
      const frame={...a};if(b&&a.barrierX!==undefined&&b.barrierX!==undefined){frame.barrierX=a.barrierX+(b.barrierX-a.barrierX)*t;frame.barrierY=a.barrierY!+(b.barrierY!-a.barrierY!)*t;}
      return {team,members,frame,legacy:false};}
    const f=members[0]?.frame,stage=f?.stage??0,finished=members.length>0&&members.every(m=>m.run.finishAt!==null&&m.run.finishAt<=at);
    return {team,members,legacy:true,frame:{at,stage,phaseWork:0,progress:f?.progress??0,activeRole:finished?null:GAUNTLET_ROLES[Math.min(3,stage)]!,checkpoints:finished?4:stage,coresDelivered:Math.max(0,...members.map(m=>m.frame.cargo)),finished}};
  });
  const saved=tape.gauntlet&&lastAt(tape.gauntlet.leaders,at);
  return {crews,leaderIds:saved?.teamIds??currentLeaders(crews.map(c=>({id:c.team.id,frame:c.frame,finish:c.members[0]?.run.finishAt??null})),at)};
}
export function gauntletTask(crew:GauntletCrewView):string {
  const f=crew.frame;if(crew.legacy)return f.finished?'Recorded finish':`Recorded checkpoint ${f.stage+1}`;
  if(f.finished)return 'Crew finished';
  return f.stage===0?'Scout revealing route':f.stage===1?'Puller clearing barrier':f.stage===2?`Carrier returning core ${Math.min(3,f.coresDelivered+1)} of 3`:f.gateOpen?'Whole crew crossing finish':'Operator powering exit';
}

/** Recorded SVG drawing units; old metadata keeps its original30x60 barrier. */
export function gauntletBarrierSize(frame:GauntletCrewFrame){return {width:frame.barrierWidth??30,height:frame.barrierHeight??60,stroke:3};}
