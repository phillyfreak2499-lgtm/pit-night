import * as THREE from "three";
import { EYES, PAINT, TRIM, styleOf } from "@/lib/pit/catalog";
import type { BotBody } from "@/lib/pit/types";
import type { BotLookProps } from "../bot-portrait";
import { botFrameOf } from "../bot-frame";
import { sawPoseOf } from "../bot-weapons";
import { createGarageCosmetics } from "./cosmetics";

type Vec = [number, number, number];
type Profile = {
  width: number;
  detail: "low" | "long" | "split" | "block" | "tiered";
};

/** Width/detail complete the shared side profile; these never enter the combat model. */
export const GARAGE_BODY_PROFILES: Record<BotBody, Profile> = {
  shrike: { width: 1.34, detail: "low" },
  raptor: { width: 1.42, detail: "long" },
  stinger: { width: 1.16, detail: "split" },
  viper: { width: 1.27, detail: "low" },
  warhawk: { width: 1.5, detail: "split" },
  keystone: { width: 1.48, detail: "block" },
  juggernaut: { width: 1.55, detail: "block" },
  bunker: { width: 1.65, detail: "low" },
  fortress: { width: 1.66, detail: "tiered" },
  colossus: { width: 1.74, detail: "tiered" },
  windlass: { width: 1.39, detail: "block" },
  scorpion: { width: 1.31, detail: "long" },
  mantis: { width: 1.21, detail: "split" },
  phantom: { width: 1.37, detail: "low" },
  reaper: { width: 1.46, detail: "split" },
};

/** Complete family lists make unsupported new catalog entries detectable in tests. */
export const GARAGE_MODEL_FAMILIES = {
  weapon: [
    "saw",
    "drum",
    "wedge",
    "hammer",
    "claw",
    "disc",
    "chainsaw",
    "slasher",
    "ghost",
    "launcher",
    "bones",
    "broom",
    "carver",
    "yamcannon",
    "axe",
    "rivetgun",
    "crusher",
    "flail",
    "piston",
    "flame",
    "tesla",
  ],
  drive: [
    "mag",
    "omni",
    "treads",
    "flip",
    "ghostchaser",
    "swerve",
    "rocket",
    "anchor",
    "air",
    "haywagon",
  ],
  armor: [
    "plate",
    "skirt",
    "angle",
    "cage",
    "ablative",
    "gel",
    "chain",
    "spike",
    "ceramic",
    "magnet",
    "reactive",
    "platter",
  ],
  chassis: [
    "shrike",
    "keystone",
    "windlass",
    "pumpkin",
    "harvesttable",
    "hover",
    "spring",
    "skeleton",
    "sprinter",
    "hornet",
    "hybrid",
    "dynamo",
    "scorpion",
    "crab",
    "capacitor",
    "mule",
    "monolith",
    "reactor",
  ],
  utility: [
    "burn",
    "peace",
    "crowd",
    "weld",
    "scry",
    "spotlight",
    "decoy",
    "oil",
    "medbay",
    "leech",
    "tremor",
    "blackout",
    "grapple",
    "siren",
    "mirror",
    "veil",
    "smoke",
    "uv",
  ],
} as const;

