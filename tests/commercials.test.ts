import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  AD_MS,
  COMMERCIALS,
  COMMERCIAL_ROTATION_BLOCK,
  commercialAfter,
  commercialAfterFight,
  commercialAt,
  commercialVideoSrc,
  commercialsForCard,
} from "../src/lib/pit/commercials.ts";

const SCRIPT = [
  "Got flipped? Got sawed? Got personally insulted by a hammer?",
  "Pit Mutual. We cover everything except fire, saws, flipping, hammers, and the pit. Mostly the paperwork.",
  "Made with 400% of your daily recommended sparks. Not for humans. Barely for robots.",
  "VOLTAGE. Side effects include winning, smoking, and a suddenly void warranty.",
  "Lost an arm? Sal's got arms. Lost a wheel? Sal's got wheels. Don't ask where Sal gets 'em.",
  "Sal's. Previously loved parts. Very recently loved.",
  "Is your Logic brain overthinking? Is your Berserker emotionally unavailable?",
  "Have you tried turning your bot off and on again? 50% chance it comes back angrier.",
  "Brain-Be-Gone. Unplug responsibly.",
  "Monday's damage report hurt? Call 1-800-BOLT-ON. Operators are standing by, mostly because their legs fell off.",
  "No coins? No problem. Also no repairs.",
  "After a long day of being punched by a chainsaw, your bot deserves rest.",
  "Nap Pod 3000. Now with optional lid.",
  "The lid locks from the outside.",
  "Got a coffee can full of loose Bolts rattling around the garage?",
  "First National Bolt Bank. Ten Bolts, one coin. Up to five coins a week.",
  "Bolt Bank. We count, so you don't have to.",
  "We also can't count.",
  "This Thanksgiving, don't let your bot be the driest thing at the table.",
  "Gobble-Grade Gear Grease. Made from 100% leftover gravy. Fewer squeaks, smoother joints, and a faint smell of stuffing.",
  "Gobble-Grade. Pass it to the left.",
  "Switching from Tank to Striker? Striker to Specialist? Specialist to… whatever that was?",
  "Class Act Movers! We pack your bot, label every bolt, and only lose the important ones.",
  "One hundred twenty Bolts and a strong back!",
  "Specialists are supposed to keep their distance. The claw, unfortunately, did not get the memo.",
  "Rios Reach. Shreveport's Daniel Rios measures twice, grabs once, and gives RED RIVER just enough arm to be polite.",
  "Rios Reach. Stand back. He already did.",
  "The tank looks ready. It isn't. The last cotter pin would like a word.",
  "Philip's Extra Pass. Abilene specialist Philip Rodriguez walks KEY CITY one more time and only then says now.",
  "Philip's Extra Pass. Once is how you lose a nut.",
  "The nut was important.",
  "Forgot the finishing touch? ROSE CITY never does, if Samantha's in the bay.",
  "Samantha's Spare Rose. Tyler specialist Samantha Rodriguez keeps one extra bouquet in the locker, just in case Monday needs a little ceremony.",
  "Samantha's Spare Rose. Armor first. Flowers second.",
  "Some captains have a name. Southlake's has a job title.",
  "The Machine runs SEACHICKEN like clockwork: oiled, locked, and loudly unbothered.",
  "The Machine's Maintenance Plan. Results not human.",
  "We asked. It just said beep.",
  "Double plat. Double smash. Double-check the paperwork.",
  "Alliance specialist Helen keeps DOUBLE PLAT SMASHER cleared, cleaned and ready for Monday.",
  "Helen's Hall Pass. No bot fights without it.",
  "TEMPLETRON lost a bolt. Scott found three. Nobody asks where.",
  "Temple specialist Scott keeps the bay stocked so TEMPLETRON never fights short a part.",
  "Scott's Spare Parts. If it fell off, he's got it.",
  "Probably.",
];

function breaks(fightCount: number): number[] {
  return Array.from({ length: fightCount }, (_, i) => i + 1).filter((fight) => commercialAfterFight(fight, fightCount));
}

