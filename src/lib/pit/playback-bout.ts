import {buildTape} from './replay';
import {saturdayFightId,sealSaturday} from './saturday-seal';
import type {Bout,PitData} from './types';

/** Resolve the same playable snapshot as the screen; never preview a sealed Saturday. */
export function resolvePlaybackBout(data:PitData,id:string,options:{preview?:boolean;seed?:string}={}):Bout|undefined {
  const safe=sealSaturday(data);
  const archived=safe.replays?.flatMap(r=>r.bouts).find(b=>b.id===id&&b.result);
  const posted=safe.bouts.find(b=>b.id===id&&b.result&&(b.week<safe.week||['fought','inspected','complete'].includes(safe.phase)||!!saturdayFightId(id)));
  const week=Number(/^w([1-5])-/.exec(id)?.[1]);
  const preview=options.preview && !saturdayFightId(id) && week===safe.week
    ? buildTape(safe,week).bouts.find(b=>b.id===id&&b.result):undefined;
  const bout=archived??posted??preview;
  return bout?.result && bout.week<=safe.week && (!options.seed||bout.result.seed===options.seed) ? bout:undefined;
}
