import { z } from "zod";
import type { PitData, Session } from "./types";
import { FINISH_IDS, SMOKE_IDS, STICKER_ART, TOPPER_IDS, type BotDecal } from "./types";

const decalValues = [
  ...STICKER_ART,
  ...STICKER_ART.flatMap((id): BotDecal[] => (id === "none" ? [] : [`${id}-foil`])),
] as [BotDecal, ...BotDecal[]];
const decal = z.enum(decalValues);
const finish = z.enum(FINISH_IDS);
const topper = z.enum(TOPPER_IDS);
const smoke = z.enum(SMOKE_IDS);
const leds = z.enum(["none", "nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"]);

const id = z.string().min(1).max(120);
const text = z.string().max(500);
const week = z.number().int().min(1).max(5);
const slot = z.enum(["chassis", "armor", "drive", "weapon", "utility", "brain"]);
const stat = z.enum(["nsnu", "conv", "demoRate", "demoClose", "arch", "ticket"]);
const grade = z.enum(["green", "blue", "orange", "red"]).nullable();
const loadout = z
  .object({ chassis: id, armor: id, drive: id, weapon: id, utility: id.nullable(), brain: id })
  .strict();
const card = z
  .object({
    nsnu: z.number().min(0).max(1000000).optional(),
    conv: z.number().min(0).max(100).optional(),
    demoRate: z.number().min(0).max(100).optional(),
    demoClose: z.number().min(0).max(100).optional(),
    arch: z.number().min(0).max(100).optional(),
    demoTicket: z.number().min(0).max(100000).optional(),
  })
  .strict();
const body = z.enum(["shrike","raptor","stinger","viper","warhawk","keystone","juggernaut","bunker","fortress","colossus","windlass","scorpion","mantis","phantom","reaper"]);
const style = z
  .object({
    body: body.optional(),
    topper: topper.optional(),
    trim: id.optional(),
    eye: id.optional(),
    finish: finish.optional(),
    decal: decal.optional(),
    flag: z.boolean().optional(),
    stickers: z.object({ left: decal, right: decal, hood: decal, rear: decal }).strict().optional(),
    leds: leds.optional(),
    smoke: smoke.optional(),
    banner: z.string().max(12).optional(),
    walkout: z.enum(["", "walkout-pyro", "walkout-smoke", "walkout-sparks"]).optional(),
    victory: z.enum(["", "victory-confetti", "victory-fireworks"]).optional(),
  })
  .strict();