test("a house spot runs between every bout except after the main event", () => {
  assert.equal(COMMERCIAL_ROTATION_BLOCK, 6);
  assert.equal(COMMERCIALS.length, 15);
  assert.equal(AD_MS, 15_000);
  assert.deepEqual(breaks(7), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(breaks(8), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(breaks(9), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(breaks(6), [1, 2, 3, 4, 5]);
  assert.deepEqual(breaks(4), [1, 2, 3]);
  assert.deepEqual(breaks(3), [1, 2]);
  assert.deepEqual(breaks(2), [1]);
  assert.deepEqual(breaks(1), []);
  assert.equal(commercialAfterFight(1, 7), true);
  assert.equal(commercialAfterFight(2, 7), true);
  assert.equal(commercialAfterFight(5, 7), true);
  assert.equal(commercialAfterFight(6, 7), true);
  assert.equal(commercialAfterFight(7, 7), false);
  assert.equal(commercialAfterFight(6, 6), false);
  assert.equal(commercialAfterFight(8, 8), false);
  assert.equal(commercialAfterFight(7, 8), false);
  assert.equal(commercialAfterFight(0, 7), false);
  assert.equal(commercialAfterFight(8, 7), false);
  assert.equal(commercialAfterFight(2.5, 7), false);
  assert.equal(commercialAfterFight(2, 7.5), false);
});

const CATALOG = [
  "pit-mutual",
  "voltage",
  "scrapyard-sals",
  "brain-be-gone",
  "repair-hotline",
  "nap-pod-3000",
  "bolt-bank",
  "gobble-grade",
  "class-act-movers",
  "rios-reach",
  "philips-extra-pass",
  "samanthas-spare-rose",
  "the-machine",
  "helens-hall-pass",
  "scotts-spare-parts",
];

/** Three-spot reels. A seven-bout card plays the reel twice. Week 3 is the six-spot premiere. */
const REELS: Record<number, readonly string[]> = {
  1: ["pit-mutual", "voltage", "scrapyard-sals"],
  2: ["bolt-bank", "gobble-grade", "class-act-movers"],
  4: ["pit-mutual", "voltage", "scrapyard-sals"],
  5: ["bolt-bank", "gobble-grade", "class-act-movers"],
};

const WEEK_3 = [
  "rios-reach",
  "philips-extra-pass",
  "samanthas-spare-rose",
  "the-machine",
  "helens-hall-pass",
  "scotts-spare-parts",
];

function slugs(week: number, fights = 7) {
  return commercialsForCard(week, fights).map((ad) => ad.slug);
}

function playedTwice(reel: readonly string[]) {
  return [...reel, ...reel];
}

test("the weekly reel rotates, keeps weeks 1 and 2, and gives week 3 spots 10–15", () => {
  assert.deepEqual(
    COMMERCIALS.map((ad) => ad.slug),
    CATALOG,
  );
  assert.deepEqual(
    COMMERCIALS.map((ad) => ad.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  );
  for (const [week, reel] of Object.entries(REELS)) {
    const card = slugs(Number(week));
    assert.deepEqual(card, playedTwice(reel));
    assert.deepEqual(commercialsForCard(Number(week), 7).map((ad) => ad.number), [
      ...reel.map((slug) => CATALOG.indexOf(slug) + 1),
      ...reel.map((slug) => CATALOG.indexOf(slug) + 1),
    ]);
    assert.equal(commercialAfter(Number(week), 7, 7), null);
  }
  assert.deepEqual(slugs(3), WEEK_3);
  assert.deepEqual(
    commercialsForCard(3, 7).map((ad) => ad.number),
    [10, 11, 12, 13, 14, 15],
  );
  assert.equal(commercialAfter(3, 7, 7), null);
  assert.equal(commercialAfter(3, 1, 7)?.slug, "rios-reach");
  assert.equal(commercialAfter(3, 6, 7)?.slug, "scotts-spare-parts");
  assert.deepEqual(slugs(3, 9), WEEK_3);
  assert.deepEqual(slugs(1), playedTwice(REELS[1]!));
  assert.deepEqual(slugs(0), slugs(1));
  assert.deepEqual(slugs(-4), slugs(1));
  assert.deepEqual(slugs(2), playedTwice(REELS[2]!));
  assert.deepEqual(slugs(6), playedTwice(["brain-be-gone", "repair-hotline", "nap-pod-3000"]));
  assert.deepEqual(slugs(99), slugs(6));
  assert.deepEqual(slugs(5, 1), []);
  assert.equal(commercialAfter(5, 1, 1), null);
  assert.deepEqual(slugs(5, 2), ["bolt-bank"]);
  assert.deepEqual(slugs(2, 5), ["bolt-bank", "gobble-grade", "class-act-movers", "bolt-bank"]);
  assert.deepEqual(slugs(2, 4), ["bolt-bank", "gobble-grade", "class-act-movers"]);
  assert.deepEqual(slugs(1, 9), playedTwice(REELS[1]!));
  assert.equal(commercialAfter(1, 1, 7)?.slug, "pit-mutual");
  assert.equal(commercialAfter(1, 2, 7)?.slug, "voltage");
  assert.equal(commercialAfter(1, 3, 7)?.slug, "scrapyard-sals");
  assert.equal(commercialAfter(1, 4, 7)?.slug, "pit-mutual");
  assert.equal(commercialAfter(1, 6, 7)?.slug, "scrapyard-sals");
  assert.equal(commercialAfter(2, 1, 7)?.number, 7);
  assert.equal(commercialAfter(2, 2, 7)?.slug, "gobble-grade");
  assert.equal(commercialAfter(2, 3, 7)?.slug, "class-act-movers");
  assert.equal(commercialAfter(2, 6, 7)?.slug, "class-act-movers");
  assert.equal(commercialAt(1, 0).slug, "pit-mutual");
  assert.equal(commercialAt(2, 0).slug, "bolt-bank");
  assert.equal(commercialAt(2, 3).slug, commercialAt(2, 0).slug);
  assert.equal(commercialAt(3, 0).slug, "rios-reach");
  assert.equal(commercialAt(3, 5).slug, "scotts-spare-parts");
  assert.equal(commercialAt(3, 6).slug, commercialAt(3, 0).slug);
  assert.equal(commercialAt(4, 0).slug, "pit-mutual");
  assert.deepEqual(slugs(2), slugs(2));
  assert.deepEqual(slugs(3), slugs(3));
  assert.deepEqual(slugs(4), slugs(1));
  assert.deepEqual(slugs(5), slugs(2));
  assert.deepEqual(
    COMMERCIALS.map((ad) => commercialVideoSrc(ad)),
    CATALOG.map((slug) => `/ads/${slug}.mp4`),
  );
  for (const ad of COMMERCIALS) {
    assert.equal(existsSync(new URL(`../public/ads/${ad.slug}.mp4`, import.meta.url)), true);
  }
  const budget = Math.max(
    ...CATALOG.slice(0, 9).map((slug) => statSync(new URL(`../public/ads/${slug}.mp4`, import.meta.url)).size),
  );
  for (const slug of WEEK_3) {
    const size = statSync(new URL(`../public/ads/${slug}.mp4`, import.meta.url)).size;
    assert.ok(size <= budget, `${slug} is ${size} bytes, over the ${budget}-byte ad budget`);
  }
  for (let week = 1; week <= 12; week++) {
    const here = new Set(slugs(week));
    const next = new Set(slugs(week + 1));
    for (const slug of here) assert.equal(next.has(slug), false, `week ${week} repeats ${slug}`);
    assert.equal(here.size, week === 3 ? 6 : 3);
  }
  const classic = new Set([4, 5, 6].flatMap((week) => slugs(week)));
  assert.equal(classic.size, 9);
  assert.deepEqual(new Set(slugs(3)), new Set(WEEK_3));
});

test("a short week 3 card stays on the new spots and week 4 leads with the rest", () => {
  assert.deepEqual(slugs(3, 4), WEEK_3.slice(0, 3));
  assert.deepEqual(slugs(4, 4), WEEK_3.slice(3));
  assert.deepEqual(slugs(3, 5), WEEK_3.slice(0, 4));
  assert.deepEqual(slugs(4, 5), [...WEEK_3.slice(4), "pit-mutual", "voltage"]);
  assert.deepEqual(slugs(3, 6), WEEK_3.slice(0, 5));
  assert.deepEqual(slugs(4, 6), [
    "scotts-spare-parts",
    "pit-mutual",
    "voltage",
    "scrapyard-sals",
    "scotts-spare-parts",
  ]);
  assert.deepEqual(slugs(3, 3), WEEK_3.slice(0, 2));
  assert.deepEqual(slugs(4, 3), WEEK_3.slice(2, 4));
  assert.deepEqual(slugs(3, 2), [WEEK_3[0]]);
  assert.deepEqual(slugs(4, 2), [WEEK_3[1]]);
  assert.deepEqual(slugs(5, 4), ["bolt-bank", "gobble-grade", "class-act-movers"]);
  for (const fights of [2, 3, 4, 5, 6, 7, 8]) {
    const week3 = slugs(3, fights);
    const week4 = new Set(slugs(4, fights));
    const week5 = new Set(slugs(5, fights));
    for (const slug of week3) {
      assert.equal(WEEK_3.includes(slug), true, `${slug} is not a week 3 spot`);
      assert.equal(week4.has(slug), false, `${fights} fights repeats ${slug} into week 4`);
    }
    for (const slug of week4) {
      assert.equal(week5.has(slug), false, `week 4/5 ${fights} fights repeats ${slug}`);
    }
  }
  assert.deepEqual(slugs(1, 3), ["pit-mutual", "voltage"]);
  assert.deepEqual(slugs(2, 3), ["bolt-bank", "gobble-grade"]);
  assert.deepEqual(slugs(1, 7), slugs(1));
  assert.deepEqual(slugs(2, 7), slugs(2));
});

test("commercial copy stays on the approved script", () => {
  const lines = COMMERCIALS.flatMap((ad) => ad.lines.map((line) => line.text));
  assert.deepEqual(lines, SCRIPT);
  assert.equal(COMMERCIALS[0]?.fine?.includes("EXCLUDES FIRE"), true);
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "pit-mutual")?.lines.find((line) => line.tone === "vo")?.text.includes("Mostly the paperwork."), true);
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "nap-pod-3000")?.lines.at(-1)?.tone, "aside");
  const bank = COMMERCIALS.find((ad) => ad.slug === "bolt-bank");
  const gravy = COMMERCIALS.find((ad) => ad.slug === "gobble-grade");
  const movers = COMMERCIALS.find((ad) => ad.slug === "class-act-movers");
  assert.equal(bank?.scene, "bank");
  assert.equal(gravy?.scene, "gravy");
  assert.equal(movers?.scene, "movers");
  assert.equal(bank?.sponsor, "First National Bolt Bank");
  assert.equal(gravy?.sponsor, "Gobble-Grade Gear Grease");
  assert.equal(movers?.sponsor, "Class Act Movers");
  assert.match(bank?.fine ?? "", /10 Bolts = 1 coin/);
  assert.match(gravy?.fine ?? "", /Not a food/);
  assert.match(movers?.fine ?? "", /Class switch fee: 120 Bolts/);
  assert.equal(bank?.lines.at(-1)?.tone, "aside");
  const premiere = [
    ["rios-reach", "reach", "Rios Reach", /not a spare part/],
    ["philips-extra-pass", "extra-pass", "Philip's Extra Pass", /Not responsible for hammers/],
    ["samanthas-spare-rose", "roses", "Samantha's Spare Rose", /Not a weapon/],
    ["the-machine", "machine", "The Machine's Maintenance Plan", /Results not human/],
    ["helens-hall-pass", "hall-pass", "Helen's Hall Pass", /One pass per fight/],
    ["scotts-spare-parts", "spare-parts", "Scott's Spare Parts", /Asking where voids the pile/],
  ] as const;
  for (const [slug, scene, sponsor, fine] of premiere) {
    const ad = COMMERCIALS.find((item) => item.slug === slug);
    assert.equal(ad?.scene, scene);
    assert.equal(ad?.sponsor, sponsor);
    assert.match(ad?.fine ?? "", fine);
  }
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "philips-extra-pass")?.lines.at(-1)?.tone, "aside");
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "the-machine")?.lines.at(-1)?.tone, "aside");
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "scotts-spare-parts")?.lines.at(-1)?.tone, "aside");
});

