import test from 'node:test';
import assert from 'node:assert/strict';
import {makeData} from '../src/lib/pit/seed.ts';
import {approvedCard,expectedHistory} from '../src/lib/pit/period12-approved-card.ts';
import {backfillReplays,buildTape} from '../src/lib/pit/replay.ts';
import {resolvePlaybackBout} from '../src/lib/pit/playback-bout.ts';
import {boothScript} from '../src/lib/pit/booth.ts';
import {previewSaturday} from '../src/lib/pit/engine.ts';
import type {Bout} from '../src/lib/pit/types.ts';

function pending(){const data=makeData();data.week=4;data.phase='open';data.bouts=expectedHistory.map((b,i)=>({id:b.id,week:Number(b.id[1]),slot:i%7+1,kind:'bout',title:'Conference',storeIds:[...b.winners,...b.losers],teamA:[b.winners[0]!],teamB:[b.losers[0]!],result:{...structuredClone(approvedCard[0]!.result!),winnerIds:[...b.winners],loserIds:[...b.losers]}})) as Bout[];data.replays=backfillReplays([],data.bouts);return data;}

test('pending approved finale narration uses the displayed frozen fighters and exact seed',()=>{
 const data=pending(),shown=buildTape(data,4).bouts[1]!;
 const found=resolvePlaybackBout(data,shown.id,{preview:true,seed:shown.result!.seed})!;
 assert.deepEqual(found,shown);
 assert.equal(resolvePlaybackBout(data,shown.id,{preview:true,seed:'wrong-tape'}),undefined);
 const walkout=boothScript(data,'walkout',shown.id).map(l=>l.text).join(' ');
 assert.match(walkout,/SIR CLEANSALOT.*RED RIVER/);assert.doesNotMatch(walkout,/BIG BRIDGE|BELL LOCK/);
});

test('ordinary current preview follows the same seed and future archives remain unavailable',()=>{
 const data=makeData(),preview=previewSaturday(data)[0]!;
 assert.deepEqual(resolvePlaybackBout(data,preview.id,{preview:true,seed:preview.result!.seed}),preview);
 assert.equal(resolvePlaybackBout(data,preview.id,{preview:false,seed:preview.result!.seed}),undefined);
 data.replays=[{week:4,bouts:structuredClone(approvedCard)}];
 assert.equal(resolvePlaybackBout(data,approvedCard[0]!.id,{preview:true}),undefined);
});

test('archived playback wins over current bot edits and Saturday never preview-simulates',()=>{
 const data=pending(),shown=buildTape(data,4).bouts;
 data.replays!.push({week:4,bouts:structuredClone(shown)});data.week=5;
 data.bots.forEach(b=>{b.name='Changed live bot';});
 assert.deepEqual(resolvePlaybackBout(data,shown[1]!.id,{preview:true,seed:shown[1]!.result!.seed}),shown[1]);
 assert.equal(resolvePlaybackBout(data,'w5-final-2-rockwall',{preview:true}),undefined);
 assert.equal(resolvePlaybackBout(pending(),'w5-final-2-rockwall',{preview:true}),undefined);
});
