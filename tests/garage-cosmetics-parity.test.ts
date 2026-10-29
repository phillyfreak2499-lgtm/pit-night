import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createGarageCosmetics } from "../src/components/pit/garage-3d/cosmetics.ts";
import { DEFAULT_STYLE } from "../src/lib/pit/catalog.ts";
import { makeData } from "../src/lib/pit/seed.ts";
import { drawFlag } from "../src/components/pit/cage-draw.ts";
import { botFrameOf } from "../src/components/pit/bot-frame.ts";
import { measureTeamFlag } from "../src/components/pit/team-flag.ts";
import type { BotLookProps } from "../src/components/pit/bot-portrait.tsx";

const dimensions = { roofY: 0.94, width: 1.48, depth: 1.96 };
const southlake: BotLookProps = {
  id: "southlake",
  storeName: "Southlake",
  paint: "lime",
  classId: "tank",
  weapon: "saw",
  look: "plain",
  number: "4",
  hp: 100,
  driveFamily: "mag",
  style: { ...DEFAULT_STYLE, body: "keystone", flag: true, trim: "steel" },
};

test("Heart topper keeps the classic side profile's size and forward mount on the 3D hull", () => {
  const model = createGarageCosmetics(
    { ...southlake, style: { ...southlake.style!, topper: "janelle-pink" } },
    dimensions,
  );
  model.updateMatrixWorld(true);
  const heart = model.getObjectByName("Team Janelle heart")!;
  const bounds = new THREE.Box3().setFromObject(heart),
    size = bounds.getSize(new THREE.Vector3());
  // Classic drawing is 0.42 bot units wide, with 2 world units per bot unit.
  // Its exact bezier outline extends slightly beyond the nominal width.
  assert.ok(
    size.z > 0.84 && size.z < 0.92,
    `Heart should span the bot's lengthwise side profile; got ${size.z}`,
  );
  assert.ok(size.y > 0.7 && size.y < 0.85, `Heart silhouette is too small: ${size.y}`);
  const center = heart.getWorldPosition(new THREE.Vector3());
  assert.ok(
    Math.abs(center.z - 0.3) < 0.01,
    "heart moved behind the hatch instead of slightly ahead",
  );
  const pole = new THREE.Box3().setFromObject(model.getObjectByName("Heart flag pole")!);
  assert.ok(Math.abs(pole.max.y - (dimensions.roofY - 0.045 + 1.016)) < 0.02);
});

test("Team pennant keeps the same mast and cloth proportions across cosmetic body lengths", () => {
  let previousLength: number | undefined;
  for (const depth of [1.6, 2.2]) {
    const model = createGarageCosmetics(southlake, { ...dimensions, depth });
    model.updateMatrixWorld(true);
    const cloth = new THREE.Box3().setFromObject(model.getObjectByName("Team flag cloth")!);
    const length = cloth.getSize(new THREE.Vector3()).z;
    assert.ok(length > 0.6, "store name needs more room than the original truncated flag");
    if (previousLength !== undefined) assert.equal(length, previousLength);
    previousLength = length;
    const mast = new THREE.Box3().setFromObject(model.getObjectByName("Team flag mast")!);
    assert.ok(Math.abs(mast.max.y - (dimensions.roofY - 0.045 + 1)) < 0.02);
    assert.ok(
      mast.min.z < -0.85 && mast.max.z > -0.77,
      "pennant mast belongs at the rear of the same normalized hull",
    );
  }
});

type Draw = { method: string; args: unknown[]; fill: unknown; stroke: unknown; font: unknown };
function measuredTextWidth(text: string, font: unknown) {
  const fontSize = Number(String(font).match(/([\d.]+)px/)?.[1] ?? 10);
  return (
    [...text].reduce(
      (width, character) =>
        width + ("MW—".includes(character) ? 0.9 : " I".includes(character) ? 0.3 : 0.6),
      0,
    ) * fontSize
  );
}
function recordingCanvas() {
  const draws: Draw[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, name: string) {
      if (name in target) return target[name];
      return (...args: unknown[]) => {
        draws.push({
          method: name,
          args,
          fill: target.fillStyle,
          stroke: target.strokeStyle,
          font: target.font,
        });
        if (name === "measureText")
          return { width: measuredTextWidth(String(args[0]), target.font) };
        if (name.startsWith("create")) return { addColorStop() {} };
      };
    },
  });
  return {
    width: 0,
    height: 0,
    draws,
    getContext: () => ctx as unknown as CanvasRenderingContext2D,
  };
}
// Node has no Canvas2D. Record only the texture drawing boundary, keeping the
// actual cosmetics builder, label drawing, mesh geometry and transforms intact.
function withCanvas<T>(run: () => T): T {
  const before = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, "canvas");
        return recordingCanvas();
      },
    },
  });
  try {
    return run();
  } finally {
    if (before) Object.defineProperty(globalThis, "document", before);
    else Reflect.deleteProperty(globalThis, "document");
  }
}
function textureDraws(mesh: THREE.Object3D): Draw[] {
  return (
    (mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.map?.image as {
      draws: Draw[];
    }
  ).draws;
}
function triangleArea(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position"),
    index = geometry.index;
  let area = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map((k) =>
      new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k),
    );
    area += points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 2;
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  return area / (size.x * size.y);
}

