import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { BotLookProps } from "../bot-portrait";
import type { GarageLook } from "@/lib/pit/types";
import { createGarageBot } from "./bot-model";
import { garageCameraDistance } from "./framing";
import { createGarageArena, garageFloorTexture } from "./arena-corner";

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
    if (object instanceof THREE.InstancedMesh) object.dispose();
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.5 : 2));
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
    key.shadow.mapSize.set(
      window.innerWidth < 640 ? 1024 : 2048,
      window.innerWidth < 640 ? 1024 : 2048,
    );
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
    const { group: arena, floorMaterial } = createGarageArena(
      Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    );
    scene.add(arena);
    const warm = new THREE.PointLight("#ffba52", 14, 8, 2);
    warm.position.set(-2.6, 2.1, -2);
    scene.add(warm);
    let bot: THREE.Group | undefined;
    let currentFloor: GarageLook | undefined;
    let visible = true,
      playing = false,
      disposed = false,
      raf = 0,
      previous = 0;
    let radius = 1.5;
    const center = new THREE.Vector3(0, 0.8, 0);
    const home = new THREE.Vector3(1, 0.8, 1.12).normalize();
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
          floorMaterial.map = garageFloorTexture(floorLook);
          floorMaterial.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
