import * as THREE from "three";
import type { GarageLook } from "@/lib/pit/types";
import { paintTeamJanelleBanner } from "../team-janelle-banner";

type Vec = [number, number, number];

function canvasTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The garage textures could not be prepared.");
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Material detail only. Floor choices and arena signage never enter fight calculations. */
export function garageFloorTexture(look: GarageLook) {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = {
      hazard: "#51565c",
      concrete: "#777873",
      night: "#303947",
      bone: "#99968b",
      checker: "#343b43",
    }[look];
    ctx.fillRect(0, 0, 512, 512);
    if (look === "checker") {
      ctx.fillStyle = "#9199a1";
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillRect(256, 256, 256, 256);
    }
    let seed = 241;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 6500; i++) {
      ctx.strokeStyle =
        random() < 0.5 ? `rgba(220,229,235,${random() * 0.09})` : `rgba(0,0,0,${random() * 0.14})`;
      const x = random() * 512,
        y = random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2 + random() * 35, y + random());
      ctx.stroke();
    }
    for (let i = 0; i < 35; i++) {
      const x = random() * 512,
        y = random() * 512;
      ctx.strokeStyle = "rgba(178,186,190,.16)";
      ctx.lineWidth = 0.5 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 15 + random() * 80, y - random() * 45);
      ctx.stroke();
    }
  });
}

