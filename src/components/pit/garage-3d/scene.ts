import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { BotLookProps } from "../bot-portrait";
import type { GarageLook } from "@/lib/pit/types";
import { createGarageBot } from "./bot-model";
import { garageCameraDistance } from "./framing";

export type GarageScene = {
  update: (look: BotLookProps, floor: GarageLook) => void;
  setPlaying: (playing: boolean) => void;
  setVisible: (visible: boolean) => void;
  reset: () => void;
  zoom: (factor: number) => void;
  dispose: () => void;
};

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function floorTexture(look: GarageLook) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = {
    hazard: "#383c42",
    concrete: "#686968",
    night: "#202936",
    bone: "#99968b",
    checker: "#373c43",
  }[look];
  ctx.fillRect(0, 0, 256, 256);
  let seed = 42;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = random() > 0.5 ? "rgba(220,226,230,.08)" : "rgba(0,0,0,.1)";
    ctx.fillRect(random() * 256, random() * 256, random() * 22 + 1, 1);
  }
  if (look === "checker") {
    ctx.fillStyle = "rgba(210,209,198,.35)";
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 4; y++) if ((x + y) % 2) ctx.fillRect(x * 64, y * 64, 64, 64);
  }
  ctx.strokeStyle = "#161b20";
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 254, 254);
  for (const x of [13, 243])
    for (const y of [13, 243]) {
      ctx.fillStyle = "#9a9e9f";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

/** Browser-only scene. It reads appearance; no game or persistence commands belong here. */
export function createGarageScene(
  canvas: HTMLCanvasElement,
  onInteract: () => void,
  onFailure: () => void,
): GarageScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#15191e");
  scene.fog = new THREE.Fog("#15191e", 12, 25);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  const controls = new OrbitControls(camera, canvas);
  let environment: THREE.WebGLRenderTarget | undefined;
  try {
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minPolarAngle = 0.15;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      environment = pmrem.fromScene(room, 0.04);
    } finally {
      room.dispose();
      pmrem.dispose();
    }
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.7;
    scene.add(new THREE.HemisphereLight("#bdcde5", "#40342b", 2));
    const key = new THREE.DirectionalLight("#ffe1b1", 4.2);
    key.position.set(3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.2,
      far: 18,
    });
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0002;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#8baee8", 2.4);
    rim.position.set(-4, 4, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#dce4ec", 1.2);
    fill.position.set(4, 2, -1);
    scene.add(fill);
    const metal = new THREE.MeshStandardMaterial({
      color: "#444d59",
      metalness: 0.75,
      roughness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#20252b",
      metalness: 0.5,
      roughness: 0.65,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.65 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 6), floorMaterial);
    floor.position.y = -0.065;
    floor.receiveShadow = true;
    scene.add(floor);
    const box = (
      size: [number, number, number],
      pos: [number, number, number],
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#b3cddd",
      roughness: 0.2,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const axis of ["x", "z"] as const) {
      box(
        axis === "x" ? [0.12, 0.42, 6] : [6, 0.42, 0.12],
        axis === "x" ? [-3, 0.2, 0] : [0, 0.2, -3],
        dark,
      );
      box(
        axis === "x" ? [0.1, 0.08, 6] : [6, 0.08, 0.1],
        axis === "x" ? [-3, 1.8, 0] : [0, 1.8, -3],
        metal,
      );
      for (const offset of [-3, -1, 1, 3])
        box([0.09, 1.85, 0.09], axis === "x" ? [-3, 0.9, offset] : [offset, 0.9, -3], metal);
      const pane = box(
        axis === "x" ? [0.02, 1.3, 5.9] : [5.9, 1.3, 0.02],
        axis === "x" ? [-3, 1.1, 0] : [0, 1.1, -3],
        glass,
      );
      pane.castShadow = false;
    }
    const amber = new THREE.MeshStandardMaterial({
      color: "#edaa22",
      metalness: 0.3,
      roughness: 0.6,
    });
    for (let i = 0; i < 22; i++) {
      const stripe = box([0.13, 0.09, 0.025], [-2.85 + i * 0.27, 0.42, -2.92], amber);
      stripe.rotation.z = -0.5;
    }
    const lamp = new THREE.MeshStandardMaterial({
      color: "#ffd292",
      emissive: "#ffac42",
      emissiveIntensity: 2,
    });
    for (const z of [-2.2, -0.2, 1.8]) box([0.04, 0.04, 0.45], [-2.9, 0.5, z], lamp);

    let bot: THREE.Group | undefined;
    let currentFloor: GarageLook | undefined;
    let visible = true,
      playing = false,
      disposed = false,
      raf = 0,
      previous = 0;
    let radius = 1.5;
    const center = new THREE.Vector3(0, 0.8, 0);
    const home = new THREE.Vector3(1, 0.62, 1.25).normalize();
    const render = () => {
      if (disposed || !visible || document.hidden || !canvas.clientWidth || !canvas.clientHeight)
        return;
      try {
        renderer.render(scene, camera);
      } catch {
        onFailure();
      }
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden || !playing) return;
      if (bot) bot.rotation.y += Math.min((now - previous) / 1000 || 0, 0.05) * 0.24;
      previous = now;
      render();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      previous = performance.now();
      render();
      if (!disposed && visible && !document.hidden && playing) raf = requestAnimationFrame(frame);
    };
    const fit = (reset = false) => {
      const distance = garageCameraDistance(radius, camera.fov, camera.aspect);
      const direction = reset
        ? home.clone()
        : camera.position.clone().sub(controls.target).normalize();
      if (!direction.lengthSq()) direction.copy(home);
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.minDistance = distance * 0.7;
      controls.maxDistance = Math.max(distance * 2, 12);
      camera.far = Math.max(80, controls.maxDistance * 2);
      camera.updateProjectionMatrix();
      controls.update();
      render();
    };
    const resize = () => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fit();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const interact = () => {
      playing = false;
      wake();
      onInteract();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    controls.addEventListener("change", render);
    controls.addEventListener("start", interact);
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", wake);

    return {
      update(look, floorLook) {
        // Construct first so a failed update leaves the existing model recoverable.
        const next = createGarageBot(look);
        if (bot) {
          scene.remove(bot);
          disposeObject(bot);
        }
        bot = next;
        scene.add(bot);
        bot.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(bot);
        bounds.getCenter(center);
        // Symmetric radius around the rotation axis, so accessories never clip as the bot turns.
        const extentX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
        const extentZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
        center.x = center.z = 0;
        radius = Math.sqrt(extentX ** 2 + extentZ ** 2 + ((bounds.max.y - bounds.min.y) / 2) ** 2);
        if (currentFloor !== floorLook) {
          floorMaterial.map?.dispose();
          floorMaterial.map = floorTexture(floorLook);
          floorMaterial.needsUpdate = true;
          currentFloor = floorLook;
        }
        resize();
        fit(true);
        wake();
      },
      setPlaying(value) {
        playing = value;
        wake();
      },
      setVisible(value) {
        visible = value;
        wake();
      },
      reset() {
        if (bot) bot.rotation.y = 0;
        fit(true);
      },
      zoom(factor) {
        const offset = camera.position.clone().sub(controls.target);
        offset.setLength(
          THREE.MathUtils.clamp(
            offset.length() * factor,
            controls.minDistance,
            controls.maxDistance,
          ),
        );
        camera.position.copy(controls.target).add(offset);
        controls.update();
        render();
      },
      dispose() {
        disposed = true;
        if (raf) cancelAnimationFrame(raf);
        observer.disconnect();
        document.removeEventListener("visibilitychange", wake);
        canvas.removeEventListener("webglcontextlost", lost);
        controls.dispose();
        disposeObject(scene);
        environment?.dispose();
        key.shadow.map?.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    controls.dispose();
    disposeObject(scene);
    environment?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}