test("the watch party cuts to an ad stage and can fall back when the file is missing", () => {
  const watch = readFileSync(new URL("../src/components/pit/watch-page.tsx", import.meta.url), "utf8");
  const spot = readFileSync(new URL("../src/components/pit/commercial.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(watch, /"lobby" \| "pregame" \| "opening" \| "intro" \| "fight" \| "result" \| "ad" \| "final"/);
  assert.match(watch, /commercialAfter\(week, index \+ 1, bouts\.length\)/);
  assert.match(watch, /A house commercial runs between every fight/);
  assert.doesNotMatch(watch, /every other fight/);
  const faq = readFileSync(new URL("../src/components/pit/faq-page.tsx", import.meta.url), "utf8");
  assert.match(faq, /a house commercial runs between every fight/);
  assert.doesNotMatch(faq, /every other fight/);
  assert.match(watch, /setStage\("ad"\)/);
  assert.match(watch, /stage === "ad"/);
  assert.match(watch, /<Commercial/);
  assert.match(watch, /stage === "lobby" \|\| stage === "final" \|\| stage === "fight" \|\| stage === "ad"/);
  assert.match(watch, /e\.key === " "/);
  assert.match(watch, /e\.key === "ArrowRight"/);
  assert.match(spot, /armBroadcastAudio/);
  assert.match(spot, /soundMuted/);
  assert.match(spot, /commercialVideoSrc/);
  assert.match(spot, /onError/);
  assert.match(spot, /onEnded/);
  assert.match(spot, /AD_MS/);
  assert.match(spot, /prefers-reduced-motion/);
  assert.match(spot, /data-testid="watch-ad"/);
  assert.match(spot, /data-testid="watch-ad-skip"/);
  assert.match(spot, /data-testid="watch-ad-fallback"/);
  assert.match(styles, /\/\* Watch party commercials \*\//);
  const commercialsCss = styles.slice(styles.indexOf("/* Watch party commercials */"));
  assert.match(commercialsCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(commercialsCss, /\.ad-line/);
  assert.match(commercialsCss, /\.ad-fine-track/);
  assert.match(commercialsCss, /\.ad-flash/);
  const art = readFileSync(new URL("../src/components/pit/commercial-art.ts", import.meta.url), "utf8");
  for (const scene of [
    "mutual",
    "voltage",
    "sals",
    "brain",
    "hotline",
    "nap",
    "bank",
    "gravy",
    "movers",
    "reach",
    "extra-pass",
    "roses",
    "machine",
    "hall-pass",
    "spare-parts",
  ]) {
    assert.match(art, new RegExp(`case "${scene}"`));
    assert.match(art, new RegExp(`^  "?${scene}"?:`, "m"));
  }
  for (const paint of ["paintReach", "paintExtraPass", "paintRoses", "paintMachine", "paintHallPass", "paintSpareParts"]) {
    assert.match(art, new RegExp(`function ${paint}`));
  }
  const broadcast = readFileSync(new URL("../src/components/pit/broadcast.tsx", import.meta.url), "utf8");
  const motion = readFileSync(new URL("../src/components/pit/cage-motion.ts", import.meta.url), "utf8");
  assert.equal(broadcast.includes("commercialAfter"), false);
  assert.equal(motion.includes("commercialAfter"), false);
});
