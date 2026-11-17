import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeShowcaseCards} from '../src/components/pit/showcase-metrics-drafts.ts';
import type {StoreCard} from '../src/lib/pit/types.ts';
const card=(storeId:string):StoreCard=>({id:storeId,storeId,week:5,nsnu:10,conv:20,demoRate:30,demoClose:40,arch:2,demoTicket:100,projected:true});

test('saving one card preserves another card edited before the request',()=>{
 const initial=[card('a'),card('b')];
 const drafts=[{...initial[0]!,nsnu:55},{...initial[1]!,conv:66}];
 const response=[{...drafts[0]!,nsnuOfficial:true,projected:false},initial[1]!];
 const merged=mergeShowcaseCards(drafts,response,drafts[0]);
 assert.deepEqual(merged[0],response[0]); assert.deepEqual(merged[1],drafts[1]);
});

test('saving preserves newer edits on the submitted card and other cards',()=>{
 const submitted={...card('a'),nsnu:55};
 const latest=[{...submitted,nsnu:77,conv:42},{...card('b'),demoTicket:999}];
 const response=[{...submitted,nsnuOfficial:true,projected:false,grades:{nsnu:'green' as const}},card('b')];
 const merged=mergeShowcaseCards(latest,response,submitted);
 assert.equal(merged[0]!.nsnu,77); assert.equal(merged[0]!.conv,42);
 assert.equal(merged[0]!.nsnuOfficial,true); assert.equal(merged[0]!.grades,undefined);
 assert.deepEqual(merged[1],latest[1]);
 // A subsequent save can persist the preserved edits normally.
 const saved={...merged[0]!,grades:{nsnu:'blue' as const}};
 assert.deepEqual(mergeShowcaseCards(merged,[saved,card('b')],merged[0])[0],saved);
});

test('initial load fills cards and preparation refresh preserves drafts',()=>{
 const response=[card('a'),card('b')];
 assert.deepEqual(mergeShowcaseCards([],response),response);
 const edited=[{...card('a'),conv:55},card('b')];
 assert.deepEqual(mergeShowcaseCards(edited,response),edited);
});