/** Reuses the prototype's physical panelled cage instead of a single flat floor texture. */
export function createGarageArena(anisotropy: number) {
  const group = new THREE.Group();
  group.name = "Detailed garage arena corner";
  const metal = new THREE.MeshStandardMaterial({
    color: "#303741",
    metalness: 0.8,
    roughness: 0.4,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: "#6f7882",
    metalness: 0.85,
    roughness: 0.32,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#14181d",
    metalness: 0.45,
    roughness: 0.72,
  });
  const fastener = new THREE.MeshStandardMaterial({
    color: "#a0a9af",
    metalness: 0.9,
    roughness: 0.3,
  });
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#adb4bd",
    metalness: 0.65,
    roughness: 0.66,
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const box = (
    name: string,
    size: Vec,
    pos: Vec,
    material: THREE.Material,
    parent: THREE.Object3D = group,
  ) => {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.name = name;
    mesh.scale.set(...size);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box("Arena plinth", [6.25, 0.24, 6.25], [0, -0.16, 0], dark);
  const floorBolts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.012, 6),
    fastener,
    100,
  );
  floorBolts.name = "Recessed floor panel fasteners";
  floorBolts.castShadow = true;
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let x = 0; x < 5; x++)
    for (let z = 0; z < 5; z++) {
      const px = -2.4 + x * 1.2,
        pz = -2.4 + z * 1.2;
      box("Separate brushed floor plate", [1.184, 0.055, 1.184], [px, -0.012, pz], floorMaterial);
      for (const dx of [-0.49, 0.49])
        for (const dz of [-0.49, 0.49]) {
          matrix.makeTranslation(px + dx, 0.024, pz + dz);
          floorBolts.setMatrixAt(index++, matrix);
        }
    }
  group.add(floorBolts);
  for (const z of [-3.04, 3.04]) box("Floor perimeter rail", [6.2, 0.08, 0.09], [0, 0.02, z], edge);
  for (const x of [-3.04, 3.04]) box("Floor perimeter rail", [0.09, 0.08, 6.2], [x, 0.02, 0], edge);

  const hazardMap = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = "#b98c36";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#25272a";
    for (let x = -128; x < 640; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 32, 0);
      ctx.lineTo(x + 160, 128);
      ctx.lineTo(x + 128, 128);
      ctx.fill();
    }
  });
  hazardMap.wrapS = THREE.RepeatWrapping;
  hazardMap.repeat.set(3, 1);
  hazardMap.anisotropy = anisotropy;
  const hazard = new THREE.MeshStandardMaterial({
    map: hazardMap,
    metalness: 0.32,
    roughness: 0.72,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#c6e1ee",
    metalness: 0.04,
    roughness: 0.1,
    transparent: true,
    opacity: 0.105,
    thickness: 0.025,
    ior: 1.49,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.55,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
  });
  const scuffMap = canvasTexture(512, 512, (ctx) => {
    let seed = 36;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 22; i++) {
      const x = random() * 512,
        y = random() * 512;
      ctx.strokeStyle = `rgba(205,226,235,${0.06 + random() * 0.12})`;
      ctx.lineWidth = 0.5 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + random() * 40, y - 2 - random() * 12);
      ctx.stroke();
    }
  });
  const scuffs = new THREE.MeshBasicMaterial({
    map: scuffMap,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bannerMap = canvasTexture(1024, 240, (ctx) => paintTeamJanelleBanner(ctx, 0, 0, 1024, 240));
  bannerMap.anisotropy = anisotropy;
  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: bannerMap,
    transparent: true,
    roughness: 0.95,
    metalness: 0,
    side: THREE.FrontSide,
    alphaTest: 0.05,
  });
  for (const rotation of [0, Math.PI / 2]) {
    const wall = new THREE.Group();
    wall.name = "Bolted safety wall";
    wall.rotation.y = rotation;
    group.add(wall);
    box("Steel kick plate", [6, 0.42, 0.12], [0, 0.24, -3], metal, wall);
    box("Continuous hazard stripe", [6, 0.105, 0.014], [0, 0.45, -2.927], hazard, wall);
    box("Top structural rail", [6.18, 0.1, 0.14], [0, 2.23, -3], edge, wall);
    for (let i = 0; i < 4; i++) {
      const x = -3 + i * 2;
      box("Wall upright", [0.11, 2.35, 0.15], [x, 1.16, -3], metal, wall);
      box("Anchored upright foot", [0.3, 0.09, 0.29], [x, 0.06, -2.96], edge, wall);
      for (const y of [0.61, 1.35, 2.08]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.016, 6), fastener);
        bolt.name = "Wall fastener";
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(x, y, -2.91);
        wall.add(bolt);
      }
      if (i < 3) {
        box(
          "Individual polycarbonate panel",
          [1.89, 1.68, 0.035],
          [x + 1, 1.36, -3],
          glass,
          wall,
        ).castShadow = false;
        const marks = new THREE.Mesh(new THREE.PlaneGeometry(1.89, 1.68), scuffs);
        marks.name = "Safety glass scuffs";
        marks.position.set(x + 1, 1.36, -2.979);
        wall.add(marks);
      }
    }
    // Each open cage corner has a sign visible behind the bot, above the combat floor.
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.633), bannerMaterial);
    banner.name = "Team Janelle arena banner";
    banner.position.set(0.65, 1.78, -2.9);
    wall.add(banner);
    // Back face has its own orientation so lettering never reads in reverse when orbiting.
    const rear = banner.clone();
    rear.name = "Team Janelle arena banner reverse";
    rear.position.z = -3.09;
    rear.rotation.y = Math.PI;
    wall.add(rear);
  }
  const lamp = new THREE.MeshStandardMaterial({
    color: "#ffce7b",
    emissive: "#ffad37",
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  for (const z of [-2.6, -0.6, 1.4]) {
    box("Wall lamp housing", [0.15, 0.09, 0.52], [-2.89, 0.53, z], dark);
    box("Amber wall lamp", [0.04, 0.035, 0.4], [-2.8, 0.55, z], lamp);
  }
  const markingMap = canvasTexture(512, 256, (ctx) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(201,177,119,.6)";
    ctx.font = "bold 64px Arial";
    ctx.fillText("THE PIT", 256, 128);
    ctx.strokeStyle = "rgba(201,177,119,.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 62, 464, 132);
  });
  const marking = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.85),
    new THREE.MeshBasicMaterial({
      map: markingMap,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  marking.name = "Arena floor stencil";
  marking.rotation.x = -Math.PI / 2;
  marking.position.set(1.65, 0.026, 1.85);
  group.add(marking);
  return { group, floorMaterial };
}
