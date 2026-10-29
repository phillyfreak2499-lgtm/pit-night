import type { BotBody, ClassId } from "@/lib/pit/types";

/** Shared visual side profile. Cosmetic geometry only; combat never reads this module. */
export type BotFrame = {
  /** Hull outline, bot lengths, +x forward, -y up, origin on the floor. */
  hull: [number, number][];
  deck: number;
  front: number;
  height: number;
  wheels: { x: number; r: number }[];
  treads: boolean;
};

export function botFrameOf(classId: ClassId, body?: BotBody): BotFrame {
  const id =
    body ?? (classId === "tank" ? "keystone" : classId === "specialist" ? "windlass" : "shrike");
  if (classId === "tank") {
    if (id === "juggernaut")
      return {
        hull: [
          [-0.52, -0.18],
          [-0.52, -0.43],
          [-0.36, -0.56],
          [0.23, -0.56],
          [0.5, -0.42],
          [0.5, -0.18],
        ],
        deck: -0.56,
        front: 0.5,
        height: 0.56,
        wheels: [-0.4, -0.2, 0, 0.2, 0.4].map((x) => ({ x, r: 0.075 })),
        treads: true,
      };
    if (id === "bunker")
      return {
        hull: [
          [-0.48, -0.18],
          [-0.48, -0.38],
          [-0.34, -0.46],
          [0.32, -0.46],
          [0.48, -0.32],
          [0.48, -0.18],
        ],
        deck: -0.46,
        front: 0.48,
        height: 0.46,
        wheels: [-0.36, -0.18, 0, 0.18, 0.36].map((x) => ({ x, r: 0.072 })),
        treads: true,
      };
    if (id === "fortress")
      return {
        hull: [
          [-0.5, -0.18],
          [-0.5, -0.46],
          [-0.38, -0.58],
          [-0.08, -0.62],
          [0.28, -0.57],
          [0.5, -0.4],
          [0.5, -0.18],
        ],
        deck: -0.62,
        front: 0.5,
        height: 0.62,
        wheels: [-0.38, -0.19, 0, 0.19, 0.38].map((x) => ({ x, r: 0.078 })),
        treads: true,
      };
    if (id === "colossus")
      return {
        hull: [
          [-0.54, -0.2],
          [-0.54, -0.48],
          [-0.42, -0.63],
          [0.12, -0.65],
          [0.38, -0.57],
          [0.54, -0.38],
          [0.54, -0.2],
        ],
        deck: -0.65,
        front: 0.54,
        height: 0.65,
        wheels: [-0.42, -0.21, 0, 0.21, 0.42].map((x) => ({ x, r: 0.08 })),
        treads: true,
      };
    return {
      hull: [
        [-0.46, -0.2],
        [-0.46, -0.46],
        [-0.3, -0.52],
        [0.3, -0.52],
        [0.46, -0.4],
        [0.46, -0.2],
      ],
      deck: -0.52,
      front: 0.46,
      height: 0.52,
      wheels: [-0.36, -0.18, 0, 0.18, 0.36].map((x) => ({ x, r: 0.075 })),
      treads: true,
    };
  }
  if (classId === "specialist") {
    if (id === "scorpion")
      return {
        hull: [
          [-0.44, -0.1],
          [-0.44, -0.38],
          [-0.3, -0.48],
          [0.08, -0.48],
          [0.28, -0.39],
          [0.46, -0.18],
          [0.46, -0.1],
        ],
        deck: -0.48,
        front: 0.46,
        height: 0.48,
        wheels: [
          { x: -0.27, r: 0.115 },
          { x: 0.22, r: 0.115 },
        ],
        treads: false,
      };
    if (id === "mantis")
      return {
        hull: [
          [-0.4, -0.1],
          [-0.4, -0.35],
          [-0.22, -0.43],
          [0.06, -0.43],
          [0.2, -0.55],
          [0.36, -0.48],
          [0.42, -0.14],
          [0.42, -0.1],
        ],
        deck: -0.55,
        front: 0.42,
        height: 0.55,
        wheels: [
          { x: -0.24, r: 0.11 },
          { x: 0.21, r: 0.11 },
        ],
        treads: false,
      };
    if (id === "phantom")
      return {
        hull: [
          [-0.45, -0.09],
          [-0.45, -0.31],
          [-0.28, -0.38],
          [0.16, -0.38],
          [0.46, -0.16],
          [0.46, -0.09],
        ],
        deck: -0.38,
        front: 0.46,
        height: 0.38,
        wheels: [
          { x: -0.28, r: 0.105 },
          { x: 0.22, r: 0.105 },
        ],
        treads: false,
      };
    if (id === "reaper")
      return {
        hull: [
          [-0.46, -0.1],
          [-0.46, -0.4],
          [-0.3, -0.51],
          [0.02, -0.51],
          [0.22, -0.58],
          [0.47, -0.2],
          [0.47, -0.1],
        ],
        deck: -0.58,
        front: 0.47,
        height: 0.58,
        wheels: [
          { x: -0.27, r: 0.118 },
          { x: 0.22, r: 0.118 },
        ],
        treads: false,
      };
    return {
      hull: [
        [-0.4, -0.11],
        [-0.4, -0.38],
        [-0.28, -0.44],
        [0.1, -0.44],
        [0.32, -0.34],
        [0.4, -0.16],
        [0.4, -0.11],
      ],
      deck: -0.44,
      front: 0.4,
      height: 0.44,
      wheels: [
        { x: -0.25, r: 0.12 },
        { x: 0.2, r: 0.12 },
      ],
      treads: false,
    };
  }
  if (id === "raptor")
    return {
      hull: [
        [-0.48, -0.09],
        [-0.48, -0.32],
        [-0.34, -0.39],
        [0.08, -0.39],
        [0.52, -0.1],
      ],
      deck: -0.39,
      front: 0.52,
      height: 0.39,
      wheels: [
        { x: -0.28, r: 0.125 },
        { x: 0.18, r: 0.125 },
      ],
      treads: false,
    };
  if (id === "stinger")
    return {
      hull: [
        [-0.43, -0.08],
        [-0.43, -0.27],
        [-0.28, -0.31],
        [0.1, -0.31],
        [0.49, -0.08],
      ],
      deck: -0.31,
      front: 0.49,
      height: 0.31,
      wheels: [
        { x: -0.25, r: 0.115 },
        { x: 0.17, r: 0.115 },
      ],
      treads: false,
    };
  if (id === "viper")
    return {
      hull: [
        [-0.49, -0.08],
        [-0.49, -0.3],
        [-0.32, -0.36],
        [0.14, -0.36],
        [0.54, -0.09],
      ],
      deck: -0.36,
      front: 0.54,
      height: 0.36,
      wheels: [
        { x: -0.28, r: 0.12 },
        { x: 0.19, r: 0.12 },
      ],
      treads: false,
    };
  if (id === "warhawk")
    return {
      hull: [
        [-0.5, -0.09],
        [-0.5, -0.36],
        [-0.34, -0.43],
        [-0.04, -0.46],
        [0.16, -0.39],
        [0.55, -0.1],
      ],
      deck: -0.46,
      front: 0.55,
      height: 0.46,
      wheels: [
        { x: -0.29, r: 0.125 },
        { x: 0.2, r: 0.125 },
      ],
      treads: false,
    };
  return {
    hull: [
      [-0.46, -0.1],
      [-0.46, -0.3],
      [-0.36, -0.34],
      [0.08, -0.34],
      [0.44, -0.13],
      [0.44, -0.1],
    ],
    deck: -0.34,
    front: 0.44,
    height: 0.34,
    wheels: [
      { x: -0.27, r: 0.13 },
      { x: 0.17, r: 0.13 },
    ],
    treads: false,
  };
}
