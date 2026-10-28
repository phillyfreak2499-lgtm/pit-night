import { central, centralDay, deadlineDue } from './time';
import { programWeek, dayDate, DAY_LABEL } from './training';
import { countedCrew, weekProgress } from './week';
import type { PitData } from './types';

export function gameReminders(data: PitData, storeId: string, now: Date) {
 const date=centralDay(now);
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(now));
 if(hour<9) return [];
 const yesterday=centralDay(central(date.y,date.m,date.d-1,12));
 const result: {title:string;lines:string[];closed:boolean}[]=[];
 for(let week=1;week<=data.week;week++) {
  const plan=programWeek(week); if(!plan) continue;
  const crew=countedCrew(data,storeId,week);
  if(!weekProgress(data,storeId,week).crew.length) continue;
  for(const day of plan.days) {
   const at=centralDay(dayDate(plan,day.day));
   const same=(other:typeof date)=>at.y===other.y&&at.m===other.m&&at.d===other.d;
   const missed=same(yesterday); const today=same(date)&&hour>=17;
   if(!missed&&!today) continue;
   const closed=week!==data.week||data.phase!=='open'||deadlineDue(week,now);
   if(today&&closed) continue;
   const jobs=crew.reduce((n,c)=>n+day.jobs.filter(j=>!data.jobLog.some(e=>e.week===week&&e.jobId===j.id&&e.crewId===c.id&&(e.status==='approved'||e.status==='pending'))).length,0);
   const sparks=crew.filter(c=>!data.sparkLog.some(e=>e.week===week&&e.day===day.day&&e.crewId===c.id)).length;
   const pending=data.jobLog.filter(e=>e.week===week&&e.storeId===storeId&&e.status==='pending'&&day.jobs.some(j=>j.id===e.jobId)).length;
   const lines:string[]=[];
   if(jobs) lines.push(jobs+' Pit Week job'+(jobs===1?'':'s')+(missed?' still unfinished.':' left today.'));
   if(sparks) lines.push(sparks+' crew member'+(sparks===1?'':'s')+' still need'+(sparks===1?'s':'')+' to complete the Daily Spark.');
   if(pending) lines.push(pending+' submitted job'+(pending===1?' is':'s are')+' waiting for captain approval.');
   if(lines.length) result.push({title:missed?'Follow up on yesterday — '+DAY_LABEL[day.day]:'Before you finish today',lines,closed});
  }
 }
 return result;
}