/** One self-contained model: all geometry/materials belong to this group and may be disposed. */
export function createGarageBot(look: BotLookProps): THREE.Group {
  const style = styleOf(look, look.classId);
  const profile = GARAGE_BODY_PROFILES[style.body ?? "shrike"] ?? GARAGE_BODY_PROFILES.shrike;
  const frame = botFrameOf(look.classId, style.body);
  const unit = 2;
  const w = profile.width;
  const rear = Math.min(...frame.hull.map(([x]) => x)) * unit;
  const front = frame.front * unit;
  const d = front - rear;
  const h = -frame.deck * unit;
  const hullBottom = -Math.max(...frame.hull.map(([, y]) => y)) * unit;
  const nose = -Math.min(...frame.hull.filter(([x]) => x === frame.front).map(([, y]) => y)) * unit;
  const bot = new THREE.Group();
  bot.name = `${look.storeName} · ${style.body} garage bot`;
  bot.userData = {
    frontAxis: "+Z",
    body: style.body,
    weaponFamily: look.weapon,
    driveFamily: look.driveFamily,
    armorFamily: look.armorFamily,
    chassisFamily: look.chassisFamily,
    utilityFamily: look.utilityFamily,
  };
  const metal = (color: THREE.ColorRepresentation, roughness = 0.38, metalness = 0.8) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const color = PAINT[look.paint] ?? PAINT.amber;
  const finish = style.finish;
  const paint = new THREE.MeshPhysicalMaterial({
    color:
      finish === "gold"
        ? "#d6ac49"
        : finish === "chrome"
          ? "#b9c0c6"
          : finish === "carbon"
            ? "#292d33"
            : color,
    metalness: ["chrome", "gold"].includes(finish) ? 0.98 : finish === "matte" ? 0.1 : 0.45,
    roughness:
      finish === "chrome"
        ? 0.16
        : finish === "matte"
          ? 0.95
          : finish === "worn"
            ? 0.79
            : finish === "satin"
              ? 0.58
              : 0.34,
    clearcoat: ["factory", "iridescent", "holographic"].includes(finish) ? 0.4 : 0,
    iridescence: finish === "iridescent" ? 0.85 : finish === "holographic" ? 1 : 0,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: finish === "holographic" ? [100, 520] : [180, 380],
  });
  const panel = paint.clone();
  panel.color.multiplyScalar(0.85);
  panel.roughness = Math.min(1, paint.roughness + 0.1);
  const steel = metal("#abb4b9", 0.32, 0.92),
    dark = metal("#20252b", 0.55, 0.5);
  const trim = metal(TRIM[style.trim] ?? TRIM.steel, 0.4, 0.8);
  // Classic stock hubs tint the base paint, even when a finish changes the shell.
  const hubColor =
    style.trim === "steel"
      ? `rgb(${[1, 3, 5].map((offset) => Math.max(0, parseInt(color.slice(offset, offset + 2), 16) - 40)).join(",")})`
      : (TRIM[style.trim] ?? TRIM.steel);
  const wheelHub = metal(hubColor, 0.48, 0.65);
  const rubber = metal("#171b1e", 0.91, 0.03),
    brass = metal("#ae8750", 0.42, 0.72);
  const white = metal("#e4e1cd", 0.64, 0.12),
    orange = metal("#b34e16", 0.6, 0.18);
  const lens = new THREE.MeshStandardMaterial({
    color: EYES[style.eye] ?? EYES.green,
    emissive: EYES[style.eye] ?? EYES.green,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  const unitSphere = new THREE.SphereGeometry(1, 20, 12);
  const unitCone = new THREE.ConeGeometry(1, 1, 8);
  const bolts: { pos: Vec; axis: "x" | "y" | "z" }[] = [];
  const add = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    pos: Vec,
    scale: Vec = [1, 1, 1],
    parent: THREE.Object3D = bot,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (
    name: string,
    size: Vec,
    pos: Vec,
    mat: THREE.Material = paint,
    parent: THREE.Object3D = bot,
  ) => add(name, unitBox, mat, pos, size, parent);
  const cylinder = (
    name: string,
    radius: number,
    length: number,
    pos: Vec,
    mat: THREE.Material = steel,
    axis: "x" | "y" | "z" = "y",
    parent: THREE.Object3D = bot,
  ) => {
    const mesh = add(name, unitCylinder, mat, pos, [radius, length, radius], parent);
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const sphere = (
    name: string,
    size: Vec,
    pos: Vec,
    mat: THREE.Material = steel,
    parent: THREE.Object3D = bot,
  ) => add(name, unitSphere, mat, pos, size, parent);
  const cone = (
    name: string,
    radius: number,
    length: number,
    pos: Vec,
    mat: THREE.Material = steel,
    parent: THREE.Object3D = bot,
  ) => add(name, unitCone, mat, pos, [radius, length, radius], parent);
  const beam = (
    name: string,
    from: Vec,
    to: Vec,
    radius: number,
    mat: THREE.Material = steel,
    parent: THREE.Object3D = bot,
  ) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      vector = b.clone().sub(a);
    const result = cylinder(
      name,
      radius,
      vector.length(),
      a.add(b).multiplyScalar(0.5).toArray() as Vec,
      mat,
      "y",
      parent,
    );
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    return result;
  };
  const bevelBox = (
    name: string,
    size: Vec,
    pos: Vec,
    mat: THREE.Material = paint,
    parent: THREE.Object3D = bot,
  ) => {
    const [width, height, depth] = size,
      r = Math.min(0.025, height / 4, depth / 4, width / 4);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + r, -height / 2);
    shape.lineTo(width / 2 - r, -height / 2);
    shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
    shape.lineTo(width / 2, height / 2 - r);
    shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
    shape.lineTo(-width / 2 + r, height / 2);
    shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
    shape.lineTo(-width / 2, -height / 2 + r);
    shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * r,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r * 0.4,
      bevelSegments: 1,
      curveSegments: 3,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2 + r);
    return add(name, geometry, mat, pos, [1, 1, 1], parent);
  };
  // points are [z,y]; extrusion creates a centered X-width side-profile solid.
  const profileSolid = (
    name: string,
    points: [number, number][],
    width: number,
    mat: THREE.Material,
    parent: THREE.Object3D = bot,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(-points[0][0], points[0][1]);
    for (const [z, y] of points.slice(1)) shape.lineTo(-z, y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1,
      steps: 1,
    });
    geometry.translate(0, 0, -width / 2);
    geometry.rotateY(Math.PI / 2);
    return add(name, geometry, mat, [0, 0, 0], [1, 1, 1], parent);
  };
  const group = (name: string) => {
    const result = new THREE.Group();
    result.name = name;
    bot.add(result);
    return result;
  };

  bevelBox(
    "Lower chassis",
    [w * 0.94, 0.16, d * 0.91],
    [0, Math.max(0.15, hullBottom - 0.06), 0],
    dark,
  );
  profileSolid(
    `Body shell · ${style.body}`,
    frame.hull.map(([x, y]) => [x * unit, -y * unit]),
    w,
    paint,
  );
  for (const side of [-1, 1]) {
    // Follow the bevelled hull instead of putting a rectangular plate through a sloping nose.
    const panelCenterY = (h + hullBottom) / 2;
    const sidePanel = profileSolid(
      "Bolted side panel",
      frame.hull.map(([x, y]) => [
        x * unit * 0.87,
        panelCenterY + (-y * unit - panelCenterY) * 0.8,
      ]),
      0.035,
      panel,
    );
    sidePanel.position.x = side * (w / 2 + 0.018);
    box("Lower armor seam", [0.024, 0.025, d * 0.8], [side * (w / 2 + 0.041), 0.4, 0], trim);
    for (const z of [-d * 0.31, 0, d * 0.31])
      for (const y of [0.45, h * 0.78])
        bolts.push({ pos: [side * (w / 2 + 0.047), y, z], axis: "x" });
  }
  const roofY = h + 0.045;
  bevelBox("Service hatch", [w * 0.64, 0.045, d * 0.32], [0, h + 0.023, 0.04], panel);
  for (const x of [-w * 0.27, w * 0.27])
    for (const z of [-d * 0.11, d * 0.16]) bolts.push({ pos: [x, roofY + 0.008, z], axis: "y" });
  for (let i = 0; i < 6; i++) {
    box("Cooling vent", [w * 0.37, 0.014, 0.027], [0, h + 0.014, -d * 0.23 - i * 0.042], dark);
    box(
      "Cooling vent metal lip",
      [w * 0.37, 0.006, 0.007],
      [0, h + 0.024, -d * 0.23 - i * 0.042],
      steel,
    );
  }
  if (profile.detail === "split")
    for (const side of [-1, 1])
      bevelBox(
        "Raised shoulder",
        [w * 0.19, 0.1, d * 0.43],
        [side * w * 0.36, h * 0.9, d * 0.02],
        panel,
      );
  if (profile.detail === "long")
    for (const side of [-1, 1])
      beam(
        "Nose brace",
        [side * w * 0.31, 0.42, d * 0.49],
        [side * w * 0.31, h * 0.88, d * 0.21],
        0.025,
        trim,
      );
  if (profile.detail === "tiered")
    for (const side of [-1, 1])
      bevelBox(
        "Fortified shoulder tier",
        [w * 0.22, 0.09, d * 0.65],
        [side * w * 0.33, h + 0.025, -0.05],
        trim,
      );
  bevelBox(
    "Visor surround",
    [w * 0.31, 0.1, 0.06],
    [0, Math.max(nose - 0.07, 0.29), front + 0.014],
    dark,
  );
  bevelBox(
    "Visor lens",
    [w * 0.24, 0.043, 0.018],
    [0, Math.max(nose - 0.065, 0.295), front + 0.052],
    lens,
  );

  // Drives: track shoes are a single instanced draw call instead of hundreds of separate objects.
  const drive = group(`Drive · ${look.driveFamily ?? "concealed"}`);
  const driveFamily = look.driveFamily;
  const treads = driveFamily ? driveFamily === "treads" : frame.treads;
  const wheelX = w / 2 + 0.13,
    wheelZ = d * 0.34;
  if (treads) {
    const r = 0.235,
      end = 0.765,
      trackShape = new THREE.Shape();
    trackShape.moveTo(-end, 0.025);
    trackShape.lineTo(end, 0.025);
    trackShape.absarc(end, 0.26, r, -Math.PI / 2, Math.PI / 2, false);
    trackShape.lineTo(-end, 0.495);
    trackShape.absarc(-end, 0.26, r, Math.PI / 2, Math.PI * 1.5, false);
    const hole = new THREE.Path();
    hole.moveTo(-end, 0.425);
    hole.lineTo(end, 0.425);
    hole.absarc(end, 0.26, 0.165, Math.PI / 2, -Math.PI / 2, true);
    hole.lineTo(-end, 0.095);
    hole.absarc(-end, 0.26, 0.165, -Math.PI / 2, Math.PI / 2, true);
    trackShape.holes.push(hole);
    const trackGeometry = new THREE.ExtrudeGeometry(trackShape, {
      depth: 0.22,
      bevelEnabled: false,
      curveSegments: 12,
      steps: 1,
    });
    trackGeometry.translate(0, 0, -0.11);
    trackGeometry.rotateY(Math.PI / 2);
    const points = trackShape.getSpacedPoints(44),
      matrix = new THREE.Object3D();
    const shoes = new THREE.InstancedMesh(unitBox, trim, 88);
    shoes.name = "Instanced track shoes";
    shoes.castShadow = true;
    drive.add(shoes);
    const grips = new THREE.InstancedMesh(unitBox, rubber, 88);
    grips.name = "Raised track traction grips";
    grips.castShadow = true;
    drive.add(grips);
    let index = 0;
    for (const side of [-1, 1]) {
      add("Continuous rubber belt", trackGeometry, rubber, [side * wheelX, 0, 0], [1, 1, 1], drive);
      for (let i = 0; i < 44; i++) {
        const p = points[i],
          q = points[(i + 1) % 44];
        matrix.position.set(side * wheelX, p.y, -p.x);
        matrix.rotation.set(-Math.atan2(q.y - p.y, -q.x + p.x), 0, 0);
        matrix.scale.set(0.26, 0.026, 0.068);
        matrix.updateMatrix();
        shoes.setMatrixAt(index, matrix.matrix);
        matrix.position.y += Math.cos(matrix.rotation.x) * 0.02;
        matrix.position.z += Math.sin(matrix.rotation.x) * 0.02;
        matrix.scale.set(0.278, 0.013, 0.025);
        matrix.updateMatrix();
        grips.setMatrixAt(index++, matrix.matrix);
      }
      for (const wh of frame.wheels) {
        const z = wh.x * unit;
        const r = wh.r * unit;
        cylinder("Road wheel", r, 0.19, [side * wheelX, 0.25, z], rubber, "x", drive);
        cylinder(
          "Road wheel rim",
          r * 0.77,
          0.027,
          [side * (wheelX + 0.112), 0.25, z],
          steel,
          "x",
          drive,
        );
        cylinder(
          "Road wheel dark inset",
          r * 0.56,
          0.03,
          [side * (wheelX + 0.13), 0.25, z],
          dark,
          "x",
          drive,
        );
        cylinder(
          "Wheel axle",
          r * 0.25,
          0.038,
          [side * (wheelX + 0.15), 0.25, z],
          wheelHub,
          "x",
          drive,
        );
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          bolts.push({
            pos: [
              side * (wheelX + 0.155),
              0.25 + Math.cos(a) * r * 0.45,
              z + Math.sin(a) * r * 0.45,
            ],
            axis: "x",
          });
        }
      }
      box("Track guard", [0.28, 0.035, d * 0.76], [side * wheelX, 0.53, 0], dark, drive);
    }
    shoes.computeBoundingSphere();
    grips.computeBoundingSphere();
  } else if (driveFamily === "air") {
    bevelBox("Air cushion rubber skirt", [w + 0.36, 0.32, d + 0.25], [0, 0.2, 0], rubber, drive);
    for (const x of [-w * 0.32, w * 0.32]) {
      cylinder("Hover fan housing", 0.21, 0.12, [x, h + 0.07, -d * 0.28], dark, "y", drive);
      for (let i = 0; i < 4; i++)
        box("Fan blade", [0.31, 0.02, 0.045], [x, h + 0.14, -d * 0.28], steel, drive).rotation.y =
          (i * Math.PI) / 4;
    }
  } else if (driveFamily === "anchor") {
    for (const x of [-wheelX, wheelX])
      for (const z of [-wheelZ, wheelZ]) {
        cylinder("Anchor foot", 0.21, 0.07, [x, 0.05, z], dark, "y", drive);
        beam("Anchor outrigger", [x, 0.1, z], [x * 0.68, 0.42, z * 0.8], 0.065, steel, drive);
      }
  } else {
    for (const side of [-1, 1])
      for (const wh of frame.wheels) {
        const z = wh.x * unit;
        const radius = wh.r * unit;
        const wheel = group("Wheel assembly");
        drive.add(wheel);
        cylinder(
          "Rubber tire",
          radius,
          0.22,
          [side * wheelX, radius + 0.025, z],
          rubber,
          "x",
          wheel,
        );
        cylinder(
          "Wheel rim",
          radius * 0.7,
          0.03,
          [side * (wheelX + 0.12), radius + 0.025, z],
          driveFamily === "haywagon" ? brass : trim,
          "x",
          wheel,
        );
        cylinder(
          "Wheel hub",
          0.06,
          0.05,
          [side * (wheelX + 0.145), radius + 0.025, z],
          wheelHub,
          "x",
          wheel,
        );
        cylinder(
          "Wheel inset",
          radius * 0.48,
          0.035,
          [side * (wheelX + 0.13), radius + 0.025, z],
          dark,
          "x",
          wheel,
        );
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          bolts.push({
            pos: [
              side * (wheelX + 0.153),
              radius + 0.025 + Math.cos(a) * radius * 0.42,
              z + Math.sin(a) * radius * 0.42,
            ],
            axis: "x",
          });
        }
        if (driveFamily === "omni" || driveFamily === "swerve")
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const roller = cylinder(
              "Omni roller",
              0.042,
              0.16,
              [
                side * wheelX,
                radius + 0.025 + Math.cos(angle) * radius,
                z + Math.sin(angle) * radius,
              ],
              dark,
              "z",
              wheel,
            );
            roller.rotation.x += angle;
          }
        if (driveFamily === "swerve")
          cylinder("Steering pivot", 0.085, 0.2, [side * wheelX, 0.48, z], steel, "y", drive);
        if (driveFamily === "mag")
          cylinder(
            "Magnetic hub ring",
            radius * 0.86,
            0.022,
            [side * (wheelX + 0.109), radius + 0.025, z],
            dark,
            "x",
            wheel,
          );
      }
    if (driveFamily === "rocket")
      for (const x of [-w * 0.34, w * 0.34]) {
        cylinder("Drive rocket", 0.15, 0.58, [x, 0.42, -d * 0.43], steel, "z", drive);
        cylinder("Rocket exhaust", 0.12, 0.05, [x, 0.42, -d / 2 - 0.18], dark, "z", drive);
      }
    if (driveFamily === "flip")
      for (const side of [-1, 1]) {
        cylinder(
          "Flip kit pivot",
          0.11,
          0.14,
          [side * (w / 2 + 0.08), 0.48, d * 0.17],
          brass,
          "x",
          drive,
        );
        beam(
          "Flip kit lifting arm",
          [side * (w / 2 + 0.11), 0.48, d * 0.17],
          [side * (w / 2 + 0.11), 0.14, d * 0.6],
          0.055,
          steel,
          drive,
        );
        box(
          "Flip kit ground fork",
          [0.16, 0.045, 0.39],
          [side * (w / 2 + 0.11), 0.085, d * 0.57],
          trim,
          drive,
        );
      }
    if (driveFamily === "ghostchaser") {
      box("Chase light bar", [w * 0.78, 0.06, 0.11], [0, h + 0.1, -0.3], dark, drive);
      for (const side of [-1, 1])
        sphere(
          "Round chase lamp",
          [0.085, 0.085, 0.05],
          [side * w * 0.28, h + 0.13, -0.23],
          side === 1 ? lens : white,
          drive,
        );
    }
    if (driveFamily === "haywagon")
      for (const side of [-1, 1])
        box(
          "Wood wagon rail",
          [0.07, 0.09, d * 0.82],
          [side * (w / 2 + 0.04), 0.6, 0],
          brass,
          drive,
        );
  }

  const armor = group(`Armor · ${look.armorFamily ?? "concealed"}`);
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + 0.07);
    switch (look.armorFamily) {
      case "plate":
        bevelBox("Reinforced plate", [0.04, 0.22, d * 0.62], [x, 0.55, 0.02], trim, armor);
        break;
      case "skirt": {
        const skirt = box(
          "Floor skirt",
          [0.08, 0.32, d * 0.93],
          [side * (w / 2 + 0.25), 0.2, 0],
          steel,
          armor,
        );
        skirt.rotation.z = side * 0.2;
        break;
      }
      case "angle": {
        const plate = box(
          "Deflector plate",
          [0.09, 0.36, d * 0.77],
          [x + side * 0.03, 0.61, 0],
          trim,
          armor,
        );
        plate.rotation.z = side * 0.4;
        break;
      }
      case "cage":
        for (const z of [-d * 0.35, d * 0.35]) {
          beam("Cage upright", [x, 0.4, z], [x, h + 0.14, z], 0.035, trim, armor);
        }
        beam(
          "Cage top rail",
          [x, h + 0.14, -d * 0.35],
          [x, h + 0.14, d * 0.35],
          0.035,
          trim,
          armor,
        );
        break;
      case "ablative":
        for (let i = 0; i < 4; i++)
          bevelBox(
            "Ablative tile",
            [0.07, 0.25, d * 0.18],
            [x, 0.6, (i - 1.5) * d * 0.2],
            panel,
            armor,
          );
        break;
      case "gel":
        bevelBox(
          "Impact gel pad",
          [0.11, 0.28, d * 0.72],
          [x, 0.57, 0],
          new THREE.MeshStandardMaterial({
            color: "#3d8e8e",
            roughness: 0.38,
            transparent: true,
            opacity: 0.83,
          }),
          armor,
        );
        break;
      case "chain":
        for (let i = 0; i < 7; i++) {
          const link = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 4, 8), steel);
          link.position.set(x, 0.55, (i - 3) * 0.17);
          link.rotation.y = Math.PI / 2;
          link.name = "Chainmail ring";
          armor.add(link);
        }
        break;
      case "spike":
        for (let i = 0; i < 4; i++) {
          const spike = cone(
            "Armor spike",
            0.07,
            0.23,
            [x + side * 0.1, 0.6, (i - 1.5) * 0.36],
            steel,
            armor,
          );
          spike.rotation.z = (-side * Math.PI) / 2;
        }
        break;
      case "ceramic":
        for (let i = 0; i < 4; i++)
          bevelBox(
            "Ceramic tile",
            [0.055, 0.25, d * 0.19],
            [x, 0.6, (i - 1.5) * d * 0.2],
            white,
            armor,
          );
        break;
      case "magnet":
        for (const z of [-0.48, 0.48]) {
          cylinder("Magnetic armor puck", 0.13, 0.06, [x, 0.6, z], dark, "x", armor);
          cylinder("Magnet face", 0.08, 0.065, [x + side * 0.02, 0.6, z], steel, "x", armor);
        }
        break;
      case "reactive":
        for (let i = 0; i < 4; i++)
          box(
            "Reactive armor cassette",
            [0.09, 0.23, d * 0.16],
            [x, 0.59, (i - 1.5) * d * 0.2],
            dark,
            armor,
          ).rotation.x = -0.13;
        break;
      case "platter": {
        const platter = cylinder(
          "Feast platter armor",
          0.4,
          0.045,
          [x, 0.59, 0],
          brass,
          "x",
          armor,
        );
        platter.scale.z *= 1.8;
        break;
      }
    }
  }

  // Real chassis families add visible construction beneath/behind the chosen cosmetic shell.
  const chassis = group(`Chassis equipment · ${look.chassisFamily ?? "concealed"}`);
  const cf = look.chassisFamily;
  if (cf === "pumpkin") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      sphere(
        "Pumpkin chassis rib",
        [0.2, 0.23, 0.2],
        [Math.cos(a) * w * 0.43, 0.37, Math.sin(a) * d * 0.43],
        orange,
        chassis,
      );
    }
  } else if (cf === "harvesttable") {
    bevelBox(
      "Harvest table chassis rim",
      [w + 0.16, 0.085, d + 0.12],
      [0, 0.38, 0],
      brass,
      chassis,
    );
  } else if (cf === "hover") {
    for (const side of [-1, 1])
      cylinder(
        "Hover chassis duct",
        0.2,
        0.12,
        [side * w * 0.36, 0.4, -d * 0.36],
        dark,
        "y",
        chassis,
      );
  } else if (cf === "spring") {
    for (const x of [-w * 0.42, w * 0.42])
      for (const z of [-d * 0.36, d * 0.36])
        for (let i = 0; i < 4; i++)
          cylinder(
            "Suspension spring coil",
            0.075,
            0.025,
            [x, 0.2 + i * 0.045, z],
            steel,
            "y",
            chassis,
          );
  } else if (cf === "skeleton") {
    for (const side of [-1, 1]) {
      beam(
        "Open chassis frame",
        [side * w * 0.47, 0.29, -d * 0.45],
        [side * w * 0.47, 0.29, d * 0.45],
        0.045,
        steel,
        chassis,
      );
      beam(
        "Frame diagonal",
        [-w * 0.4, 0.28, side * d * 0.4],
        [w * 0.4, 0.28, -side * d * 0.4],
        0.025,
        steel,
        chassis,
      );
    }
  } else if (["sprinter", "hornet", "shrike"].includes(cf ?? "")) {
    for (const side of [-1, 1])
      box(
        "Light chassis rail",
        [0.04, 0.045, d * 0.9],
        [side * w * 0.43, 0.31, 0],
        cf === "hornet" ? brass : trim,
        chassis,
      );
  } else if (cf === "hybrid") {
    for (const side of [-1, 1])
      bevelBox(
        "Hybrid power pack",
        [0.22, 0.18, 0.42],
        [side * w * 0.35, 0.4, -d / 2 - 0.04],
        side === 1 ? brass : steel,
        chassis,
      );
  } else if (["dynamo", "capacitor", "reactor"].includes(cf ?? "")) {
    for (const side of [-1, 1]) {
      cylinder(
        "Chassis energy cell",
        0.13,
        0.43,
        [side * w * 0.35, 0.45, -d / 2 - 0.04],
        dark,
        "x",
        chassis,
      );
      for (let i = 0; i < 4; i++)
        cylinder(
          "Cell cooling ring",
          0.14,
          0.025,
          [side * w * 0.35 + (i - 1.5) * 0.1, 0.45, -d / 2 - 0.04],
          cf === "reactor" ? lens : brass,
          "x",
          chassis,
        );
    }
  } else if (cf === "scorpion") {
    beam("Tail chassis brace", [0, 0.4, -d * 0.45], [0, h + 0.19, -d * 0.55], 0.065, trim, chassis);
    beam("Tail tip", [0, h + 0.19, -d * 0.55], [0, h + 0.27, -d * 0.32], 0.05, steel, chassis);
  } else if (cf === "crab") {
    for (const side of [-1, 1])
      for (const z of [-d * 0.35, d * 0.35])
        beam(
          "Crab chassis outrigger",
          [side * w * 0.35, 0.39, z * 0.7],
          [side * (w / 2 + 0.2), 0.24, z],
          0.075,
          trim,
          chassis,
        );
  } else if (["mule", "monolith", "keystone"].includes(cf ?? "")) {
    bevelBox(
      "Heavy chassis crossmember",
      [w + 0.04, cf === "monolith" ? 0.2 : 0.12, 0.17],
      [0, 0.34, -d / 2],
      trim,
      chassis,
    );
  } else if (cf === "windlass") {
    cylinder(
      "Windlass chassis winch",
      0.11,
      w * 0.58,
      [0, 0.35, -d / 2 - 0.05],
      steel,
      "x",
      chassis,
    );
  }

  const weapon = group(`Weapon · ${look.weapon}`);
  const barrel = (
    name: string,
    x: number,
    y: number,
    z: number,
    radius = 0.14,
    length = 0.65,
    mat: THREE.Material = steel,
  ) => {
    cylinder(name, radius, length, [x, y, z], mat, "z", weapon);
    cylinder(
      `${name} bore`,
      radius * 0.7,
      0.012,
      [x, y, z + length / 2 + 0.009],
      dark,
      "z",
      weapon,
    );
  };
  const blade = (name: string, mat: THREE.Material, broad = false) => {
    beam("Blade pivot arm", [0, 0.47, front - 0.1], [0, 0.76, front + 0.35], 0.07, dark, weapon);
    profileSolid(
      name,
      [
        [front + 0.1, 0.58],
        [front + 0.98, 0.43],
        [front + 0.78, broad ? 0.91 : 0.77],
        [front + 0.13, 0.93],
      ],
      0.055,
      mat,
      weapon,
    );
  };
  switch (look.weapon) {
    case "wedge":
    case "flip":
      profileSolid(
        look.weapon === "flip" ? "Hinged flipper" : "Steel wedge blade",
        [
          [front - 0.2, 0.45],
          [front + 0.6, 0.05],
          [front - 0.2, 0.05],
        ],
        w * 0.99,
        steel,
        weapon,
      );
      box(
        "Replaceable wedge edge",
        [w + 0.12, 0.028, 0.055],
        [0, 0.048, front + 0.62],
        trim,
        weapon,
      );
      cylinder("Weapon hinge", 0.055, w * 0.8, [0, 0.4, front - 0.13], dark, "x", weapon);
      if (look.weapon === "flip")
        for (const x of [-w * 0.27, w * 0.27])
          beam(
            "Flipper hydraulic ram",
            [x, 0.32, front - 0.3],
            [x, 0.12, front + 0.37],
            0.047,
            brass,
            weapon,
          );
      break;
    case "drum":
      cylinder(
        "Horizontal weapon drum",
        0.28,
        w * 0.85,
        [0, 0.34, front + 0.24],
        steel,
        "x",
        weapon,
      );
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const tooth = box(
          "Drum tooth",
          [w * 0.82, 0.075, 0.08],
          [0, 0.34 + Math.cos(angle) * 0.27, front + 0.24 + Math.sin(angle) * 0.27],
          dark,
          weapon,
        );
        tooth.rotation.x = angle;
      }
      break;
    case "saw":
    case "disc": {
      const horizontal = look.weapon === "disc";
      const pose = sawPoseOf(frame);
      const bladeY = horizontal ? 0.39 : -pose.bladeY * unit;
      const bladeZ = horizontal ? front + 0.32 : pose.bladeX * unit;
      const bladeRadius = horizontal ? 0.4 : pose.bladeRadius * unit;
      if (horizontal)
        cylinder("Spinner mount", 0.11, 0.31, [0, 0.42, front + 0.15], dark, "y", weapon);
      else {
        const pivot: Vec = [0, -pose.pivotY * unit, pose.pivotX * unit];
        beam(
          "Saw mount pedestal",
          [0, -(pose.mountY + 0.02) * unit, pose.pivotX * unit],
          pivot,
          0.075,
          dark,
          weapon,
        );
        cylinder("Overhead saw pivot", 0.1, 0.32, pivot, dark, "x", weapon);
        beam("Overhead saw arm", pivot, [0, bladeY, bladeZ], 0.055, steel, weapon);
        cylinder("Saw axle", 0.085, 0.19, [0, bladeY, bladeZ], dark, "x", weapon);
      }
      const saw = cylinder(
        "Steel spinning blade",
        bladeRadius,
        0.045,
        [0, bladeY, bladeZ],
        steel,
        horizontal ? "y" : "x",
        weapon,
      );
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const tooth = box(
          "Saw tooth",
          horizontal ? [0.11, 0.065, 0.085] : [0.07, 0.09, 0.11],
          horizontal
            ? [Math.cos(a) * bladeRadius, bladeY, bladeZ + Math.sin(a) * bladeRadius]
            : [0, bladeY + Math.cos(a) * bladeRadius, bladeZ + Math.sin(a) * bladeRadius],
          trim,
          weapon,
        );
        if (horizontal) tooth.rotation.y = -a;
        else tooth.rotation.x = -a;
      }
      saw.userData.spinner = true;
      break;
    }
    case "hammer":
    case "axe": {
      const hammer = look.weapon === "hammer";
      const angle = hammer ? 2.3 : 0.5;
      const length = (hammer ? 0.62 : 0.46) * unit;
      const pivotZ = (hammer ? -0.05 : -0.12) * unit;
      const pivotY = h + 0.02 * unit;
      const headZ = pivotZ + Math.cos(angle) * length;
      const headY = pivotY + Math.sin(angle) * length;
      cylinder("Overhead arm pivot", 0.1, 0.48, [0, pivotY, pivotZ], dark, "x", weapon);
      beam(
        "Overhead weapon arm",
        [0, pivotY, pivotZ],
        [0, headY, headZ],
        0.07,
        look.weapon === "axe" ? brass : trim,
        weapon,
      );
      if (hammer) bevelBox("Hammer head", [0.63, 0.29, 0.3], [0, headY, headZ], steel, weapon);
      else
        profileSolid(
          "Axe blade",
          [
            [headZ - 0.12, headY + 0.1],
            [headZ + 0.08, headY + 0.3],
            [headZ + 0.24, headY - 0.04],
            [headZ + 0.08, headY - 0.12],
            [headZ - 0.12, headY - 0.06],
          ],
          0.075,
          steel,
          weapon,
        );
      break;
    }
    case "claw": {
      profileSolid(
        "Claw lower jaw",
        [
          [front - 0.08, 0.2],
          [front + 0.64, 0.04],
          [front + 0.64, 0.01],
          [front - 0.08, 0.04],
        ],
        w * 0.54,
        steel,
        weapon,
      );
      const pivotZ = front - 0.06 * unit;
      const pivotY = h * 0.85;
      const a = 0.55;
      const profile: [number, number][] = [
        [0, 0.03],
        [0.36, 0.02],
        [0.42, -0.1],
        [0.36, -0.04],
        [0, -0.035],
      ];
      profileSolid(
        "Claw raised biting jaw",
        profile.map(([z, y]) => [
          pivotZ + (z * Math.cos(a) - y * Math.sin(a)) * unit,
          pivotY + (z * Math.sin(a) + y * Math.cos(a)) * unit,
        ]),
        w * 0.38,
        steel,
        weapon,
      );
      cylinder("Claw pivot", 0.09, w * 0.6, [0, pivotY, pivotZ], dark, "x", weapon);
      for (const x of [-w * 0.23, w * 0.23])
        beam(
          "Claw support bracket",
          [x, 0.2, front - 0.1],
          [x, pivotY, pivotZ],
          0.045,
          trim,
          weapon,
        );
      break;
    }
    case "bones":
      for (const side of [-1, 1]) {
        const mat = look.weapon === "bones" ? white : steel;
        cylinder("Claw pivot", 0.09, 0.1, [side * w * 0.33, 0.45, front], dark, "y", weapon);
        beam(
          "Claw jaw",
          [side * w * 0.33, 0.45, front],
          [side * w * 0.47, 0.44, front + 0.51],
          0.065,
          mat,
          weapon,
        );
        beam(
          "Claw tip",
          [side * w * 0.47, 0.44, front + 0.51],
          [side * w * 0.12, 0.42, front + 0.83],
          0.065,
          mat,
          weapon,
        );
        if (look.weapon === "bones")
          sphere(
            "Bone joint",
            [0.095, 0.095, 0.095],
            [side * w * 0.47, 0.44, front + 0.51],
            white,
            weapon,
          );
      }
      break;
    case "chainsaw":
      bevelBox("Chainsaw motor", [0.35, 0.27, 0.35], [0, 0.54, front], orange, weapon);
      bevelBox("Chainsaw guide bar", [0.085, 0.28, 0.85], [0, 0.56, front + 0.52], steel, weapon);
      for (let i = 0; i < 10; i++)
        for (const side of [-1, 1])
          box(
            "Chain tooth",
            [0.11, 0.055, 0.035],
            [0, 0.56 + side * 0.15, front + 0.12 + i * 0.08],
            dark,
            weapon,
          );
      break;
    case "slasher":
    case "carver":
      blade(
        look.weapon === "carver" ? "Carving blade" : "Slasher blade",
        steel,
        look.weapon === "carver",
      );
      break;
    case "ghost":
      blade(
        "Ghost blade",
        new THREE.MeshPhysicalMaterial({
          color: "#c2efff",
          emissive: "#70b6d6",
          emissiveIntensity: 0.28,
          metalness: 0.5,
          roughness: 0.2,
          transparent: true,
          opacity: 0.74,
        }),
      );
      break;
    case "launcher":
    case "yamcannon":
      bevelBox("Launcher cradle", [0.6, 0.23, 0.4], [0, 0.5, front], dark, weapon);
      barrel(
        "Gourd cannon",
        0,
        0.75,
        front + 0.32,
        0.24,
        0.72,
        look.weapon === "yamcannon" ? brass : orange,
      );
      break;
    case "broom":
      beam("Broom shaft", [0, 0.45, front - 0.1], [0, 0.32, front + 0.63], 0.04, brass, weapon);
      for (let i = 0; i < 12; i++)
        beam(
          "Broom bristle",
          [(i - 5.5) * 0.014, 0.32, front + 0.55],
          [(i - 5.5) * 0.07, 0.12, front + 1.0],
          0.018,
          brass,
          weapon,
        );
      break;
    case "rivetgun":
      bevelBox("Pneumatic rivet body", [0.31, 0.3, 0.43], [0, 0.6, front + 0.04], trim, weapon);
      barrel("Rivet nozzle", 0, 0.6, front + 0.46, 0.065, 0.46);
      cylinder("Pressure gauge", 0.095, 0.04, [0.2, 0.74, front], white, "x", weapon);
      beam(
        "Air supply hose",
        [0.15, 0.48, front],
        [0.28, 0.35, front - 0.3],
        0.027,
        rubber,
        weapon,
      );
      break;
    case "crusher":
      for (const x of [-0.34, 0.34]) {
        cylinder("Crusher post", 0.055, 0.93, [x, 0.66, front + 0.39], steel, "y", weapon);
      }
      box("Crusher top crossbeam", [0.8, 0.12, 0.26], [0, 1.12, front + 0.39], trim, weapon);
      box("Crusher press plate", [0.73, 0.12, 0.51], [0, 0.7, front + 0.39], brass, weapon);
      box("Crusher anvil", [0.8, 0.1, 0.62], [0, 0.14, front + 0.39], dark, weapon);
      break;
    case "flail":
      beam("Flail arm", [0, 0.5, front - 0.12], [0, 0.69, front + 0.23], 0.065, steel, weapon);
      for (let i = 0; i < 6; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 4, 8), steel);
        ring.name = "Flail chain link";
        ring.position.set(0.08 * i, 0.69 - i * 0.018, front + 0.27 + i * 0.09);
        ring.rotation.x = i % 2 ? Math.PI / 2 : 0;
        weapon.add(ring);
      }
      sphere("Flail weight", [0.21, 0.21, 0.21], [0.48, 0.59, front + 0.84], dark, weapon);
      break;
    case "piston":
      barrel("Piston cylinder", 0, 0.48, front + 0.12, 0.17, 0.6);
      cylinder("Extended piston rod", 0.065, 0.72, [0, 0.48, front + 0.57], steel, "z", weapon);
      cone("Piston spear", 0.13, 0.28, [0, 0.48, front + 1.04], steel, weapon).rotation.x =
        Math.PI / 2;
      break;
    case "flame":
      for (const x of [-0.23, 0.23])
        cylinder("Fuel bottle", 0.13, 0.4, [x, 0.64, front - 0.12], orange, "y", weapon);
      barrel("Flame nozzle", 0, 0.52, front + 0.33, 0.09, 0.6, dark);
      break;
    case "tesla":
      for (const x of [-0.24, 0.24]) {
        cylinder("Tesla coil mast", 0.07, 0.64, [x, 0.85, front - 0.05], dark, "y", weapon);
        for (let i = 0; i < 6; i++)
          cylinder(
            "Copper coil winding",
            0.13,
            0.035,
            [x, 0.62 + i * 0.075, front - 0.05],
            brass,
            "y",
            weapon,
          );
        sphere("Tesla terminal", [0.18, 0.12, 0.18], [x, 1.23, front - 0.05], steel, weapon);
      }
      break;
    // Concealed or empty weapons deliberately add no equipment geometry.
    case "hidden":
    case "none":
    case "":
      break;
  }

  const utility = group(`Utility · ${look.utilityFamily ?? "none"}`),
    uf = look.utilityFamily;
  const uy = h + 0.13,
    uz = -d * 0.31,
    ux = w * 0.32;
  switch (uf) {
    case "burn":
      for (const x of [-w * 0.3, w * 0.3]) {
        cylinder("Afterburner exhaust", 0.12, 0.31, [x, 0.54, -d / 2 - 0.05], steel, "z", utility);
        cylinder("Exhaust opening", 0.085, 0.02, [x, 0.54, -d / 2 - 0.22], dark, "z", utility);
      }
      break;
    case "peace":
      bevelBox("Peace lock module", [0.26, 0.2, 0.2], [ux, uy, uz], brass, utility);
      beam(
        "Lock shackle",
        [ux - 0.07, uy + 0.1, uz],
        [ux - 0.07, uy + 0.23, uz],
        0.025,
        steel,
        utility,
      );
      beam(
        "Lock shackle",
        [ux + 0.07, uy + 0.1, uz],
        [ux + 0.07, uy + 0.23, uz],
        0.025,
        steel,
        utility,
      );
      beam(
        "Lock shackle",
        [ux - 0.07, uy + 0.23, uz],
        [ux + 0.07, uy + 0.23, uz],
        0.025,
        steel,
        utility,
      );
      break;
    case "crowd":
    case "siren":
      cylinder(
        uf === "crowd" ? "Crowd loudspeaker" : "Siren horn",
        0.16,
        0.25,
        [ux, uy, uz],
        brass,
        "z",
        utility,
      );
      cylinder("Speaker cone", 0.12, 0.015, [ux, uy, uz + 0.14], dark, "z", utility);
      break;
    case "weld":
    case "medbay":
      bevelBox(
        "Repair module",
        [0.27, 0.23, 0.3],
        [ux, uy, uz],
        uf === "medbay" ? white : trim,
        utility,
      );
      box("Medical cross vertical", [0.04, 0.14, 0.013], [ux, uy, uz + 0.16], orange, utility);
      box("Medical cross horizontal", [0.14, 0.04, 0.013], [ux, uy, uz + 0.16], orange, utility);
      break;
    case "scry":
    case "spotlight":
    case "uv":
      cylinder("Optic pod", 0.13, 0.23, [ux, uy, uz], dark, "z", utility);
      sphere(
        "Optic lens",
        [0.104, 0.104, 0.025],
        [ux, uy, uz + 0.13],
        uf === "uv"
          ? new THREE.MeshStandardMaterial({
              color: "#c15dff",
              emissive: "#9736d1",
              emissiveIntensity: 0.6,
            })
          : lens,
        utility,
      );
      break;
    case "decoy":
      sphere("Decoy beacon", [0.14, 0.14, 0.14], [ux, uy, uz], lens, utility);
      cylinder("Decoy base", 0.15, 0.06, [ux, uy - 0.12, uz], dark, "y", utility);
      break;
    case "oil":
    case "smoke":
    case "veil":
      for (const x of [ux - 0.07, ux + 0.07])
        cylinder(
          uf === "oil" ? "Oil tank" : "Smoke canister",
          0.07,
          0.3,
          [x, uy, uz],
          uf === "oil" ? dark : steel,
          "y",
          utility,
        );
      break;
    case "leech":
    case "grapple":
      cylinder("Grapple cable spool", 0.14, 0.2, [ux, uy, uz], dark, "x", utility);
      beam("Grapple hook stem", [ux, uy, uz], [ux, uy + 0.17, uz + 0.2], 0.028, steel, utility);
      beam(
        "Grapple hook",
        [ux, uy + 0.17, uz + 0.2],
        [ux + 0.11, uy + 0.11, uz + 0.23],
        0.028,
        steel,
        utility,
      );
      break;
    case "tremor":
      cylinder("Tremor piston", 0.17, 0.24, [ux, uy, uz], steel, "y", utility);
      cylinder("Tremor impact cap", 0.2, 0.06, [ux, uy + 0.15, uz], dark, "y", utility);
      break;
    case "blackout":
      cylinder("Blackout emitter", 0.1, 0.25, [ux, uy, uz], dark, "y", utility);
      for (let i = 0; i < 3; i++)
        cylinder("Emitter ring", 0.16, 0.025, [ux, uy - 0.07 + i * 0.08, uz], trim, "y", utility);
      break;
    case "mirror": {
      const mirror = bevelBox(
        "Mirror shield projector",
        [0.25, 0.27, 0.045],
        [ux, uy, uz],
        new THREE.MeshStandardMaterial({ color: "#d7e8ec", metalness: 1, roughness: 0.08 }),
        utility,
      );
      mirror.rotation.x = -0.3;
      break;
    }
  }
  // Tier lights are an honest visual cue for the equipped brain; no hidden family is inferred.
  if (look.brainTier) {
    const levels = { stock: 1, sport: 2, pro: 3, super: 4, championship: 5 };
    for (let i = 0; i < levels[look.brainTier]; i++)
      box(
        "Brain tier status lamp",
        [0.027, 0.025, 0.014],
        [-0.12 + i * 0.06, 0.5, -d / 2 - 0.016],
        lens,
      );
  }

  // Preserve unrepaired wear even when paint or stickers are changed. Cosmetic worn finish adds scuffs only.
  const armorSurface: Record<string, number> = {
    plate: 0.1,
    ablative: 0.115,
    gel: 0.135,
    ceramic: 0.11,
    reactive: 0.125,
    angle: 0.22,
    platter: 0.11,
  };
  const sidePanelX = w / 2 + (armorSurface[look.armorFamily ?? ""] ?? 0.055);
  const scarCount = Math.max(0, Math.min(6, look.scars ?? 0));
  const wearCount = scarCount * 3 + (finish === "worn" ? 12 : 0);
  for (let i = 0; i < wearCount; i++) {
    const side = i % 2 ? 1 : -1,
      z = ((i * 0.371) % (d * 0.7)) - d * 0.35;
    const scar = box(
      "Unrepaired surface scratch",
      [0.009, 0.012 + (i % 3) * 0.005, 0.1 + (i % 4) * 0.035],
      [side * (sidePanelX + 0.004), 0.48 + (i % 4) * 0.05, z],
      i % 4 ? steel : dark,
    );
    scar.rotation.x = 0.24 + (i % 3) * 0.17;
  }
  if (finish === "carbon")
    for (const side of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const weave = box(
          "Carbon weave highlight",
          [0.006, 0.012, d * 0.65],
          [side * sidePanelX, 0.48 + i * 0.027, 0],
          dark,
        );
        weave.rotation.x = i % 2 ? 0.025 : -0.025;
      }

  const boltMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.015, 6),
    steel,
    bolts.length,
  );
  boltMesh.name = "Instanced captive fasteners";
  boltMesh.castShadow = true;
  const transform = new THREE.Object3D();
  bolts.forEach((bolt, i) => {
    transform.position.set(...bolt.pos);
    transform.rotation.set(
      bolt.axis === "z" ? Math.PI / 2 : 0,
      0,
      bolt.axis === "x" ? Math.PI / 2 : 0,
    );
    transform.updateMatrix();
    boltMesh.setMatrixAt(i, transform.matrix);
  });
  boltMesh.computeBoundingSphere();
  bot.add(boltMesh);
  // Flat badges sit on the fitted armor rather than disappearing behind it.
  // Rails, spikes and magnetic pucks remain separate objects in front of the badge.
  const frontLabelY = Math.max(0.2, Math.min(0.59, nose - 0.1));
  if (look.number) {
    box(
      "Front number backing plate",
      [0.25, 0.19, 0.025],
      [-w * 0.28, frontLabelY, d / 2 + 0.027],
      dark,
    );
    box(
      "Front number mounting bracket",
      [0.055, 0.07, 0.17],
      [-w * 0.28, frontLabelY, d / 2 - 0.04],
      dark,
    );
  }
  bot.add(createGarageCosmetics(look, { roofY, width: w, depth: d, sidePanelX, frontLabelY }));
  bot.updateMatrixWorld(true);
  return bot;
}