test("Southlake's saved flag remains a paint-colored triangular store pennant in 3D", () =>
  withCanvas(() => {
    const model = createGarageCosmetics(southlake, dimensions);
    const cloth = (model.getObjectByName("Team flag cloth") ??
      model.getObjectByName("Team flag cloth front")) as THREE.Mesh;
    assert.ok(cloth);
    assert.ok(triangleArea(cloth.geometry) < 0.55, "team pennant became a rectangular number flag");
    const labels = model.getObjectsByProperty("name", "Team flag lettering front");
    assert.equal(labels.length, 1);
    assert.ok(
      textureDraws(labels[0]).some(
        (draw) => draw.method === "fillText" && draw.args[0] === "SOUTHLAKE",
      ),
    );
    const rear = model.getObjectByName("Team flag lettering rear")!;
    assert.ok(rear, "store name needs a readable rear face as well");
    assert.equal((cloth.material as THREE.MeshStandardMaterial).color.getHexString(), "9bc53d");
    model.updateMatrixWorld(true);
    const frontNormal = new THREE.Vector3(0, 0, 1).transformDirection(labels[0].matrixWorld);
    const rearNormal = new THREE.Vector3(0, 0, 1).transformDirection(rear.matrixWorld);
    assert.ok(frontNormal.dot(rearNormal) < -0.99);
  }));

test("Stripe and chevron selections remain visible on both hull sides rather than only the roof", () =>
  withCanvas(() => {
    for (const look of ["stripe", "chevron"] as const) {
      const model = createGarageCosmetics({ ...southlake, look }, dimensions);
      for (const side of ["left", "right"]) {
        const pattern = model.getObjectByName(`${look} ${side} pattern`);
        assert.ok(pattern, `${look} missing from ${side} hull`);
        const draws = textureDraws(pattern);
        assert.ok(draws.some((draw) => draw.fill === "#0e0d0b" || draw.stroke === "#0e0d0b"));
        if (look === "stripe")
          assert.ok(draws.some((draw) => draw.method === "fillRect" && draw.fill === "#f3efe6"));
      }
    }
    const plain = createGarageCosmetics(southlake, dimensions);
    assert.ok(!plain.getObjectByName("stripe left pattern"));
  }));

test("A team pennant uses trim color only when explicitly selected and does not substitute the pit banner", () =>
  withCanvas(() => {
    const model = createGarageCosmetics(
      { ...southlake, style: { ...southlake.style!, trim: "blue", banner: "GO TEAM" } },
      dimensions,
    );
    const cloth = model.getObjectByName("Team flag cloth") as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    assert.ok(cloth);
    assert.equal(cloth.material.color.getHexString(), "3d8fe8");
    assert.ok(
      textureDraws(model.getObjectByName("Team flag lettering front")!).some(
        (draw) => draw.method === "fillText" && draw.args[0] === "SOUTHLAKE",
      ),
    );
    assert.ok(
      textureDraws(model.getObjectByName("Saved pit banner")!).some(
        (draw) => draw.method === "fillText" && draw.args[0] === "GO TEAM",
      ),
    );
  }));

test("Every store's full name is printed on both faces of its team pennant", () =>
  withCanvas(() => {
    for (const store of makeData().stores) {
      const model = createGarageCosmetics({ ...southlake, storeName: store.name }, dimensions);
      const cloth = model.getObjectByName("Team flag cloth") as THREE.Mesh;
      cloth.geometry.computeBoundingBox();
      const clothBounds = cloth.geometry.boundingBox!;
      for (const face of ["front", "rear"]) {
        const label = model.getObjectByName(`Team flag lettering ${face}`) as THREE.Mesh<
          THREE.PlaneGeometry,
          THREE.MeshStandardMaterial
        >;
        const textDraws = textureDraws(label).filter((draw) => draw.method === "fillText");
        const text = textDraws.map((draw) => draw.args[0]).join(" ");
        assert.equal(text, store.name.toUpperCase(), `${store.name} was shortened on the ${face}`);
        const labelRight = label.position.x + label.geometry.parameters.width / 2;
        const taperHeight =
          ((clothBounds.max.x - labelRight) / (clothBounds.max.x - clothBounds.min.x)) *
          (clothBounds.max.y - clothBounds.min.y);
        assert.ok(
          label.geometry.parameters.height < taperHeight,
          `${store.name} label extends past triangular cloth`,
        );
        for (const draw of textDraws) {
          assert.ok(
            measuredTextWidth(String(draw.args[0]), draw.font) < label.material.map!.image.width,
            `${store.name} overflows its texture`,
          );
          assert.equal(draw.args.length, 3, "names should fit without compressing the lettering");
        }
      }
    }
  }));

test("Classic flags print every store name at a readable size inside the measured pennant on both facings", () => {
  for (const store of makeData().stores) {
    for (const facing of [-1, 1]) {
      const canvas = recordingCanvas(),
        ctx = canvas.getContext();
      const layout = measureTeamFlag(ctx, store.name);
      drawFlag(
        ctx,
        botFrameOf("tank", "keystone"),
        200,
        0,
        "#b8b2a6",
        "#9bc53d",
        store.name,
        0,
        false,
        facing,
      );
      const textDraws = canvas.draws.filter((draw) => draw.method === "fillText");
      assert.equal(textDraws.map((draw) => draw.args[0]).join(" "), store.name.toUpperCase());
      assert.ok(
        canvas.draws.some((draw) => draw.method === "scale" && draw.args[0] === facing),
        "back-facing letters are mirrored",
      );
      for (const draw of textDraws) {
        assert.ok(measuredTextWidth(String(draw.args[0]), draw.font) < layout.labelWidth * 200);
        assert.equal(
          draw.font,
          "700 10px Arial, sans-serif",
          "long names should enlarge the flag instead of shrinking the font",
        );
      }
      const right = layout.labelCenter + layout.labelWidth / 2;
      assert.ok(layout.labelHeight < layout.drop * (1 - right / layout.length));
    }
  }
});
