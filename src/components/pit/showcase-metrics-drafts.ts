import type {StoreCard} from '@/lib/pit/types';

const metrics=['nsnu','conv','demoRate','demoClose','arch','demoTicket'] as const;

/** Only the submitted card can replace a draft; edits after submission win per field. */
export function mergeShowcaseCards(current:StoreCard[],server:StoreCard[],submitted?:StoreCard):StoreCard[] {
  return server.map(saved=>{
    const draft=current.find(c=>c.storeId===saved.storeId);
    if (!draft) return saved;
    if (saved.storeId!==submitted?.storeId) return draft;
    const merged={...saved};
    for(const key of metrics) if(draft[key]!==submitted[key]) {
      merged[key]=draft[key];
      // Server grades describe the submitted values, not this newer draft.
      merged.grades=undefined;
    }
    return merged;
  });
}
