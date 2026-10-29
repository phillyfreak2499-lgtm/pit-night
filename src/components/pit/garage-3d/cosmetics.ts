import * as THREE from "three";
import { LEDS, PAINT, SMOKE, TRIM, styleOf } from "@/lib/pit/catalog";
import type { BotLookProps } from "../bot-portrait";
import { stickerBadge } from "../cage-draw";
import { botFrameOf } from "../bot-frame";
import { measureTeamFlag, paintTeamFlagName } from "../team-flag";

type Dimensions = {
  roofY: number;
  width: number;
  depth: number;
  sidePanelX?: number;
  frontLabelY?: number;
};
type Point = [number, number, number];

/** Small, locally drawn labels remain sharp without shipping an atlas per store. */
function canvasMap(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  width = 512,
  height = 256,
) {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function labelMap(text: string, background = "#e9e6dc", color = "#17191d", height = 256) {
  return canvasMap(
    (ctx, w, h) => {
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.min(h * 0.72, w / Math.max(text.length * 0.65, 1.5))}px Arial, sans-serif`;
      ctx.fillText(text, w / 2, h * 0.53, w * 0.92);
    },
    512,
    height,
  );
}

/** Cosmetic geometry reads saved appearance only; it never edits equipment or battle state. */
export function createGarageCosmetics(
  look: BotLookProps,
  {
    roofY,
    width,
    depth,
    sidePanelX = width / 2 + 0.055,
    frontLabelY = Math.min(0.59, roofY * 0.64),
  }: Dimensions,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "Saved Garage cosmetics";
  const style = styleOf(look);
  const sideLabelY =
    look.armorFamily === "plate" ? 0.55 : Math.max(0.51, Math.min(0.6, roofY * 0.64));
  const steel = new THREE.MeshStandardMaterial({
    color: "#aab3bc",
    roughness: 0.32,
    metalness: 0.85,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#17191d",
    roughness: 0.6,
    metalness: 0.3,
  });
  const gold = new THREE.MeshStandardMaterial({ color: "#e9be52", roughness: 0.3, metalness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({
    color: TRIM[style.trim] ?? TRIM.steel,
    roughness: 0.45,
    metalness: 0.65,
  });
  const red = new THREE.MeshStandardMaterial({ color: "#d9483c", roughness: 0.5 });
  const green = new THREE.MeshStandardMaterial({ color: "#487b46", roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: "#9a6235", roughness: 0.8 });
  const add = <T extends THREE.Object3D>(
    object: T,
    name: string,
    point: Point = [0, 0, 0],
    parent: THREE.Object3D = group,
  ) => {
    object.name = name;
    object.position.set(...point);
    parent.add(object);
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
    return object;
  };
  const box = (
    name: string,
    size: Point,
    point: Point,
    material: THREE.Material = steel,
    parent: THREE.Object3D = group,
  ) => add(new THREE.Mesh(new THREE.BoxGeometry(...size), material), name, point, parent);
  const cylinder = (
    name: string,
    radius: number,
    length: number,
    point: Point,
    material: THREE.Material = steel,
    parent: THREE.Object3D = group,
    topRadius = radius,
  ) =>
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(topRadius, radius, length, 18), material),
      name,
      point,
      parent,
    );
  const sphere = (
    name: string,
    radius: number,
    point: Point,
    material: THREE.Material,
    parent: THREE.Object3D = group,
  ) => add(new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material), name, point, parent);
  const surface = (
    name: string,
    map: THREE.Texture,
    size: [number, number],
    point: Point,
    rotation: Point = [0, 0, 0],
    parent: THREE.Object3D = group,
    foil = false,
  ) => {
    const material = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      roughness: foil ? 0.2 : 0.6,
      metalness: foil ? 0.65 : 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      depthWrite: false,
    });
    const mesh = add(
      new THREE.Mesh(new THREE.PlaneGeometry(...size), material),
      name,
      point,
      parent,
    );
    mesh.rotation.set(...rotation);
    mesh.castShadow = false;
    return mesh;
  };
  const doubleLabel = (
    name: string,
    map: THREE.Texture,
    size: [number, number],
    point: Point,
    parent: THREE.Object3D,
  ) => {
    surface(name + " front", map, size, [point[0], point[1], point[2] + 0.014], [0, 0, 0], parent);
    surface(
      name + " rear",
      map,
      size,
      [point[0], point[1], point[2] - 0.014],
      [0, Math.PI, 0],
      parent,
    );
  };

  // Match the broadcast's white racing stripe, dark side chevrons and extra
  // rivets. These are hull markings, independent of the four sticker slots.
  if (look.look === "stripe") {
    const pattern = canvasMap((ctx, w, h) => {
      ctx.fillStyle = "#f3efe6";
      ctx.fillRect(w * 0.42, 0, w * 0.16, h);
    });
    surface(
      `${look.look} roof pattern`,
      pattern,
      [width * 0.6, depth * 0.29],
      [0, roofY + 0.008, 0.04],
      [-Math.PI / 2, 0, 0],
    );
  }
  if (look.look === "stripe" || look.look === "chevron") {
    const sideHeight = Math.max(0.24, roofY - 0.36);
    for (const side of [-1, 1]) {
      const pattern = canvasMap((ctx, w, h) => {
        if (look.look === "stripe") {
          ctx.fillStyle = "#f3efe6";
          ctx.fillRect(0, h * 0.22, w, h * 0.12);
          ctx.fillStyle = "#0e0d0b";
          ctx.fillRect(0, h * 0.34, w, h * 0.04);
        } else {
          ctx.strokeStyle = "#0e0d0b";
          ctx.lineWidth = w * 0.045;
          // Each plane faces outward, so reverse the pattern on the opposite
          // flank to keep its points aimed toward the actual front (+Z).
          const X = (x: number) => (side < 0 ? x : 1 - x) * w;
          for (const offset of [0, 0.09]) {
            ctx.beginPath();
            ctx.moveTo(X(0.16 + offset), h * 0.1);
            ctx.lineTo(X(0.3 + offset), h * 0.45);
            ctx.lineTo(X(0.16 + offset), h * 0.8);
            ctx.stroke();
          }
        }
      });
      surface(
        `${look.look} ${side < 0 ? "left" : "right"} pattern`,
        pattern,
        [depth * 0.86, sideHeight],
        [side * (sidePanelX - 0.002), 0.36 + sideHeight / 2, -depth * 0.03],
        [0, (side * Math.PI) / 2, 0],
      );
    }
  }
  if (look.look === "rivets") {
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const rivet = cylinder(
          "Saved extra hull rivet",
          0.024,
          0.012,
          [side * sidePanelX, roofY - 0.1, depth * (-0.4 + i * 0.1)],
          steel,
        );
        rivet.rotation.z = Math.PI / 2;
      }
  }

  for (const [slot, decal] of Object.entries(style.stickers ?? {})) {
    if (!decal || decal === "none") continue;
    const map = canvasMap((ctx, w, h) => {
      stickerBadge(
        ctx,
        decal,
        w / 2,
        h / 2,
        w * 0.94,
        h * 0.9,
        PAINT[look.paint] ?? "#8457c9",
        look.id,
        look.number,
        true,
      );
    });
    const foil = decal.endsWith("-foil");
    if (slot === "hood")
      surface(
        "Hood sticker " + decal,
        map,
        [width * 0.54, depth * 0.26],
        [0, roofY + 0.014, 0.04],
        [-Math.PI / 2, 0, 0],
        group,
        foil,
      );
    else if (slot === "rear")
      surface(
        "Rear sticker " + decal,
        map,
        [width * 0.58, 0.23],
        [0, Math.max(0.47, roofY * 0.64), -depth / 2 - 0.042],
        [0, Math.PI, 0],
        group,
        foil,
      );
    else
      surface(
        `${slot} sticker ${decal}`,
        map,
        [depth * 0.42, depth * 0.16],
        [(slot === "left" ? -1 : 1) * sidePanelX, sideLabelY, -0.06],
        [0, ((slot === "left" ? -1 : 1) * Math.PI) / 2, 0],
        group,
        foil,
      );
  }
  if (look.number) {
    const map = labelMap(look.number, "#e9e6dc", "#17191d", 384);
    surface("Bay number front", map, [0.24, 0.18], [-width * 0.28, frontLabelY, depth / 2 + 0.047]);
    for (const side of [-1, 1])
      surface(
        "Bay number side",
        map,
        [0.19, 0.2],
        [side * (sidePanelX + 0.004), sideLabelY, depth * 0.25],
        [0, (side * Math.PI) / 2, 0],
      );
  }
  if (style.banner) {
    const map = labelMap(style.banner, "#1b1d20", "#f0ca70");
    surface(
      "Saved pit banner",
      map,
      [width * 0.72, 0.16],
      [0, Math.max(0.47, roofY * 0.64), -depth / 2 - 0.05],
      [0, Math.PI, 0],
    );
  }

  const topper = style.topper ?? "none";
  const mount = new THREE.Group();
  mount.name = `Topper ${topper}`;
  // Accessories sit on the shell behind the hatch, whose top is .045 above the roof.
  mount.position.set(-width * 0.17, roofY - 0.043, -depth * 0.18);
  if (topper !== "none") group.add(mount);
  if (topper.startsWith("janelle-")) {
    const colors: Record<string, string> = {
      pink: "#ec4899",
      red: "#dc2626",
      purple: "#9333ea",
      blue: "#2563eb",
      teal: "#0f766e",
      gold: "#fbbf24",
    };
    const color = colors[topper.slice(8)] ?? colors.pink;
    // drawJanelleFlag uses a .42-unit heart at +.15 forward and .34 above
    // the roof. Match its exact outline at the shared body's 2-world-unit scale.
    // Face both flanks, so a side view shows the same heart rather than its edge.
    mount.position.set(-width * 0.17, roofY - 0.045, 0);
    mount.rotation.y = -Math.PI / 2;
    cylinder("Heart flag pole", 0.014, 1.092, [-0.036, 0.47, 0], steel, mount);
    cylinder("Heart flag roof socket", 0.05, 0.035, [-0.036, 0.018, 0], black, mount);
    const size = 0.84;
    const X = (value: number) => value * size;
    const Y = (value: number) => -value * size;
    const shape = new THREE.Shape();
    shape.moveTo(0, Y(0.52));
    shape.bezierCurveTo(X(-0.18), Y(0.35), X(-0.65), Y(0.04), X(-0.48), Y(-0.25));
    shape.bezierCurveTo(X(-0.35), Y(-0.48), X(-0.1), Y(-0.38), 0, Y(-0.22));
    shape.bezierCurveTo(X(0.1), Y(-0.38), X(0.35), Y(-0.48), X(0.48), Y(-0.25));
    shape.bezierCurveTo(X(0.65), Y(0.04), X(0.18), Y(0.35), 0, Y(0.52));
    add(
      new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.018,
          bevelEnabled: true,
          bevelSize: 0.005,
          bevelThickness: 0.004,
          bevelSegments: 1,
          curveSegments: 16,
        }),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12 }),
      ),
      "Team Janelle heart",
      [0.3, 0.68, -0.009],
      mount,
    );
    const lettering = canvasMap((ctx, w, h) => {
      ctx.fillStyle = topper === "janelle-gold" ? "#241b12" : "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 84px Arial, sans-serif";
      ctx.fillText("TEAM", w / 2, h * 0.3);
      ctx.fillText("JANELLE", w / 2, h * 0.7, w * 0.96);
    });
    doubleLabel("Team Janelle lettering", lettering, [0.72, 0.378], [0.3, 0.6716, 0], mount);
  } else if (topper === "antenna") {
    cylinder("Whip antenna base", 0.06, 0.07, [0, 0.035, 0], black, mount);
    cylinder("Whip antenna", 0.008, 0.67, [0, 0.37, 0], steel, mount);
    sphere("Antenna tip", 0.027, [0, 0.72, 0], red, mount);
  } else if (topper === "horns") {
    const ivory = new THREE.MeshStandardMaterial({ color: "#e0d5bd", roughness: 0.55 });
    for (const side of [-1, 1]) {
      const horn = add(
        new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 16), ivory),
        "Pit horn",
        [side * 0.27, 0.18, 0],
        mount,
      );
      horn.rotation.z = -side * 0.48;
      cylinder("Horn bracket", 0.1, 0.05, [side * 0.22, 0.025, 0], black, mount);
    }
  } else if (topper === "mohawk") {
    box("Mohawk rail", [0.07, 0.035, 0.55], [0, 0.02, 0], black, mount);
    for (let i = 0; i < 5; i++)
      add(
        new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), trim),
        "Steel mohawk spike",
        [0, 0.14, -0.22 + i * 0.11],
        mount,
      );
  } else if (topper === "crown") {
    cylinder("Crown band", 0.23, 0.09, [0, 0.055, 0], gold, mount);
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      add(
        new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), gold),
        "Crown point",
        [Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18],
        mount,
      );
      sphere("Crown jewel", 0.025, [Math.cos(a) * 0.235, 0.06, Math.sin(a) * 0.235], red, mount);
    }
  } else if (topper === "beacon") {
    cylinder("Beacon socket", 0.13, 0.055, [0, 0.03, 0], black, mount);
    const amber = new THREE.MeshStandardMaterial({
      color: "#ffad37",
      emissive: "#ff8a10",
      emissiveIntensity: 0.8,
      roughness: 0.25,
    });
    cylinder("Amber beacon", 0.105, 0.18, [0, 0.14, 0], amber, mount);
    sphere("Beacon cap", 0.105, [0, 0.22, 0], amber, mount).scale.y = 0.45;
  } else if (topper === "dish") {
    cylinder("Dish stem", 0.025, 0.25, [0, 0.125, 0], steel, mount);
    const dish = add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.36),
        new THREE.MeshStandardMaterial({
          color: "#aeb9c2",
          metalness: 0.8,
          roughness: 0.35,
          side: THREE.DoubleSide,
        }),
      ),
      "Satellite reflector",
      [0, 0.43, 0],
      mount,
    );
    dish.rotation.x = Math.PI * 0.68;
    const aerial = cylinder("Dish receiver", 0.012, 0.2, [0, 0.4, 0.17], black, mount);
    aerial.rotation.x = Math.PI / 2;
  } else if (topper === "flagpole") {
    cylinder("Tall flag pole", 0.014, 0.85, [0, 0.425, 0], steel, mount);
    const pennant = new THREE.Shape();
    pennant.moveTo(0, 0.85);
    pennant.lineTo(0.4, 0.7);
    pennant.lineTo(0, 0.55);
    pennant.closePath();
    add(
      new THREE.Mesh(
        new THREE.ShapeGeometry(pennant),
        new THREE.MeshStandardMaterial({
          color: "#e0402e",
          roughness: 0.86,
          side: THREE.DoubleSide,
        }),
      ),
      "Pit flag",
      [0, 0, 0],
      mount,
    );
  } else if (topper === "tophat" || topper === "pilgrimhat") {
    cylinder("Hat brim", 0.31, 0.035, [0, 0.025, 0], black, mount);
    cylinder("Hat crown", 0.2, 0.34, [0, 0.21, 0], black, mount, topper === "tophat" ? 0.21 : 0.16);
    cylinder("Hat band", 0.206, 0.055, [0, 0.095, 0], topper === "tophat" ? gold : wood, mount);
    if (topper === "pilgrimhat") {
      box("Hat gold buckle", [0.09, 0.08, 0.02], [0, 0.1, 0.209], gold, mount);
      box("Hat buckle inset", [0.052, 0.043, 0.022], [0, 0.1, 0.22], black, mount);
    }
  } else if (topper === "wreath") {
    const wreath = add(
      new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 24), wood),
      "Harvest wreath",
      [0, 0.055, 0],
      mount,
    );
    wreath.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      const leaf = sphere(
        "Harvest leaf",
        0.065,
        [Math.cos(a) * 0.22, 0.06, Math.sin(a) * 0.22],
        i % 3 ? green : gold,
        mount,
      );
      leaf.scale.set(0.6, 0.35, 1.5);
      leaf.rotation.y = -a;
    }
  } else if (topper === "bugle") {
    const tube = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, 0.14, 0),
      new THREE.Vector3(-0.28, 0.1, -0.12),
      new THREE.Vector3(0, 0.13, -0.18),
      new THREE.Vector3(0.2, 0.19, 0),
    ]);
    add(
      new THREE.Mesh(new THREE.TubeGeometry(tube, 18, 0.025, 8, false), gold),
      "Bugle curved brass tubing",
      [0, 0, 0],
      mount,
    );
    const bell = cylinder("Bugle bell", 0.12, 0.2, [0.26, 0.19, 0], gold, mount, 0.025);
    bell.rotation.z = Math.PI / 2;
    const opening = cylinder(
      "Bugle dark bell opening",
      0.095,
      0.006,
      [0.363, 0.19, 0],
      black,
      mount,
    );
    opening.rotation.z = Math.PI / 2;
    box("Bugle mount", [0.12, 0.08, 0.1], [0, 0.04, 0], black, mount);
  } else if (topper === "tincan") {
    cylinder("Recycled tin can", 0.19, 0.29, [0, 0.16, 0], steel, mount);
    for (const y of [0.035, 0.075, 0.245, 0.285])
      cylinder("Tin can rim", 0.198, 0.012, [0, y, 0], steel, mount);
    surface(
      "Tin can recycling mark",
      labelMap("RECYCLE", "#d9d3c7", "#326142"),
      [0.3, 0.11],
      [0, 0.16, 0.193],
      [0, 0, 0],
      mount,
    );
  }

  if (style.flag) {
    const flag = new THREE.Group();
    flag.name = "Saved team flag";
    group.add(flag);
    const frame = botFrameOf(look.classId, style.body);
    const treads = look.driveFamily ? look.driveFamily === "treads" : frame.treads;
    flag.position.set(width * 0.3, roofY - 0.045, treads ? -0.72 : -0.76);
    // The broadcast pennant trails toward the rear and carries the store name.
    // A custom pit banner is a separate saved rear-panel decoration.
    flag.rotation.y = Math.PI / 2;
    const measuringContext =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    const layout = measureTeamFlag(measuringContext, look.storeName);
    const height = 1,
      length = layout.length * 2,
      drop = layout.drop * 2,
      lean = 0.1;
    const mast = cylinder(
      "Team flag mast",
      0.012,
      Math.hypot(height, lean),
      [lean / 2, height / 2, 0],
      steel,
      flag,
    );
    mast.rotation.z = -Math.atan2(lean, height);
    cylinder("Team flag socket", 0.035, 0.035, [0, 0.0175, 0], black, flag);
    const pennant = new THREE.Shape();
    pennant.moveTo(lean, height);
    pennant.lineTo(lean + length, height - drop / 2);
    pennant.lineTo(lean, height - drop);
    pennant.closePath();
    add(
      new THREE.Mesh(
        new THREE.ShapeGeometry(pennant),
        new THREE.MeshStandardMaterial({
          color: style.trim === "steel" ? (PAINT[look.paint] ?? PAINT.amber) : TRIM[style.trim],
          roughness: 0.88,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
      ),
      "Team flag cloth",
      [0, 0, 0],
      flag,
    );
    doubleLabel(
      "Team flag lettering",
      canvasMap(
        (ctx, w, h) => {
          ctx.translate(w / 2, h / 2);
          paintTeamFlagName(ctx, layout, w / layout.labelWidth);
        },
        512,
        Math.ceil((512 * layout.labelHeight) / layout.labelWidth),
      ),
      [layout.labelWidth * 2, layout.labelHeight * 2],
      [lean + layout.labelCenter * 2, height - drop / 2, 0],
      flag,
    );
  }
  if (style.leds && style.leds !== "none") {
    const color = LEDS[style.leds].hex;
    const led = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    for (const side of [-1, 1])
      box(
        "Saved light strip",
        [0.02, 0.025, depth * 0.69],
        [side * (width / 2 + 0.055), 0.42, 0],
        led,
      );
    box("Front saved light strip", [width * 0.68, 0.025, 0.02], [0, 0.41, depth / 2 + 0.045], led);
  }
  if (style.smoke) {
    const color = SMOKE[style.smoke].hex;
    const map = canvasMap(
      (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gradient.addColorStop(0, "rgba(255,255,255,.5)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      },
      64,
      64,
    );
    const mat = new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    for (let i = 0; i < 5; i++) {
      const puff = add(new THREE.Sprite(mat), "Saved smoke preview", [
        Math.sin(i * 2.1) * 0.11,
        roofY * 0.7 + i * 0.11,
        -depth / 2 - 0.1 - i * 0.06,
      ]);
      puff.scale.setScalar(0.2 + i * 0.065);
    }
  }
  if (style.mask && style.mask !== "none") {
    const isLantern = style.mask === "lantern";
    const mat = new THREE.MeshStandardMaterial({
      color: isLantern ? "#dc7921" : "#d5d0bd",
      roughness: 0.63,
    });
    const faceY = frontLabelY + 0.04,
      faceZ = depth / 2 + 0.07;
    const face = sphere(
      isLantern ? "Lantern face mask" : "Hockey face mask",
      0.17,
      [0, faceY, faceZ],
      mat,
    );
    face.scale.set(1, isLantern ? 0.85 : 1.18, 0.35);
    for (const x of [-0.065, 0.065]) {
      const hole = sphere("Mask eye opening", 0.028, [x, faceY + 0.035, faceZ + 0.057], black);
      hole.scale.set(1.3, 0.75, 0.2);
    }
    if (isLantern) {
      box("Lantern carved mouth", [0.12, 0.022, 0.012], [0, faceY - 0.065, faceZ + 0.058], black);
      cylinder("Lantern stem", 0.025, 0.045, [0, faceY + 0.16, faceZ], green);
    } else {
      for (const x of [-0.05, 0, 0.05])
        for (const y of [-0.035, -0.08]) {
          const vent = sphere("Hockey mask vent", 0.011, [x, faceY + y, faceZ + 0.06], black);
          vent.scale.z = 0.25;
        }
    }
  }
  // A skin is never shown when the actual equipped weapon is concealed or absent.
  if (style.weaponSkin === "hockey-machete" && look.weapon !== "hidden" && look.weapon !== "none") {
    const handle = box(
      "Machete cosmetic handle",
      [0.07, 0.07, 0.2],
      [width * 0.36, 0.48, depth / 2 + 0.03],
      black,
    );
    const blade = box(
      "Machete cosmetic blade",
      [0.13, 0.018, 0.48],
      [handle.position.x, 0.48, depth / 2 + 0.33],
      steel,
    );
    blade.rotation.y = -0.12;
    box(
      "Machete cosmetic red stripe",
      [0.13, 0.004, 0.035],
      [handle.position.x, 0.491, depth / 2 + 0.47],
      red,
    );
  }
  // Unused shared materials are not traversed by the scene's resource cleanup.
  const used = new Set<THREE.Material>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh)
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) =>
        used.add(material),
      );
  });
  for (const material of [steel, black, gold, trim, red, green, wood])
    if (!used.has(material)) material.dispose();
  return group;
}
