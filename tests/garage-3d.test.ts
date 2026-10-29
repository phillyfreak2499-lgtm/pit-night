import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { garageCameraDistance } from "../src/components/pit/garage-3d/framing.ts";
import { createGarageCosmetics } from "../src/components/pit/garage-3d/cosmetics.ts";
import {
  createGarageBot,
  GARAGE_MODEL_FAMILIES,
} from "../src/components/pit/garage-3d/bot-model.ts";
import { BODY_STYLES, DEFAULT_STYLE, PARTS } from "../src/lib/pit/catalog.ts";
import { TOPPER_IDS, type BotStyle } from "../src/lib/pit/types.ts";
import type { BotLookProps } from "../src/components/pit/bot-portrait.tsx";

const dimensions = { roofY: 0.95, width: 1.5, depth: 2.1 };
function look(style: Partial<BotStyle> = {}): BotLookProps {
  return {
    id: "plano",
    paint: "violet",
    classId: "tank",
    weapon: "wedge",
    look: "plain",
    number: "6",
    hp: 100,
    storeName: "Plano",
    style: { ...DEFAULT_STYLE, ...style },
  };
}
function names(group: THREE.Object3D) {
  const names: string[] = [];
  group.traverse((object) => names.push(object.name));
  return names;
}
function assertFiniteGeometry(group: THREE.Object3D) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (const value of positions.array)
      assert.ok(Number.isFinite(value), `${object.name} has non-finite geometry`);
    if (object instanceof THREE.InstancedMesh)
      for (const value of object.instanceMatrix.array)
        assert.ok(Number.isFinite(value), `${object.name} has a non-finite instance`);
  });
  const bounds = new THREE.Box3().setFromObject(group);
  assert.ok(!bounds.isEmpty());
  assert.ok(
    [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(
      Number.isFinite,
    ),
  );
}

test("Garage camera framing contains tall, offset accessories throughout a full rotation on phone and desktop", () => {
  const corners = new THREE.Box3(
    new THREE.Vector3(-1.2, 0.02, -1.4),
    new THREE.Vector3(1.65, 2.45, 1.9),
  );
  const center = new THREE.Vector3(0, (corners.max.y + corners.min.y) / 2, 0);
  const radius = Math.hypot(1.65, 1.9, (corners.max.y - corners.min.y) / 2);
  for (const aspect of [0.65, 1, 1.8]) {
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.05, 80);
    const distance = garageCameraDistance(radius, camera.fov, aspect);
    camera.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(1, 0.62, 1.25).normalize(), distance);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      for (const x of [corners.min.x, corners.max.x])
        for (const y of [corners.min.y, corners.max.y])
          for (const z of [corners.min.z, corners.max.z]) {
            const point = new THREE.Vector3(x, y, z)
              .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
              .project(camera);
            assert.ok(
              Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.9,
              `Clipped at aspect ${aspect}, angle ${angle}`,
            );
            assert.ok(point.z > -1 && point.z < 1);
          }
    }
  }
});

test("each catalog topper produces finite geometry, including all free heart flag variants", () => {
  for (const topper of TOPPER_IDS) {
    const group = createGarageCosmetics(look({ topper }), dimensions);
    assertFiniteGeometry(group);
    const mount = group.getObjectByName(`Topper ${topper}`);
    if (topper === "none") assert.equal(mount, undefined);
    else assert.ok(mount && mount.children.length > 0, `${topper} has no visible model`);
  }
});

test("Team Janelle hearts retain their six colors and label surfaces on both sides", () => {
  const colors = {
    pink: "ec4899",
    red: "dc2626",
    purple: "9333ea",
    blue: "2563eb",
    teal: "0f766e",
    gold: "fbbf24",
  } as const;
  for (const [color, hex] of Object.entries(colors)) {
    const group = createGarageCosmetics(
      look({ topper: `janelle-${color}` as BotStyle["topper"] }),
      dimensions,
    );
    const heart = group.getObjectByName("Team Janelle heart") as THREE.Mesh<
      THREE.ExtrudeGeometry,
      THREE.MeshStandardMaterial
    >;
    assert.ok(heart);
    assert.equal(heart.material.color.getHexString(), hex);
    assert.ok(group.getObjectByName("Team Janelle lettering front"));
    assert.ok(group.getObjectByName("Team Janelle lettering rear"));
  }
});

test("independent flag and topper choices coexist and can both be removed", () => {
  const together = createGarageCosmetics(
    look({ topper: "janelle-purple", flag: true }),
    dimensions,
  );
  assert.ok(together.getObjectByName("Team Janelle heart"));
  assert.ok(together.getObjectByName("Saved team flag"));
  const empty = createGarageCosmetics(look({ topper: "none", flag: false }), dimensions);
  assert.ok(!names(empty).some((name) => /flag|Topper/i.test(name)));
});

test("sticker slots preserve explicit none while legacy hood decals still render", () => {
  const legacy = createGarageCosmetics(look({ decal: "flames" }), dimensions);
  assert.ok(legacy.getObjectByName("Hood sticker flames"));
  const explicit = createGarageCosmetics(
    look({
      decal: "flames",
      stickers: { hood: "none", left: "stars", right: "checker", rear: "lightning-foil" },
    }),
    dimensions,
  );
  assert.ok(!names(explicit).some((name) => name.startsWith("Hood sticker")));
  assert.ok(explicit.getObjectByName("left sticker stars"));
  assert.ok(explicit.getObjectByName("right sticker checker"));
  const rear = explicit.getObjectByName("Rear sticker lightning-foil") as THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial
  >;
  assert.ok(rear.material.metalness > 0.5);
});