export const cosmeticLoadoutSchema = z.object({
  paint: id, look: z.enum(["plain", "stripe", "chevron", "rivets"]),
  number: z.string().max(3), style: style.required({ finish: true, decal: true, trim: true, eye: true, flag: true }),
}).strict();
export const commandArgs = {
  setSticker: z.tuple([id, z.enum(["left", "right", "hood", "rear"]), decal]),
  proposeCosmetic: z.tuple([id, cosmeticLoadoutSchema]),
  voteCosmetic: z.tuple([id]),
  acceptCosmetic: z.tuple([id]),
  chooseStarterBody: z.tuple([id, z.enum(["striker","tank","specialist"]), body]),
  setDraftPart: z.tuple([id, slot, id.nullable()]),
  setDraftLoadout: z.tuple([id, loadout]),
  lockStore: z.tuple([id]),
  unlockStore: z.tuple([id]),
  updateCard: z.tuple([id, card]),
  setOfficialNsnu: z.tuple([id, z.number().min(0).max(1000000)]),
  setGrade: z.tuple([id, stat, grade]),
  setKickoffGrade: z.tuple([id, stat, grade]),
  applyKickoff: z.tuple([]),
  propose: z.tuple([id, id, text]),
  acceptProposal: z.tuple([id]),
  dismissProposal: z.tuple([id]),
  buyPart: z.tuple([id, id]),
  repairSlot: z.tuple([id, slot, z.enum(["full", "weld", "salvage", "crown"])]),
  nameMvp: z.tuple([id, id]),
  renameBot: z.tuple([id, text]),
  // eslint-disable-next-line no-control-regex -- names cannot contain control characters
  renameIdentity: z.tuple([id, z.string().trim().min(1).max(22).regex(/^[^\u0000-\u001f\u007f]+$/), z.string().trim().min(1).max(40).regex(/^[^\u0000-\u001f\u007f]+$/)]),
  renameCaptain: z.tuple([id, text]),
  setPaint: z.tuple([id, id]),
  setGarage: z.tuple([id, z.enum(["hazard", "concrete", "night", "bone", "checker"])]),
  setLook: z.tuple([id, z.enum(["plain", "stripe", "chevron", "rivets"])]),
  setStyle: z.tuple([id, style]),
  completeJob: z.tuple([week, id, text]),
  approveJob: z.tuple([id]),
  rejectJob: z.tuple([id]),
  submitSpark: z.tuple([
    week,
    z.enum(["tue", "wed", "thu", "fri", "sat"]),
    z.array(z.number().int().min(0).max(8)).length(3),
  ]),
  postShout: z.tuple([text, text]),
  removeShout: z.tuple([id]),
  setCrewOff: z.tuple([id, week, z.boolean()]),
  setTrainingOpenAll: z.tuple([z.boolean()]),
  buyLocker: z.tuple([id, id]),
  makePick: z.tuple([id, id]),
  setRally: z.tuple([id]),
  setNumber: z.tuple([id, text]),
  renameCrew: z.tuple([id, text]),
  addCrew: z.tuple([id, text]),
  removeCrew: z.tuple([id, id]),
  pullSpy: z.tuple([id, id]),
  callSpy: z.tuple([id, id, id]),
  setTags: z.tuple([week, z.boolean()]),
  setTagline: z.tuple([text]),
  houseCall: z.tuple([text]),
  lockFriday: z.tuple([]),
  runSaturday: z.tuple([]),
  dropDamage: z.tuple([]),
  advanceWeek: z.tuple([]),
  resetSeason: z.tuple([]),
} as const;
export type Command = keyof typeof commandArgs;
const desk = new Set<Command>([
  "unlockStore",
  "updateCard",
  "setGrade",
  "setKickoffGrade",
  "applyKickoff",
  "setTrainingOpenAll",
  "setTags",
  "setTagline",
  "houseCall",
  "lockFriday",
  "runSaturday",
  "dropDamage",
  "advanceWeek",
  "resetSeason",
]);
const personal = new Set<Command>([
  "proposeCosmetic", "voteCosmetic",
  "chooseStarterBody",
  "propose",
  "completeJob",
  "submitSpark",
  "postShout",
  "makePick",
  "setRally",
]);
export function authorize(data: PitData, session: Session, name: Command, args: unknown[]) {
  if (session.role === "public") throw new Error("Sign in on the Clipboard first.");
  if (session.role === "commissioner") return;
  const member = data.crew.find((c) => c.id === session.crewId && c.storeId === session.storeId);
  if (!member || member.role !== (session.role === "captain" ? "captain" : "specialist"))
    throw new Error("Session roster changed. Sign in again.");
  if (desk.has(name)) throw new Error("Only the Desk can do that.");
  if (name === "setOfficialNsnu") throw new Error("Only the Desk records official NSNU.");
  if (personal.has(name)) {
    if (name === "proposeCosmetic" && args[0] !== session.storeId)
      throw new Error("This is another store's bay.");
    if (name === "voteCosmetic" && data.cosmeticProposals?.find(p => p.id === args[0] && p.status === "open")?.storeId !== session.storeId)
      throw new Error("This is another store's proposal or voting has closed.");
    if (name === "chooseStarterBody" && args[0] !== session.storeId)
      throw new Error("This is another store's bay.");
    if (name === "propose" && args[0] !== session.storeId)
      throw new Error("This is another store's bay.");
    return;
  }
  if (session.role !== "captain") throw new Error("Only a captain can do that.");
  let storeId = args[0];
  if (name === "acceptCosmetic") storeId = data.cosmeticProposals?.find(p => p.id === args[0])?.storeId;
  if (["approveJob", "rejectJob"].includes(name))
    storeId = data.jobLog.find((e) => e.id === args[0])?.storeId;
  if (["acceptProposal", "dismissProposal"].includes(name))
    storeId = data.proposals.find((e) => e.id === args[0])?.storeId;
  if (["setCrewOff", "renameCrew"].includes(name))
    storeId = data.crew.find((e) => e.id === args[0])?.storeId;
  if (name === "removeShout") storeId = data.shouts.find((e) => e.id === args[0])?.storeId;
  if (storeId !== session.storeId) throw new Error("This is another store's bay.");
}
