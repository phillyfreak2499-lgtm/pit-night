export type ProductQuizQuestion = {
  id: string;
  q: string;
  choices: [string, string, string, string];
  answer: number;
  why: string;
};

/**
 * Product Knowledge 2026 question bank.
 * Source: Waterman DFW Product Knowledge 2026 deck supplied by the owner.
 * Keep wording factual and avoid diagnostic or treatment claims.
 */
export const PRODUCT_QUIZ: ProductQuizQuestion[] = [
  { id:"pk-01", q:"Which three categories make up the Waterman 3-Step System?", choices:["Strengthener, Maintainer, Relaxer","Classic, Mid-Flex, Flex","Support, Cushion, Shoe","Rigid, Medium, Soft"], answer:0, why:"The 3-Step System is one Strengthener, one Maintainer, and one Relaxer." },
  { id:"pk-02", q:"Which type of foot generally suits firmer support?", choices:["A flexible foot","Only a high-arch foot","Every rigid foot","Only a narrow foot"], answer:0, why:"The training says firm support suits flexible feet; rigid feet often need more cushioning and flexibility." },
  { id:"pk-03", q:"What is the mid-line starting Strengthener?", choices:["Classic","Honeycomb","Diamond","Hug"], answer:0, why:"Classic is the Strengthener mid-line starting point." },
  { id:"pk-04", q:"What is the mid-line starting Maintainer?", choices:["Mid-Flex","Ultra","Flex","TSS"], answer:0, why:"Mid-Flex is the Maintainer mid-line starting point." },
  { id:"pk-05", q:"What is the mid-line starting Relaxer?", choices:["Flex Relaxer","SLR","Skinny","Comfort Leather"], answer:0, why:"Flex Relaxer is the Relaxer mid-line starting point." },
  { id:"pk-06", q:"Where is the Strengthener's Metatarsal Rise designed to sit?", choices:["Just behind the ball of the foot","Directly under the heel","On top of the toes","Against the ankle"], answer:0, why:"The Metatarsal Rise sits just behind the ball of the foot." },
  { id:"pk-07", q:"How are Honeycomb and Max compared for rigidity?", choices:["They are considered equally rigid","Honeycomb is always softer","Max is always twice as rigid","They cannot be compared"], answer:0, why:"Honeycomb and Max use the same material and are considered equally rigid." },
  { id:"pk-08", q:"What makes the SLS notably different?", choices:["It is 55% thinner and uses Gait Enhancement Technology","It has no heel cup","It is the softest Relaxer","It is only for open-back shoes"], answer:0, why:"SLS is described as 55% thinner with Gait Enhancement Technology and an energy-return feel." },
  { id:"pk-09", q:"Which Maintainer is the default starting point for nearly any foot and activity?", choices:["Mid-Flex","Miracle Flex","Deluxe","Ultra"], answer:0, why:"Mid-Flex is the default Maintainer and the mid-line start." },
  { id:"pk-10", q:"Which statement about TSS is accurate?", choices:["It is less firm than the current Relaxer line","It is the firmest Strengthener","It has the deepest heel cup","It is only for high-impact sports"], answer:0, why:"The deck notes that TSS, despite being a Maintainer, is less firm than the current Relaxer line." },
  { id:"pk-11", q:"Which Relaxer is the only one with a metatarsal rise and support for all four arches?", choices:["SLR","Flex Relaxer","Skinny","Comfort Leather"], answer:0, why:"SLR is the only Relaxer with a met rise and support for all four arches." },
  { id:"pk-12", q:"If the mid-line support is not right, what is the default rigidity adjustment?", choices:["Go up in strength first","Always go softer first","Change the size first without remeasuring","Skip the test walk"], answer:0, why:"The training says default to going up in strength first; move down only under specific conditions." },
  { id:"pk-13", q:"What does a heel platform trade for greater freedom of movement?", choices:["Some heel control","Arch length","Toe-box width","Support size"], answer:0, why:"A heel platform offers more freedom for sports, running, and tight shoes while giving up some heel control." },
  { id:"pk-14", q:"What is the stated starting point for basketball or other twisting sports?", choices:["Flex Maintainer","Strengthener","Honeycomb","SLR"], answer:0, why:"The deck says basketball and twisting sports start with the Flex Maintainer, never a Strengthener." },
  { id:"pk-15", q:"For pointed-toe high heels, where should you start?", choices:["Flex Relaxer","Classic","Miracle Flex","Honeycomb"], answer:0, why:"The footwear guidance says pointed toes start with the Flex Relaxer." },
  { id:"pk-16", q:"Which Brooks model is the neutral option?", choices:["Ghost","Adrenaline GTS","Both are stability shoes","Neither"], answer:0, why:"Ghost is the neutral shoe; Adrenaline GTS is the stability model." },
  { id:"pk-17", q:"Which Brooks model uses GuideRails for clients wanting extra stability?", choices:["Adrenaline GTS","Ghost","Neither model","Both models identically"], answer:0, why:"Adrenaline GTS is the stability model with GuideRails." },
  { id:"pk-18", q:"What Caterpy size is the default for most adult sneakers with 5–8 rows?", choices:["30-inch Standard","40-inch XL","20-inch Youth","50-inch Boot"], answer:0, why:"Standard 30-inch Caterpy laces are the default for most adult sneakers with 5–8 rows." },
  { id:"pk-19", q:"When fitting Caterpy, what should already be in the shoe?", choices:["The client's foot and supports","Only the empty shoe tree","No support and no foot","A different client's insert"], answer:0, why:"The fitting steps say to lace with the client's foot in the shoe and supports in." },
  { id:"pk-20", q:"If someone falls between OS1st sizes, which direction does the deck say to go?", choices:["Go up a size","Go down a size","Always use the smallest size","Skip the size chart"], answer:0, why:"OS1st sizing guidance says to use the product chart and go up when between sizes." },
  { id:"pk-21", q:"What are the three sizing steps in order?", choices:["Measure, visually confirm, balance technique","Balance, sell, measure","Scan, change rigidity, skip visual check","Measure, choose color, balance"], answer:0, why:"The deck teaches measure accurately, visually confirm the size, then confirm performance with the balance technique." },
  { id:"pk-22", q:"Arch-support size is always fit to which measurement?", choices:["Arch length","Heel-to-toe length only","Shoe width only","Client age"], answer:0, why:"The support is always fit to arch length, even when shoe size uses the larger foot measurement." },
  { id:"pk-23", q:"What is the sizing rule if you appear to be between neighboring sizes?", choices:["You may go one size up OR one size down, never both","Always go two sizes up","Always choose the shorter size","Change size until it feels soft"], answer:0, why:"The sizing chart allows one direction only: one size up or one size down, never both." },
  { id:"pk-24", q:"During the balance demonstration, what does 'move a lot' point to first?", choices:["Size","Rigidity","Paint color","Shoe brand"], answer:0, why:"The deck's shortcut is: move a lot means size; move a little means strength." },
];

const DAY_INDEX = { tue:0, wed:1, thu:2, fri:3, sat:4 } as const;
export function productQuestion(week: number, day: keyof typeof DAY_INDEX): ProductQuizQuestion {
  const offset = (Math.max(1, week) - 1) * 5 + DAY_INDEX[day];
  const base = PRODUCT_QUIZ[offset % PRODUCT_QUIZ.length]!;
  // Rotate choices deterministically so the correct answer is not always sitting
  // in the same button position. The fact and explanation stay unchanged.
  const shift = (offset * 3 + 1) % 4;
  const choices = [...base.choices.slice(shift), ...base.choices.slice(0, shift)] as ProductQuizQuestion["choices"];
  const answer = (base.answer - shift + 4) % 4;
  return { ...base, choices, answer };
}
