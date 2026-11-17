import {BotPortrait} from './bot-portrait';
import {gauntletAt,gauntletTask,gauntletBarrierSize,type GauntletCrewView} from '@/lib/pit/showcase-gauntlet';
import type {ShowcaseTape} from '@/lib/pit/showcase-model';

const COLORS=['#7ce8db','#f4d99b','#bbacff'];
const STEPS=[['Scout','Reveal the route'],['Puller','Clear the barrier'],['Carrier','Return three cores'],['Operator','Power the exit; crew crosses']];

export function GauntletGuide(){
  return <div className="border-b border-line bg-[#17202a] p-4" aria-label="How Team Gauntlet works">
    <p className="text-sm leading-relaxed">Three crews of four run the same course at one shared course pace. Each role completes its task before the next starts. Fastest completed crew wins. At the 120-second cutoff, an unfinished field is ranked by completed checkpoints and progress; an exact tie uses the recorded seeded draw.</p>
    <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-4">{STEPS.map(([role,task],i)=><li key={role} className="border-l-2 border-[#7ce8db] pl-3"><strong className="block text-[#d8f7ed]">{i+1}. {role}</strong><span className="text-muted">{task}</span></li>)}</ol>
    <p className="mt-3 text-xs text-amber">Winning crew: Rumble entry slots 9–12. The four members agree their relative order through the Desk. House exhibition results award nothing.</p>
  </div>;
}

function RecordedBot({member,crew,tape,color}:{member:GauntletCrewView['members'][number];crew:GauntletCrewView;tape:ShowcaseTape;color:string}){
  const {fighter:f,frame}=member,role=crew.team.roles?.[f.id],active=role===crew.frame.activeRole;
  const number=tape.fighters.findIndex(fighter=>fighter.id===f.id)+1;
  return <g transform={`translate(${frame.x*1000} ${frame.y*560})`} data-gauntlet-bot={f.id} data-role={role}>
    <title>{`${number}. ${f.botName} · ${role??'role not recorded'}${active?' · active':''}`}</title>
    {active&&<ellipse rx="43" ry="23" fill={color} fillOpacity=".18" stroke={color} strokeWidth="2"/>}
    <foreignObject x="-34" y="-21" width="68" height="42"><BotPortrait camera="top" floor={false} className="h-full w-full" look={{id:f.id,paint:f.paint,classId:f.classId,weapon:f.weaponFamily,weaponName:f.weaponName,look:f.look,number:f.number,hp:frame.hp,style:f.style,storeName:f.storeName,brainTier:f.brainTier,scars:f.scars,armorFamily:f.armorFamily,driveFamily:f.driveFamily,chassisFamily:f.chassisFamily,utilityFamily:f.utilityFamily}}/></foreignObject>
    {frame.carrying&&<circle cx="24" cy="-15" r="8" fill="#baffea" stroke="#fff" strokeWidth="2"/>}
    <circle cx="-55" r="19" fill="#101820" stroke={color} strokeWidth="2"/><text x="-55" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill={color}>{number}</text>
  </g>;
}

export function GauntletCourse({tape,time,reduced}:{tape:ShowcaseTape;time:number;reduced:boolean}){
  const view=gauntletAt(tape,time,reduced);
  const stations=tape.gauntlet?tape.course.objects.filter(o=>o.teamId===view.crews[0]?.team.id&&o.label&&!o.id.endsWith(":depot")):[];
  return <svg viewBox="0 -42 1000 620" className="block w-full bg-[#10262c]" role="img" aria-label={`Team Gauntlet recorded course at ${time.toFixed(1)} seconds`} data-testid="gauntlet-course">
    <rect x="0" y="-42" width="1000" height="620" fill="#10262c"/>
    {stations.map(({x,label,id})=><g key={id}><text x={x*1000} y="-15" textAnchor="middle" fill="#d8e9e6" fontSize="17" fontWeight="700">{label}</text><path d={`M${x*1000} 0V560`} stroke="#ccfff3" strokeOpacity=".12" strokeDasharray="5 7"/></g>)}
    {view.crews.map((crew,i)=>{
      const color=COLORS[i%3]!,lane=crew.members.length?crew.members.reduce((sum,m)=>sum+m.frame.y,0)/crew.members.length:.18+i*.32,cy=lane*560;
      const objects=tape.course.objects.filter(o=>o.teamId===crew.team.id),core=objects.find(o=>o.kind==='core'),gate=objects.find(o=>o.kind==='gate'),scout=objects.find(o=>o.id.endsWith(':scout')),depot=objects.find(o=>o.id.endsWith(':depot')),finish=objects.find(o=>o.id.endsWith(':finish')),control=objects.find(o=>o.id.endsWith(':control'));
      const barrier=gauntletBarrierSize(crew.frame),scoutY=(scout?.y??lane)*560,controlX=control?control.x*1000:(gate?.x??0)*1000-35,controlY=control?control.y*560:cy,controlW=control?control.w*1000:18,controlH=control?control.h*560:74;
      const carrier=crew.members.find(m=>crew.team.roles?.[m.fighter.id]==='carrier');
      const carrying=carrier?.frame.carrying?1:0;
      return <g key={crew.team.id} data-gauntlet-crew={crew.team.id}>
        <rect x="10" y={cy-86} width="975" height="172" rx="10" fill={color} fillOpacity=".055" stroke={color} strokeOpacity=".45" strokeWidth="2"/>
        <text x="20" y={cy-65} fill={color} fontSize="19" fontWeight="800">{crew.team.name}</text>
        {!crew.legacy&&finish&&<path d={`M${finish.x*1000} ${cy-80}v160`} stroke="#f4edd1" strokeWidth="8" strokeDasharray="9 9"/>}
        {!crew.legacy&&<>
          <circle cx={(scout?.x??0)*1000} cy={scoutY} r="17" fill={crew.frame.scoutProgress===1?color:'#17353b'} stroke={color} strokeWidth="3"/>
          <path d={`M${(scout?.x??0)*1000-10} ${scoutY}l7 7 13-15`} stroke="#0b2427" strokeWidth="4" fill="none" opacity={crew.frame.scoutProgress===1?1:.2}/>
          <path d={`M160 ${scoutY}H${(scout?.x??0)*1000+20}`} stroke={color} strokeWidth="5" strokeDasharray="6 5" opacity={crew.frame.scoutProgress}/>
          <g transform={`translate(${crew.frame.barrierX!*1000} ${crew.frame.barrierY!*560})`} data-gauntlet-barrier={crew.team.id}><rect x={-barrier.width/2} y={-barrier.height/2} width={barrier.width} height={barrier.height} rx="3" fill="#b79d76" stroke="#fff0c8" strokeWidth={barrier.stroke}/><path d={`M${-barrier.width*.3} ${-barrier.height*.3}L${barrier.width*.3} ${barrier.height*.1}M${-barrier.width*.3} ${barrier.height*.1}L${barrier.width*.2} ${barrier.height*.35}`} stroke="#494332" strokeWidth="4"/></g>
          {crew.frame.stage===1&&(()=>{const puller=crew.members.find(m=>crew.team.roles?.[m.fighter.id]==='puller');return puller?<path d={`M${puller.frame.x*1000} ${puller.frame.y*560}L${crew.frame.barrierX!*1000} ${crew.frame.barrierY!*560}`} stroke="#e5d5b5" strokeWidth="3"/>:null;})()}
          <rect x={(depot?.x??0)*1000-16} y={(depot?.y??lane)*560-17} width="34" height="34" rx="5" fill="#294f52" stroke={color} strokeWidth="2"/>
          {Array.from({length:crew.frame.coresDelivered},(_,n)=><circle key={'delivered'+n} cx={(depot?.x??0)*1000-9+n*9} cy={(depot?.y??lane)*560} r="5" fill="#baffea" stroke="#fff"/>)}
          {core&&Array.from({length:Math.max(0,3-crew.frame.coresDelivered-carrying)},(_,n)=><circle key={'waiting'+n} cx={core.x*1000+(n-1)*12} cy={core.y*560} r="7" fill="#baffea" stroke="#fff"/>)}
          {gate&&<g data-gauntlet-gate={crew.team.id} data-open={crew.frame.gateOpen?'true':'false'}><rect x={gate.x*1000-10} y={cy-79} width="20" height="158" rx="4" fill={crew.frame.gateOpen?color:'#ecab61'} opacity={crew.frame.gateOpen?.18:.9}/><rect x={controlX-controlW/2} y={controlY-controlH/2} width={controlW} height={controlH} fill="#0c1a21" stroke={color}/><rect x={controlX-controlW/2+3} y={controlY+controlH/2-3-(crew.frame.gatePower??0)*(controlH-6)} width={controlW-6} height={(crew.frame.gatePower??0)*(controlH-6)} fill={color}/><text x={gate.x*1000} y={cy-83} textAnchor="middle" fill={color} fontSize="12">{crew.frame.gateOpen?'OPEN':'POWER'}</text></g>}
        </>}
        {crew.legacy&&<text x="500" y={cy-61} textAnchor="middle" fill={color} fontSize="14">Recorded positions · course actions not captured on this tape</text>}
        {crew.members.map(member=><RecordedBot key={member.fighter.id} member={member} crew={crew} tape={tape} color={color}/>)}
      </g>;
    })}
  </svg>;
}

export function GauntletCrewCards({tape,time}:{tape:ShowcaseTape;time:number}){
  const view=gauntletAt(tape,time,true);
  return <div className="grid gap-3 border-t border-line bg-[#111b24] p-3 lg:grid-cols-3" aria-label="Gauntlet crew standings" data-testid="gauntlet-crew-cards">{view.crews.map((crew,i)=>{
    const lead=view.leaderIds.includes(crew.team.id),color=COLORS[i%3]!;
    return <section key={crew.team.id} className="border bg-[#17232c] p-4" style={{borderColor:color}} aria-label={crew.team.name}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-xl" style={{color}}>{crew.team.name}</h3>{lead&&<span className="rounded border px-2 py-1 text-xs" style={{color}}>{view.leaderIds.length>1?'Tied lead':'Current leader'}</span>}</div>
      <p className="mt-2 min-h-10 text-sm font-bold text-white" aria-live="polite">{gauntletTask(crew)}</p>
      <div className="mt-2 h-2 bg-black/40"><div className="h-full" style={{width:`${crew.frame.progress*100}%`,background:color}}/></div>
      <p className="mt-2 text-xs text-[#d7e2e1]">{crew.frame.checkpoints} / 4 checkpoints · {crew.frame.coresDelivered} / 3 cores delivered · {Math.round(crew.frame.progress*100)}%</p>
      <p className="mt-1 text-xs text-muted">{crew.frame.finished?`Finished at ${crew.members[0]?.run.finishAt} seconds`:time>=tape.duration?'120-second cutoff · ranked by recorded progress':`${time.toFixed(1)} seconds elapsed`}</p>
      <ul className="mt-4 space-y-2">{crew.members.map(({fighter})=>{const role=crew.team.roles?.[fighter.id],active=role===crew.frame.activeRole;return <li key={fighter.id} className={`flex items-start gap-2 rounded p-2 text-sm ${active?'bg-white/10':'bg-black/15'}`}><span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border font-mono text-xs" style={{color,borderColor:color}}>{tape.fighters.findIndex(f=>f.id===fighter.id)+1}</span><div className="min-w-0"><strong className="block break-words">{fighter.botName}</strong><span className="text-xs capitalize" style={{color}}>{role??'Role not recorded'}{active?' · active':''}</span></div></li>;})}</ul>
    </section>;
  })}</div>;
}
