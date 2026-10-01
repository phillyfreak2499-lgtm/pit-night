import { central } from "./time";
/**
 * Pit Week: the four-week weekday program.
 * Every job and Spark question is drawn from the COGS training library:
 * Why We Sell The Way We Do, A Remarkable Experience, Building Non-Tangible Value,
 * Interview for Reality, Building a Complete Solution, Peace of Mind 3,
 * Closing Flow 2026, Close is Not Good Enough, and the CARE Field Guide.
 * Culture runs every single day.
 */

export type JobKind = "culture" | "skill" | "care" | "crate";
export type DayKey = "tue" | "wed" | "thu" | "fri" | "sat";

export type Job = {
  id: string;
  kind: JobKind;
  title: string;
  /** What to do, in one or two plain sentences. */
  do: string;
  /** What to write in the note when you check it off. */
  proof: string;
};

export type Spark = {
  q: string;
  choices: string[];
  answer: number;
  why: string;
};

export type TrainingDay = {
  day: DayKey;
  jobs: [Job, Job];
  spark: [Spark, Spark, Spark];
};

export type TrainingWeek = {
  week: number;
  theme: string;
  tagline: string;
  source: string;
  /** Tuesday of that week, local date, YYYY-MM-DD. */
  start: string;
  days: TrainingDay[];
  /** Captain only. Counts toward the Full Tune-Up. */
  care: Job;
};

