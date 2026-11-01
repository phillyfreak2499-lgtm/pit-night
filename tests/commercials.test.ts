import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
];

function breaks(fightCount: number): number[] {
  return Array.from({ length: fightCount }, (_, i) => i + 1).filter((fight) => commercialAfterFight(fight, fightCount));
}

test("a house spot runs after every second fight except the last", () => {
  assert.equal(COMMERCIAL_ROTATION_BLOCK, 3);
  assert.equal(AD_MS, 15_000);
  assert.deepEqual(breaks(7), [2, 4, 6]);
  assert.deepEqual(breaks(8), [2, 4, 6]);
  assert.deepEqual(breaks(9), [2, 4, 6, 8]);
  assert.deepEqual(breaks(6), [2, 4]);
  assert.deepEqual(breaks(4), [2]);
  assert.deepEqual(breaks(3), [2]);
  assert.deepEqual(breaks(2), []);
  assert.deepEqual(breaks(1), []);
  assert.equal(commercialAfterFight(2, 7), true);
  assert.equal(commercialAfterFight(7, 7), false);
  assert.equal(commercialAfterFight(6, 6), false);
  assert.equal(commercialAfterFight(8, 8), false);
  assert.equal(commercialAfterFight(1, 7), false);
  assert.equal(commercialAfterFight(5, 7), false);
  assert.equal(commercialAfterFight(0, 7), false);
  assert.equal(commercialAfterFight(8, 7), false);
  assert.equal(commercialAfterFight(2.5, 7), false);
  assert.equal(commercialAfterFight(2, 7.5), false);
});

test("week 1 plays spots 1-3 and week 2 plays spots 4-6, then the reel repeats", () => {
  const slugs = (week: number, fights = 7) => commercialsForCard(week, fights).map((ad) => ad.slug);
  assert.deepEqual(
    COMMERCIALS.map((ad) => ad.slug),
    ["pit-mutual", "voltage", "scrapyard-sals", "brain-be-gone", "repair-hotline", "nap-pod-3000"],
  );
  assert.deepEqual(slugs(1), ["pit-mutual", "voltage", "scrapyard-sals"]);
  assert.deepEqual(slugs(2), ["brain-be-gone", "repair-hotline", "nap-pod-3000"]);
  assert.deepEqual(slugs(3), slugs(1));
  assert.deepEqual(slugs(4), slugs(2));
  assert.deepEqual(slugs(5, 1), []);
  assert.equal(commercialAfter(5, 1, 1), null);
  assert.deepEqual(slugs(2, 5), ["brain-be-gone", "repair-hotline"]);
  assert.deepEqual(slugs(2, 4), ["brain-be-gone"]);
  assert.deepEqual(slugs(1, 9), ["pit-mutual", "voltage", "scrapyard-sals", "brain-be-gone"]);
  assert.equal(commercialAfter(1, 2, 7)?.number, 1);
  assert.equal(commercialAfter(1, 4, 7)?.number, 2);
  assert.equal(commercialAfter(1, 6, 7)?.number, 3);
  assert.equal(commercialAfter(1, 7, 7), null);
  assert.equal(commercialAfter(2, 2, 7)?.slug, "brain-be-gone");
  assert.equal(commercialAt(1, 0), commercialAt(1, 0));
  assert.deepEqual(slugs(2), slugs(2));
  assert.deepEqual(
    COMMERCIALS.map((ad) => commercialVideoSrc(ad)),
    [
      "/ads/pit-mutual.mp4",
      "/ads/voltage.mp4",
      "/ads/scrapyard-sals.mp4",
      "/ads/brain-be-gone.mp4",
      "/ads/repair-hotline.mp4",
      "/ads/nap-pod-3000.mp4",
    ],
  );
  for (const week of [0, -4, 1, 2, 99]) {
    for (const ad of commercialsForCard(week, 7)) assert.ok(COMMERCIALS.includes(ad));
  }
});

test("commercial copy stays on the approved script", () => {
  const lines = COMMERCIALS.flatMap((ad) => ad.lines.map((line) => line.text));
  assert.deepEqual(lines, SCRIPT);
  assert.equal(COMMERCIALS[0]?.fine?.includes("EXCLUDES FIRE"), true);
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "pit-mutual")?.lines.find((line) => line.tone === "vo")?.text.includes("Mostly the paperwork."), true);
  assert.equal(COMMERCIALS.find((ad) => ad.slug === "nap-pod-3000")?.lines.at(-1)?.tone, "aside");
});

test("the watch party cuts to an ad stage and can fall back when the file is missing", () => {
  const watch = readFileSync(new URL("../src/components/pit/watch-page.tsx", import.meta.url), "utf8");
  const spot = readFileSync(new URL("../src/components/pit/commercial.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(watch, /"lobby" \| "intro" \| "fight" \| "result" \| "ad" \| "final"/);
  assert.match(watch, /commercialAfter\(week, index \+ 1, bouts\.length\)/);
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
  const broadcast = readFileSync(new URL("../src/components/pit/broadcast.tsx", import.meta.url), "utf8");
  const motion = readFileSync(new URL("../src/components/pit/cage-motion.ts", import.meta.url), "utf8");
  assert.equal(broadcast.includes("commercialAfter"), false);
  assert.equal(motion.includes("commercialAfter"), false);
});