test("weapon skins cannot disclose a hidden or absent weapon", () => {
  for (const weapon of ["hidden", "none"]) {
    const group = createGarageCosmetics(
      { ...look({ weaponSkin: "hockey-machete" }), weapon },
      dimensions,
    );
    assert.ok(!names(group).some((name) => name.includes("Machete")));
  }
  assert.ok(
    createGarageCosmetics(look({ weaponSkin: "hockey-machete" }), dimensions).getObjectByName(
      "Machete cosmetic blade",
    ),
  );
});

test("rendering a draft appearance never mutates its saved input", () => {
  const input = look({
    topper: "janelle-blue",
    flag: true,
    leds: "arch",
    smoke: "ice",
    mask: "hockey",
    banner: "TEAM PIT",
    stickers: { left: "stars", right: "none", hood: "hazard", rear: "none" },
  });
  const before = structuredClone(input);
  Object.freeze(input.style!.stickers);
  Object.freeze(input.style);
  Object.freeze(input);
  const group = createGarageCosmetics(input, dimensions);
  assertFiniteGeometry(group);
  assert.deepEqual(input, before);
});

test("all catalog equipment families have nonempty 3D attachments", () => {
  const fields = {
    weapon: "weapon",
    drive: "driveFamily",
    armor: "armorFamily",
    chassis: "chassisFamily",
    utility: "utilityFamily",
  } as const;
  const labels = {
    weapon: "Weapon",
    drive: "Drive",
    armor: "Armor",
    chassis: "Chassis equipment",
    utility: "Utility",
  };
  for (const slot of Object.keys(fields) as (keyof typeof fields)[]) {
    const families = [
      ...new Set(PARTS.filter((part) => part.slot === slot).map((part) => part.family)),
    ].sort();
    assert.deepEqual(
      [...GARAGE_MODEL_FAMILIES[slot]].sort(),
      families,
      `${slot} catalog coverage changed`,
    );
    for (const family of families) {
      const model = createGarageBot({ ...look(), [fields[slot]]: family });
      const attachment = model.getObjectByName(`${labels[slot]} · ${family}`);
      assert.ok(attachment && attachment.children.length > 0, `${slot}/${family} has no geometry`);
      assertFiniteGeometry(model);
    }
  }
});

test("every body shell retains a distinct finite silhouette with heart and team flags attached", () => {
  const silhouettes = new Set<string>();
  for (const body of BODY_STYLES) {
    const model = createGarageBot({
      ...look({ body: body.id, topper: "janelle-purple", flag: true }),
      classId: body.classId,
      driveFamily: "treads",
    });
    assertFiniteGeometry(model);
    const shell = model.getObjectByName(`Body shell · ${body.id}`) as THREE.Mesh;
    assert.ok(shell);
    silhouettes.add(JSON.stringify([...shell.geometry.getAttribute("position").array]));
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(bounds.max.y > 1.6, `${body.id} omitted its tall accessories`);
    assert.ok(bounds.max.y < 3 && bounds.min.y > -0.1, `${body.id} has implausible scale`);
  }
  assert.equal(silhouettes.size, BODY_STYLES.length);
});

test("concealed weapons cannot leak model geometry or a cosmetic blade", () => {
  for (const weapon of ["hidden", "none"]) {
    const model = createGarageBot({ ...look({ weaponSkin: "hockey-machete" }), weapon });
    assert.equal(model.getObjectByName(`Weapon · ${weapon}`)?.children.length, 0);
    assert.ok(!names(model).some((name) => name.includes("Machete")));
  }
});

test("side stickers and bay numbers remain outside solid fitted armor", () => {
  for (const armorFamily of [
    "plate",
    "ablative",
    "gel",
    "ceramic",
    "reactive",
    "angle",
    "platter",
  ]) {
    const model = createGarageBot({
      ...look({ stickers: { left: "stars", right: "stars", hood: "none", rear: "none" } }),
      armorFamily,
    });
    const armor = model.getObjectByName(`Armor · ${armorFamily}`)!;
    const bounds = new THREE.Box3().setFromObject(armor);
    const left = model.getObjectByName("left sticker stars")!;
    const right = model.getObjectByName("right sticker stars")!;
    assert.ok(left.position.x < bounds.min.x, `${armorFamily} hides the left sticker`);
    assert.ok(right.position.x > bounds.max.x, `${armorFamily} hides the right sticker`);
    for (const number of model.getObjectsByProperty("name", "Bay number side")) {
      assert.ok(
        number.position.x < bounds.min.x || number.position.x > bounds.max.x,
        `${armorFamily} hides the bay number`,
      );
    }
  }
});

test("new paint and topper choices retain unrepaired wear and do not mutate the loadout", () => {
  const input = {
    ...look({ topper: "janelle-purple" }),
    scars: 3,
    driveFamily: "treads",
    armorFamily: "plate",
    chassisFamily: "keystone",
    utilityFamily: "scry",
  };
  const before = structuredClone(input);
  Object.freeze(input.style);
  Object.freeze(input);
  const initial = createGarageBot(input);
  const repainted = createGarageBot({
    ...input,
    paint: "red",
    style: { ...input.style!, topper: "none" },
  });
  const scars = (model: THREE.Object3D) =>
    names(model).filter((name) => name === "Unrepaired surface scratch").length;
  assert.ok(scars(initial) > 0);
  assert.equal(scars(initial), scars(repainted));
  assert.deepEqual(input, before);
});