export const DAY_LABEL: Record<DayKey, string> = { tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
export const DAY_ORDER: DayKey[] = ["tue", "wed", "thu", "fri", "sat"];

/** Coins are performance. Bolts are effort. Bolts never touch the fight except through the Full Tune-Up. */
export const BOLTS = { job: 2, sparkCorrect: 1, pickCorrect: 2, crate: 5 } as const;

/** Perfect Sparks in a row for the streak badge. */
export const STREAK_BADGE = 5;

type CrateJob = Omit<Job, "id" | "kind">;

/** Wednesday Mystery Crate: one bonus job, revealed Wednesday. Extra bolts, not part of the Tune-Up. */
export const CRATES: CrateJob[] = [
  {
    title: "Five-star moment",
    do: "Give a Client an experience worth writing about, then ask them for a Google review before they leave. Bonus if they mention you by name.",
    proof: "The Client's first name and one line from their review.",
  },
  {
    title: "Referral ask",
    do: "Ask every Client who buys today: “Who else do you know who is living with pain like you were?” Get one name and number.",
    proof: "The referral's first name and how they know your Client.",
  },
  {
    title: "Follow-up hero",
    do: "Make three follow-up calls to Clients from the last 30 days. Get one of them to tell you a win in their own words.",
    proof: "The Client's first name and their win.",
  },
  {
    title: "Rolex corner",
    do: "Pick one corner of the store and make it Rolex level before noon. Ask your captain to inspect it.",
    proof: "What you fixed and what your captain said.",
  },
  {
    title: "Teach-back",
    do: "Teach a teammate one step of the Closing Flow for five minutes, then have them teach it back to you.",
    proof: "Who you taught and which step.",
  },
  {
    title: "Good neighbor",
    do: "Walk a thank-you note and your card to a business next door. Tell them what Good Feet does for people in pain.",
    proof: "The business and who you talked to.",
  },
  {
    title: "Before and after",
    do: "After the Relaxer walk, ask a Client to describe how they felt walking in versus right now, in their own words.",
    proof: "Their before and their after, in one line each.",
  },
  {
    title: "Huddle hype",
    do: "Lead tomorrow's huddle with one win from today: a Client, a teammate, or a number. Keep it under a minute.",
    proof: "The win you are bringing to the huddle.",
  },
];

/** The crate for a week. Shuffled by week so stores cannot guess it from the list. */
export function crateFor(week: number): Job {
  const order = [5, 0, 3, 7, 1, 6, 2, 4];
  const pick = CRATES[order[(week - 1) % order.length]! % CRATES.length]!;
  return { ...pick, id: `w${week}-crate`, kind: "crate" };
}

/** Full Tune-Up: every job and every Spark, every specialist, done by Saturday close. */
export const TUNE_UP_BONUS = 4;

export const PROGRAM: TrainingWeek[] = [
  {
    week: 1,
    theme: "Remarkable",
    tagline: "A Remarkable Experience. Every Client. Every Time.",
    source: "Why We Sell The Way We Do · A Remarkable Experience · Building Non-Tangible Value",
    start: "2026-10-27",
    care: {
      id: "w1-care",
      kind: "care",
      title: "Assign the floor out loud",
      do: "Every day this week, name the Sales Floor Leader in the opening huddle and write it where the whole team can see. Hand it off out loud if you step away.",
      proof: "Who led the floor each day, and one hand-off you made.",
    },
    days: [
      {
        day: "tue",
        jobs: [
          {
            id: "w1-tue-culture",
            kind: "culture",
            title: "Know your why",
            do: "Read Why We Sell The Way We Do. In huddle, say in one sentence why we build one complete Solution instead of selling a product.",
            proof: "Your one sentence, in your own words.",
          },
          {
            id: "w1-tue-skill",
            kind: "skill",
            title: "Greet within 30 seconds",
            do: "Greet every Client within 30 seconds and get them seated. Ask how they are feeling before anything about product.",
            proof: "The first thing one Client told you about their pain.",
          },
        ],
        spark: [
          {
            q: "Per Why We Sell The Way We Do, the person who walks through our door is…",
            choices: ["Shopping around", "Hurting", "Looking for a deal", "Just browsing"],
            answer: 1,
            why: "They are not shopping. They are hurting, and they decided today was the day.",
          },
          {
            q: "Everything we do is built on which two things?",
            choices: ["Speed and accuracy", "Price and product", "Empathy and trust", "Volume and ticket"],
            answer: 2,
            why: "Empathy and trust are not the soft part of the sale. They are the whole method.",
          },
          {
            q: "How fast do we greet every Client?",
            choices: ["Within 30 seconds", "Within 2 minutes", "When a Specialist is free", "After they browse"],
            answer: 0,
            why: "Within 30 seconds, and we sit them down. A hurting person deserves to feel received.",
          },
        ],
      },
      {
        day: "wed",
        jobs: [
          {
            id: "w1-wed-culture",
            kind: "culture",
            title: "Shout out a teammate",
            do: "Catch a teammate doing something Remarkable today and post a shout-out on the wall. Be specific.",
            proof: "Post it on the shout-out wall, then check this off.",
          },
          {
            id: "w1-wed-skill",
            kind: "skill",
            title: "Treat it like a Rolex",
            do: "Reset your cart and fitting station to pristine before your first Client. Present every support, shoe, sock, and Med Massager deliberately all day.",
            proof: "One thing you fixed on the cart, and how the Client reacted to the presentation.",
          },
        ],
        spark: [
          {
            q: "Which non-tangible pillar has the highest leverage on perceived value?",
            choices: ["Store music", "Cart & product handling", "Follow-up texts", "Parking"],
            answer: 1,
            why: "Careless handling makes a $525 support feel like a $20 insole.",
          },
          {
            q: "Non-tangible value is…",
            choices: [
              "A discount we can offer",
              "Everything the Client sees, feels, experiences, and remembers that is not the product itself",
              "Only the store's decor",
              "The warranty paperwork",
            ],
            answer: 1,
            why: "It reinforces the tangible, it is 100% controllable, and it is the multiplier.",
          },
          {
            q: "On a cart, which of these is a NEVER?",
            choices: ["Staging items with care", "Clean trays and tablets", "Tossing supports onto the cart", "Keeping the station organized"],
            answer: 2,
            why: "Tossing supports says ‘this is ordinary.’ Discount-bin energy kills premium perception.",
          },
        ],
      },
      {
        day: "thu",
        jobs: [
          {
            id: "w1-thu-culture",
            kind: "culture",
            title: "Zero-negativity shift",
            do: "One full shift with zero negativity: no complaining about Clients, schedules, or teammates. Make every hand-off seamless and supportive.",
            proof: "One moment you turned a negative into a positive.",
          },
          {
            id: "w1-thu-skill",
            kind: "skill",
            title: "Your first 30–60 seconds",
            do: "Self-check before you open: sharp, clean, strong posture, phone away. Ask a teammate for one piece of feedback on your presence.",
            proof: "The feedback you got, and what you changed.",
          },
        ],
        spark: [
          {
            q: "How long do Clients take to decide if this feels like a $2,000 solution or a $20 one?",
            choices: ["The first 30–60 seconds", "After the fitting", "At the register", "After the follow-up call"],
            answer: 0,
            why: "Your presence either supports or undermines the price before you say much at all.",
          },
          {
            q: "Which should a Specialist NEVER do?",
            choices: ["Strong posture", "Looking at the phone during the experience", "Warm, professional tone", "Consultative, never rushed"],
            answer: 1,
            why: "Phone use or multitasking says ‘this is just another job.’",
          },
          {
            q: "Team Atmosphere as a non-tangible means…",
            choices: ["Music volume", "Zero tolerance for negativity and seamless hand-offs", "Matching uniforms only", "Everyone selling solo"],
            answer: 1,
            why: "The whole store team acts as one premium brand.",
          },
        ],
      },
      {
        day: "fri",
        jobs: [
          {
            id: "w1-fri-culture",
            kind: "culture",
            title: "What will they say tonight?",
            do: "After every Client today, ask yourself: what will this person say about us at dinner tonight? If you don't have an answer, the appointment isn't finished.",
            proof: "One Client's ‘dinner story’ in their words: understood, surprised, or felt better.",
          },
          {
            id: "w1-fri-skill",
            kind: "skill",
            title: "Store in the first 10 seconds",
            do: "Walk in the front door like a Client. Fix three things: floors, glass, mirrors, bathroom, lighting, or the fitting area.",
            proof: "The three things you fixed.",
          },
        ],
        spark: [
          {
            q: "People retell three things. Which is NOT one of them?",
            choices: ["They understood me", "They surprised me", "They gave me a discount", "They made me feel better"],
            answer: 2,
            why: "Satisfaction doesn't travel. Understood, surprised, felt better does.",
          },
          {
            q: "In A Remarkable Experience, the Welcome phase story is…",
            choices: ["“They were fast.”", "“It felt like a home, not a store.”", "“They had my size.”", "“The price was fair.”"],
            answer: 1,
            why: "Phase 1, Welcome: it felt like a home, not a store.",
          },
          {
            q: "When do store standards matter MOST, per the training?",
            choices: ["Slow weekdays", "High-traffic and low-staffed days", "Only during manager visits", "Only on Saturdays"],
            answer: 1,
            why: "Busy and transition days are the highest-risk windows. Standards do not drop.",
          },
        ],
      },
      {
        day: "sat",
        jobs: [
          {
            id: "w1-sat-culture",
            kind: "culture",
            title: "Thank-you note",
            do: "Hand-write a thank-you note to a Client from this week. Post-sale touches reinforce that we care beyond the sale.",
            proof: "Who it went to (first name) and one line from the note.",
          },
          {
            id: "w1-sat-skill",
            kind: "skill",
            title: "Win and miss to the huddle",
            do: "Bring one win and one miss from this week to the huddle. Celebrate the win. Own the miss as learning.",
            proof: "Your win and your miss.",
          },
        ],
        spark: [
          {
            q: "The Experience phase story is…",
            choices: ["“They called me. I didn't have to call them.”", "“They gave me free socks.”", "“It was quick.”", "“I got a coupon.”"],
            answer: 0,
            why: "We stay after the sale. We circle the days and we call.",
          },
          {
            q: "Remarkable means…",
            choices: ["Better than fine", "The Client leaves with something worth remarking on", "Lowest price in town", "A five-star review"],
            answer: 1,
            why: "Remarkable is literal: a story they retell that night.",
          },
          {
            q: "Why do we ask the Client to buy?",
            choices: ["Because the store has a goal", "Asking is care. They are waiting for us to lead them out of pain.", "To end the visit quickly", "Only if they ask first"],
            answer: 1,
            why: "Going quiet at the finish line leaves them in the same pain they walked in with.",
          },
        ],
      },
    ],
  },
  {
    week: 2,
    theme: "Interview for Reality",
    tagline: "Invite reality into the room early. Protect the Client. Own the outcome.",
    source: "Interview for Reality · Why We Sell The Way We Do",
    start: "2026-11-03",
    care: {
      id: "w2-care",
      kind: "care",
      title: "Read the floor: green and red flags",
      do: "Watch every demo you can this week without stepping in unless you need to. Log three green flags you protected and one red flag you answered with AAH: Acknowledge, Add value, Hand it back.",
      proof: "Your three green flags and the AAH step-in.",
    },
    days: [
      {
        day: "tue",
        jobs: [
          {
            id: "w2-tue-culture",
            kind: "culture",
            title: "Warm hand-off",
            do: "When you pass a Client to a teammate, say why that teammate is excellent: “[Name] is an excellent Specialist and is going to take great care of you.”",
            proof: "The exact words you used.",
          },
          {
            id: "w2-tue-skill",
            kind: "skill",
            title: "One reality question, every interview",
            do: "Ask at least one reality question in every interview today. Start soft: “Who else feels the impact of this day-to-day?”",
            proof: "What surfaced: spouse, money, or another decision-maker.",
          },
        ],
        spark: [
          {
            q: "The #1 silent sale-killer at Good Feet is…",
            choices: ["“It's too expensive.”", "“I need to talk to my spouse.”", "“I'll think about it.”", "“I have insoles at home.”"],
            answer: 1,
            why: "Surface it early or lose it later.",
          },
          {
            q: "Avoiding the hard question early leads to…",
            choices: ["A happier Client", "The real confrontation later, at home, without you", "A faster close", "Fewer returns"],
            answer: 1,
            why: "The uncomfortable conversation happens at home, and the sale dies.",
          },
          {
            q: "Which is the SOFT OPEN reality question?",
            choices: [
              "“Who else feels the impact of this day-to-day?”",
              "“Do you need permission to buy?”",
              "“Can you afford this?”",
              "“Is your spouse going to say no?”",
            ],
            answer: 0,
            why: "It opens the door to spouse and family without pressure.",
          },
        ],
      },
      {
        day: "wed",
        jobs: [
          {
            id: "w2-wed-culture",
            kind: "culture",
            title: "Shout out a teammate",
            do: "Post a shout-out for a teammate who protected a Client this week: a great question, a warm moment, a save.",
            proof: "Post it on the shout-out wall, then check this off.",
          },
          {
            id: "w2-wed-skill",
            kind: "skill",
            title: "Tone and pause",
            do: "After every reality question, stop. Let them answer fully. Acknowledge whatever they say before you move on.",
            proof: "One answer you would have rushed past last week.",
          },
        ],
        spark: [
          {
            q: "When you ask a reality question, you should NEVER…",
            choices: ["Pause and let them answer", "Use their words back", "Ask as if you're already braced for ‘no’", "Smile and stay warm"],
            answer: 2,
            why: "These are ownership questions, not interrogation questions.",
          },
          {
            q: "Treat the answer to a reality question as…",
            choices: ["A threat", "Useful information", "The end of the sale", "Something to skip"],
            answer: 1,
            why: "Acknowledge and explore. Never rush past it.",
          },
          {
            q: "Why mine for objections early?",
            choices: [
              "They arrive while value is still high",
              "It shortens the visit",
              "So we can discount sooner",
              "Managers require it",
            ],
            answer: 0,
            why: "Right after they feel the difference, an objection is easier to answer with ownership.",
          },
        ],
      },
      {
        day: "thu",
        jobs: [
          {
            id: "w2-thu-culture",
            kind: "culture",
            title: "Role-play partner",
            do: "Run one Interview for Reality role-play with a teammate: The Silent Spouse, The Joint Decision, or Price + Spouse. Then switch.",
            proof: "Which scenario, and the line that worked.",
          },
          {
            id: "w2-thu-skill",
            kind: "skill",
            title: "The process question",
            do: "When a Client mentions a spouse, ask: “When you've decided on something this important for your body, how have you and [spouse] usually done that together?”",
            proof: "How they said they usually decide.",
          },
        ],
        spark: [
          {
            q: "“What would make this a no-brainer for both of you?” is the…",
            choices: ["Soft open", "Process question", "Criteria question", "Close"],
            answer: 2,
            why: "It surfaces the real criteria so you can address them.",
          },
          {
            q: "A Client says “We always decide together.” Best move?",
            choices: [
              "End the presentation",
              "Explore the process and offer a tool for the home conversation",
              "Offer a discount",
              "Ask them to come back",
            ],
            answer: 1,
            why: "Offer video, a summary, or guarantee language to support the conversation at home.",
          },
          {
            q: "The mindset shift: “I protect the Client by…”",
            choices: ["staying out of their business", "bringing reality into the room", "lowering the price", "keeping it friendly and light"],
            answer: 1,
            why: "The Client never has to defend a $2,000 decision alone. You become the guide.",
          },
        ],
      },
      {
        day: "fri",
        jobs: [
          {
            id: "w2-fri-culture",
            kind: "culture",
            title: "Help a teammate win",
            do: "Find one teammate who is stuck on something this week and help them: a role-play, a cart reset, covering a hand-off.",
            proof: "Who you helped and how.",
          },
          {
            id: "w2-fri-skill",
            kind: "skill",
            title: "Support the home conversation",
            do: "When a spouse comes up, offer one concrete tool: “Would it help if we recorded a quick 60-second video of your test walk so they can see the difference you just felt?”",
            proof: "The tool you offered and how they responded.",
          },
        ],
        spark: [
          {
            q: "Which is a tool to support the conversation at home?",
            choices: ["A coupon", "A 60-second video of their test walk", "A business card only", "A brochure about price"],
            answer: 1,
            why: "Let the spouse see the difference the Client just felt.",
          },
          {
            q: "Weak mining looks like…",
            choices: [
              "Asking a reality question every interview",
              "Hearing ‘I'll talk to my spouse’ and freezing",
              "Pausing after the answer",
              "Keeping the core strong",
            ],
            answer: 1,
            why: "Strong mining already knows the spouse is part of the process.",
          },
          {
            q: "Prescription without diagnosis is…",
            choices: ["Efficient", "Malpractice", "Fine for repeat Clients", "Required"],
            answer: 1,
            why: "We will not recommend something we have not earned the right to recommend.",
          },
        ],
      },
      {
        day: "sat",
        jobs: [
          {
            id: "w2-sat-culture",
            kind: "culture",
            title: "Huddle: full ownership review",
            do: "Bring one Interview for Reality win and one miss to the huddle. Celebrate the win out loud. Own the miss as learning.",
            proof: "Your win and your miss.",
          },
          {
            id: "w2-sat-skill",
            kind: "skill",
            title: "Self-audit",
            do: "Rate yourself 1–5 on the Interview for Reality self-audit: reality question asked, tone, response to the answer, spouse handled, ownership.",
            proof: "Your five scores and the one you will raise next week.",
          },
        ],
        spark: [
          {
            q: "On the self-audit, a ‘5’ on Reality question asked means…",
            choices: ["Asked it once this week", "At least one reality question in every interview", "Asked only when they mention price", "Let the manager ask"],
            answer: 1,
            why: "Every interview. That is the habit.",
          },
          {
            q: "Is “Is this something you want to run by anyone else before we lock in the system?” pushy?",
            choices: ["Yes, avoid it", "No. Direct, respectful, and gives permission to be honest", "Only on weekends", "Only for couples"],
            answer: 1,
            why: "It gives the Client permission to be honest.",
          },
          {
            q: "Interview phase story, per A Remarkable Experience:",
            choices: [
              "“They understood my problem better than I could explain it.”",
              "“They talked a lot.”",
              "“They knew the prices.”",
              "“It was quick.”",
            ],
            answer: 0,
            why: "That is what listening first sounds like to the Client.",
          },
        ],
      },
    ],
  },
  {
    week: 3,
    theme: "One Complete Solution",
    tagline: "A partial Solution is an incomplete Solution. Nobody takes half a prescription.",
    source: "Building a Complete Solution · Peace of Mind 3",
    start: "2026-11-10",
    care: {
      id: "w3-care",
      kind: "care",
      title: "Backroom coaching: one thing",
      do: "After at least three demos this week, coach in the backroom while it is fresh. Lead with what went well, then name one opportunity. One, not five.",
      proof: "The three Specialists, and the one thing you coached each.",
    },
    days: [
      {
        day: "tue",
        jobs: [
          {
            id: "w3-tue-culture",
            kind: "culture",
            title: "New words, all week",
            do: "Retire “add-on,” “accessory,” “extra,” and “upsell” for the whole team. If anyone hears one, call it in good fun and swap in “Solution Component.”",
            proof: "One time you caught (or got caught) and swapped the word.",
          },
          {
            id: "w3-tue-skill",
            kind: "skill",
            title: "Name each component's job",
            do: "In every presentation, say what each component does for this Client: shoes carry the correction, socks protect comfort, Med Massager extends recovery.",
            proof: "The component job you explained best today.",
          },
        ],
        spark: [
          {
            q: "Replace “add-on” with…",
            choices: ["“Bonus item”", "“Solution Component”", "“Optional extra”", "“Accessory”"],
            answer: 1,
            why: "Everything belongs to one complete Solution. Nothing was ever separate.",
          },
          {
            q: "Brooks shoes' job in the Solution:",
            choices: ["Look good", "Carry the correction into the footwear they wear most", "Replace the supports", "Match their outfit"],
            answer: 1,
            why: "That is how the Solution travels with the Client all day.",
          },
          {
            q: "Med Massager's job:",
            choices: ["Extend recovery beyond the fitting", "Replace the supports at night", "Fix flat feet", "Nothing, it is optional"],
            answer: 0,
            why: "It supports circulation and comfort at home so the work keeps paying off.",
          },
        ],
      },
      {
        day: "wed",
        jobs: [
          {
            id: "w3-wed-culture",
            kind: "culture",
            title: "Shout out a teammate",
            do: "Post a shout-out for a teammate who presented a complete Solution this week or helped someone else do it.",
            proof: "Post it on the shout-out wall, then check this off.",
          },
          {
            id: "w3-wed-skill",
            kind: "skill",
            title: "Peace of Mind 3, five out loud",
            do: "Say Lifetime, Guided, Guaranteed out loud five times today: in the car, before open, after close. No paper after rep three.",
            proof: "Which of the three points was hardest to say naturally.",
          },
        ],
        spark: [
          {
            q: "Peace of Mind 3 happens…",
            choices: ["During the Close", "Right after the Maintainer walk", "At the very end", "Only if the Client looks unsure"],
            answer: 1,
            why: "That is where Client fatigue shows up. Right there, every time.",
          },
          {
            q: "The main fear Peace of Mind 3 answers is…",
            choices: ["The price", "Making a mistake", "The parking", "The wait time"],
            answer: 1,
            why: "Each point removes a way to be wrong.",
          },
          {
            q: "The three points, in order:",
            choices: ["Price, Payment, Promise", "Lifetime, Guided, Guaranteed", "Fit, Feel, Function", "Welcome, Interview, Analysis"],
            answer: 1,
            why: "Lifetime. Guided. Guaranteed. Do not recite. Do hit all three.",
          },
        ],
      },
      {
        day: "thu",
        jobs: [
          {
            id: "w3-thu-culture",
            kind: "culture",
            title: "Pair up for a 90-second rep",
            do: "Pair with a teammate. One plays a Client who just finished the Maintainer walk and looks overwhelmed. Deliver Peace of Mind 3 with the schedule in their hand. Partner checks the three boxes. Switch.",
            proof: "Your partner, and which box you missed (if any).",
          },
          {
            id: "w3-thu-skill",
            kind: "skill",
            title: "Paper hits the hand first",
            do: "On every Guided point today, put the wear schedule in the Client's hand before you say the words. Set the day-30 look-together while they are standing there.",
            proof: "One day-30 appointment you set.",
          },
        ],
        spark: [
          {
            q: "On Guided, the Specialist contacts the Client on which days?",
            choices: ["Day 1, 7, 30", "Day 3, 10, and 21", "Only day 30", "When they call"],
            answer: 1,
            why: "Plus a day-30 look-together, set while they are standing there.",
          },
          {
            q: "Guaranteed: “Thirty we work it. Thirty we adjust it. Then…”",
            choices: ["“…we start over.”", "“…we make it right.”", "“…you're on your own.”", "“…we upgrade you.”"],
            answer: 1,
            why: "The 90 days is a process with a backstop, not a trial period.",
          },
          {
            q: "The Lifetime warranty covers…",
            choices: ["Comfort forever", "Chipping, cracking, and flattening at any Good Feet store in the U.S.", "Only this store", "Fit and feel"],
            answer: 1,
            why: "Structure only. Do not promise comfort, fit, or forever perfect.",
          },
        ],
      },
      {
        day: "fri",
        jobs: [
          {
            id: "w3-fri-culture",
            kind: "culture",
            title: "Follow-up call day",
            do: "Make one follow-up call to a Client on their day 3, 10, or 21. Feel caring, not scripted. Reinforce the relationship and the guarantee.",
            proof: "What the Client told you, and any review or referral.",
          },
          {
            id: "w3-fri-skill",
            kind: "skill",
            title: "Match without stepping down",
            do: "Role-play the price push-back with a teammate: reconnect to the goal, explain the component's job, keep the core strong.",
            proof: "Your reconnect line, word for word.",
          },
        ],
        spark: [
          {
            q: "When the investment is questioned, the FIRST move is…",
            choices: ["Remove the Med Massager", "Reconnect to the goal", "Offer a discount", "Show cheaper supports"],
            answer: 1,
            why: "Bring them back to why they came in before you change anything.",
          },
          {
            q: "A Client in supports for one pair of shoes and unsupported 16 hours a day has…",
            choices: ["Solved the problem", "Solved part of the problem", "Wasted money", "The full Solution"],
            answer: 1,
            why: "A partial Solution is an incomplete Solution.",
          },
          {
            q: "Quietly pulling pieces out of the Solution only protects…",
            choices: ["The Client", "The awkward moment", "The store", "The warranty"],
            answer: 1,
            why: "Matching the right Solution protects the Client.",
          },
        ],
      },
      {
        day: "sat",
        jobs: [
          {
            id: "w3-sat-culture",
            kind: "culture",
            title: "Celebrate a Client win",
            do: "In the huddle, share the best Client transformation you saw this week: pain from an 8 to a 3, standing taller, a spouse who saw the difference.",
            proof: "The Client's win in one sentence.",
          },
          {
            id: "w3-sat-skill",
            kind: "skill",
            title: "Record one take",
            do: "Record one Peace of Mind 3 on your phone. Listen once. Did you hit Lifetime, Guided, Guaranteed, and sound like a person? Fix the miss.",
            proof: "What you fixed after listening.",
          },
        ],
        spark: [
          {
            q: "Three tells you slipped into a recital:",
            choices: [
              "Eye contact, pauses, your own words",
              "Looking past the Client, same-length sentences, no pause between points",
              "Smiling, slowing down, asking questions",
              "Using the schedule",
            ],
            answer: 1,
            why: "The fix is fewer memorized words and more of your own.",
          },
          {
            q: "Why three points and not four?",
            choices: [
              "It is easier to print",
              "Enough to cover every fear, few enough to hold at once",
              "Managers prefer three",
              "No reason",
            ],
            answer: 1,
            why: "A fourth would put us right back where we started.",
          },
          {
            q: "Solution phase story, per A Remarkable Experience:",
            choices: ["“I felt the difference right there in the store.”", "“They had everything.”", "“The price was clear.”", "“It was fast.”"],
            answer: 0,
            why: "By the time we talk Solution, they already know it works.",
          },
        ],
      },
    ],
  },
  {
    week: 4,
    theme: "Ask Them to Buy",
    tagline: "Set the stage. Present the Solution. Ask them to buy.",
    source: "Closing Flow 2026 · Close is Not Good Enough · A Remarkable Experience",
    start: "2026-11-17",
    care: {
      id: "w4-care",
      kind: "care",
      title: "Manager listen",
      do: "Hear one live close from every Specialist this week. Coach the missing step only, twenty seconds, not the whole close.",
      proof: "Each Specialist and the one step you coached.",
    },
    days: [
      {
        day: "tue",
        jobs: [
          {
            id: "w4-tue-culture",
            kind: "culture",
            title: "Celebrate out loud",
            do: "When a teammate closes today, the whole team celebrates it. Make it a moment.",
            proof: "Who you celebrated and how.",
          },
          {
            id: "w4-tue-skill",
            kind: "skill",
            title: "Recap the wins as yes questions",
            do: "After the Relaxer walk, seat them at eye level and recap the wins. Get a clear verbal yes on each: “We took your pain from a [X] down to a [Y]. That is real, isn't it?”",
            proof: "The standout win, in the Client's own words.",
          },
        ],
        spark: [
          {
            q: "Set the Stage starts with…",
            choices: [
              "The price",
              "“Before we go any further, let's look at everything we accomplished together today.”",
              "The payment options",
              "A product list",
            ],
            answer: 1,
            why: "Walk the wins as yes questions. Every yes builds momentum.",
          },
          {
            q: "If the Client brought someone, you should…",
            choices: ["Ignore them", "Ask them how much better the Client is walking", "Ask them to wait outside", "Pitch to them instead"],
            answer: 1,
            why: "Their opinion matters more than yours.",
          },
          {
            q: "Where do you sit for the Close?",
            choices: ["Behind the counter", "At eye level, leaning in slightly", "Standing over them", "At the register"],
            answer: 1,
            why: "Lower your energy into warm, steady, and confident. Slow down.",
          },
        ],
      },
      {
        day: "wed",
        jobs: [
          {
            id: "w4-wed-culture",
            kind: "culture",
            title: "Shout out a teammate",
            do: "Post a shout-out for a teammate who asked a Client to buy this week with confidence and care.",
            proof: "Post it on the shout-out wall, then check this off.",
          },
          {
            id: "w4-wed-skill",
            kind: "skill",
            title: "Present what you built together",
            do: "Present the Solution as what you built together: the supports, the 4th support for their need, cushions and activators, shoes, Med Massager, 7 pairs of OS1st. Land it: “Every single piece of this is designed to attack your pain from every angle!”",
            proof: "How you tied one piece back to why they came in.",
          },
        ],
        spark: [
          {
            q: "The bridge line into the Solution is…",
            choices: [
              "“So here is exactly what we built together to keep that going.”",
              "“Let me show you our products.”",
              "“Here's the total.”",
              "“Most people get this package.”",
            ],
            answer: 0,
            why: "You are handing them the answer to the problem that brought them in.",
          },
          {
            q: "How many pairs of OS1st compression socks are in the Solution?",
            choices: ["3", "5", "7", "10"],
            answer: 2,
            why: "Seven pairs, with a lifetime warranty.",
          },
          {
            q: "Presenting the Solution, DO NOT…",
            choices: ["Slow down", "Read it like a product list", "Connect it to them", "Name every piece"],
            answer: 1,
            why: "Tie each piece back to what they felt and why they came in.",
          },
        ],
      },
      {
        day: "thu",
        jobs: [
          {
            id: "w4-thu-culture",
            kind: "culture",
            title: "Live practice, 8 minutes",
            do: "Pair up. One Specialist, one Client who just finished the Relaxer walk. Set the stage, present, and ask, seated at eye level, ending on a question. Partner scores the four boxes. Switch.",
            proof: "Your four-box score.",
          },
          {
            id: "w4-thu-skill",
            kind: "skill",
            title: "“Now here's the best part!”",
            do: "Transition straight into the ask without pausing for permission. Reach for the phone or tablet as you speak.",
            proof: "One Client's reaction to the transition.",
          },
        ],
        spark: [
          {
            q: "The transition line into the ask is…",
            choices: ["“So, what do you think?”", "“Now here's the best part!”", "“Any questions?”", "“Let me get my manager.”"],
            answer: 1,
            why: "It moves you from what is in the Solution to the ask.",
          },
          {
            q: "How long can a Client finance with no interest?",
            choices: ["No financing, cash only", "Up to 18 months with no interest", "12 months at 5%", "We don't offer it"],
            answer: 1,
            why: "PayTomorrow and CareCredit: around $135 a month, as low as $80.",
          },
          {
            q: "After you give the price, you…",
            choices: ["Explain it again", "Stop talking and let it sit", "Offer a discount", "Change the subject"],
            answer: 1,
            why: "The next person to speak should be the Client.",
          },
        ],
      },
      {
        day: "fri",
        jobs: [
          {
            id: "w4-fri-culture",
            kind: "culture",
            title: "Circle the days",
            do: "After every sale today, walk the Wear and Care pamphlet, circle the days you will call, and help them add the Client portal to their home screen. Then do your Salesforce notes.",
            proof: "One Client and the days you circled.",
          },
          {
            id: "w4-fri-skill",
            kind: "skill",
            title: "Answer, then ask again",
            do: "When a Client hesitates, answer the objection fully and calmly, then loop straight back: “So, shall we get you started?” Always end on the question.",
            proof: "The objection and the exact words of your second ask.",
          },
        ],
        spark: [
          {
            q: "An objection is…",
            choices: ["A rejection", "A question, a door the Client is holding open", "The end of the sale", "A reason to discount"],
            answer: 1,
            why: "Soften, ask what they mean, answer, and ask again.",
          },
          {
            q: "The Client already has CareCredit. You…",
            choices: ["Suggest PayTomorrow instead", "Move on it immediately: “Let's put your CareCredit to work right now.”", "Ask them to think it over", "Talk about price again"],
            answer: 1,
            why: "No hesitation.",
          },
          {
            q: "Closing phase story, per A Remarkable Experience:",
            choices: ["“They never pushed me.”", "“They gave me a deal.”", "“They were in a hurry.”", "“They let me leave.”"],
            answer: 0,
            why: "Asking is care, and it never has to feel like pushing.",
          },
        ],
      },
      {
        day: "sat",
        jobs: [
          {
            id: "w4-sat-culture",
            kind: "culture",
            title: "Title week huddle",
            do: "Before open, every person names one teammate who made them better this period and why. Out loud.",
            proof: "Who you named and why.",
          },
          {
            id: "w4-sat-skill",
            kind: "skill",
            title: "Next three closes",
            do: "On your next three closes, check the four boxes after each Client leaves: set the stage, present the Solution, ask, and sounded like a person.",
            proof: "Your four-box results for all three.",
          },
        ],
        spark: [
          {
            q: "Why carry four wedges, per Close is Not Good Enough?",
            choices: ["To look like a pro", "Accuracy: the right tool for every moment of the Close", "Because the course requires it", "For backup"],
            answer: 1,
            why: "Close is not in the hole. More wedges, more accuracy, more closes.",
          },
          {
            q: "The step we skip most:",
            choices: ["The greeting", "Asking them to buy", "The Analysis", "The test walk"],
            answer: 1,
            why: "A Solution that never gets offered helps no one.",
          },
          {
            q: "The Answer phase story:",
            choices: ["“They didn't get strange when I hesitated.”", "“They dropped the price.”", "“They let me go home.”", "“They talked me into it.”"],
            answer: 0,
            why: "An objection is a door held open, not a rejection.",
          },
        ],
      },
    ],
  },
];

export function programWeek(week: number): TrainingWeek | undefined {
  return PROGRAM.find((w) => w.week === week);
}

/** Midnight Central on a day of a program week. */
export function dayDate(week: TrainingWeek, day: DayKey): Date {
  const [y, m, d] = week.start.split("-").map(Number) as [number, number, number];
  return central(y, m, d + DAY_ORDER.indexOf(day));
}

/** A day opens at midnight Central on its date, or always when the desk opens practice mode. */
export function dayOpen(week: TrainingWeek, day: DayKey, now: Date, openAll: boolean) {
  if (openAll) return true;
  return now.getTime() >= dayDate(week, day).getTime();
}

export function allJobs(week: TrainingWeek): Job[] {
  return week.days.flatMap((d) => d.jobs);
}
