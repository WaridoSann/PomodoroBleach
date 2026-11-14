import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { unzipSync, strFromU8 } from "fflate";
import type { SavedModel } from "./model-store";

function metal(color: string, roughness = 0.3, metalness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function extrude(points: number[][], depth: number, material: THREE.Material) {
  const shape = new THREE.Shape(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.01,
    }),
    material,
  );
  mesh.position.z = -depth / 2;
  return mesh;
}
/** An original mesh built from solid geometry, independent of licensed imported assets. */
function createOriginalSword() {
  const sword = new THREE.Group();
  const steel = metal("#292e30", 0.27);
  const edge = metal("#c5c9c7", 0.2);
  const obsidian = metal("#0d1011", 0.35);
  const cord = metal("#232728", 0.92, 0.05);
  sword.add(
    extrude(
      [
        [-0.13, 0.25],
        [-0.16, 3.35],
        [-0.05, 3.96],
        [0.24, 3.48],
        [0.27, 0.25],
      ],
      0.09,
      steel,
    ),
  );
  const cuttingEdge = extrude(
    [
      [0.225, 0.25],
      [0.205, 3.43],
      [-0.05, 3.96],
      [0.24, 3.48],
      [0.27, 0.25],
    ],
    0.096,
    edge,
  );
  sword.add(cuttingEdge);
  const fuller = extrude(
    [
      [-0.1, 0.35],
      [-0.115, 3.3],
      [-0.06, 3.53],
      [-0.04, 0.35],
    ],
    0.102,
    obsidian,
  );
  sword.add(fuller);
  sword.add(
    extrude(
      [
        [-0.55, 0.24],
        [-0.55, 0.06],
        [-0.35, -0.04],
        [-0.16, 0.05],
        [0.28, 0.05],
        [0.46, 0.2],
        [0.46, 0.42],
        [0.28, 0.3],
      ],
      0.17,
      obsidian,
    ),
  );
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.18), edge);
  collar.position.y = 0.3;
  sword.add(collar);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.105, 1.45, 8),
    obsidian,
  );
  grip.position.y = -0.68;
  sword.add(grip);
  for (let i = 0; i < 11; i++) {
    const wrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.024, 4, 8),
      cord,
    );
    wrap.rotation.x = Math.PI / 2;
    wrap.rotation.z = i % 2 ? 0.3 : -0.3;
    wrap.position.y = -0.08 - i * 0.12;
    sword.add(wrap);
  }
  const pommel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.13, 0.14, 8),
    steel,
  );
  pommel.position.y = -1.46;
  sword.add(pommel);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.025, 8, 16),
    steel,
  );
  ring.position.y = -1.64;
  sword.add(ring);
  // A short weighted chain adds a recognizable, physical silhouette.
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.017, 6, 12),
      steel,
    );
    link.scale.y = 1.35;
    link.position.set(-0.025 * i * i, -1.83 - i * 0.15, 0);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    sword.add(link);
  }
  return sword;
}
function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  const images = new Set(Array.from(textures, (texture) => texture.image));
  images.forEach((image) => {
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
      image.close();
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

async function limitTextures(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  const images = new Map<unknown, ImageBitmap>();
  const limit = matchMedia("(max-width: 600px)").matches ? 1024 : 2048;
  for (const texture of textures) {
    const image = texture.image as ImageBitmap | HTMLImageElement | undefined;
    if (
      !image ||
      Math.max(image.width, image.height) <= limit ||
      typeof createImageBitmap === "undefined"
    )
      continue;
    if (!images.has(image)) {
      const scale = limit / Math.max(image.width, image.height);
      try {
        images.set(
          image,
          await createImageBitmap(image, {
            resizeWidth: Math.round(image.width * scale),
            resizeHeight: Math.round(image.height * scale),
            resizeQuality: "high",
          }),
        );
      } catch {
        continue;
      }
    }
    texture.image = images.get(image)!;
    texture.needsUpdate = true;
  }
  for (const image of images.keys())
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
      image.close();
}
async function parseModel(model: SavedModel): Promise<THREE.Group> {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith("blob:") && !url.startsWith("data:"))
      throw new Error("Les ressources doivent être intégrées au modèle.");
    return url;
  });
  const loader = new GLTFLoader(manager);
  if (/\.glb$/i.test(model.name)) {
    const gltf = await loader.parseAsync(model.bytes, "");
    return gltf.scene;
  }
  if (!/\.zip$/i.test(model.name))
    throw new Error("Choisissez un fichier ZIP glTF ou GLB.");
  // Only expected asset extensions are expanded; reject oversized archives before allocation.
  let expanded = 0;
  const files = unzipSync(new Uint8Array(model.bytes), {
    filter: (file) => {
      if (!/\.(gltf|bin|png|jpe?g|webp|ktx2)$/i.test(file.name)) return false;
      expanded += file.originalSize;
      if (expanded > 160 * 1024 * 1024)
        throw new Error("Le modèle décompressé dépasse 160 Mo.");
      return true;
    },
  });
  const path = Object.keys(files).find((path) => /\.gltf$/i.test(path));
  if (!path) throw new Error("Cette archive ne contient pas de fichier glTF.");
  const document = JSON.parse(strFromU8(files[path]));
  // Embedded models cannot request arbitrary remote files or trackers.
  const root = path.slice(0, path.lastIndexOf("/") + 1);
  const urls: string[] = [];
  const resolve = (uri: string): string => {
    if (uri.startsWith("data:")) return uri;
    if (/^(https?:|\/\/|blob:)/i.test(uri))
      throw new Error(
        "Les ressources du modèle doivent être incluses dans le ZIP.",
      );
    const parts: string[] = [];
    for (const p of (root + decodeURIComponent(uri)).split("/")) {
      if (p === "..") parts.pop();
      else if (p !== "." && p !== "") parts.push(p);
    }
    const key = parts.join("/");
    if (!files[key])
      throw new Error(`Une texture ou un fichier est absent : ${uri}`);
    const extension = key.split(".").pop()?.toLowerCase();
    const type =
      extension === "png"
        ? "image/png"
        : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "webp"
            ? "image/webp"
            : "application/octet-stream";
    const url = URL.createObjectURL(
      new Blob([files[key].slice().buffer], { type }),
    );
    urls.push(url);
    return url;
  };
  try {
    for (const buffer of document.buffers ?? [])
      if (buffer.uri) buffer.uri = resolve(buffer.uri);
    for (const image of document.images ?? [])
      if (image.uri) image.uri = resolve(image.uri);
    const gltf = await loader.parseAsync(JSON.stringify(document), "");
    return gltf.scene;
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}

export async function validateModel(model: SavedModel): Promise<void> {
  const object = await parseModel(model);
  try {
    const size = new THREE.Box3()
      .setFromObject(object)
      .getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() === 0)
      throw new Error("Ce fichier ne contient pas de géométrie 3D visible.");
  } finally {
    disposeObject(object);
  }
}

export class SwordScene {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(33, 1, 0.1, 80);
  private controls: OrbitControls;
  private pivot = new THREE.Group();
  private blade: THREE.Group | null = null;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private revision = 0;
  private motion = true;
  private running = false;
  private visible = true;
  private level = 0;
  private lastFrame = 0;
  private env: THREE.WebGLRenderTarget;
  private rim = new THREE.DirectionalLight("#e7f1f0", 3);
  private time = new THREE.Clock();
  private intersection: IntersectionObserver;
  constructor(private element: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Sabre en 3D. Faites glisser pour le faire pivoter.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    element.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 1.2;
    this.camera.position.set(0, 0, 13);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = Math.PI * 0.25;
    this.controls.maxPolarAngle = Math.PI * 0.75;
    const key = new THREE.DirectionalLight("#fff5e8", 4);
    key.position.set(2, 3, 5);
    this.scene.add(key);
    this.rim.position.set(-3, 1, -2);
    this.scene.add(this.rim);
    const front = new THREE.DirectionalLight("#dfe9e9", 2);
    front.position.set(-3, 0, 4);
    this.scene.add(front);
    this.scene.add(new THREE.AmbientLight("#e0e5e3", 0.4));
    this.scene.add(this.pivot);
    this.setBlade(createOriginalSword(), false);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(element);
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    });
    this.intersection.observe(element);
    this.resize();
    this.animate();
  }
  private setBlade(blade: THREE.Group, imported: boolean) {
    if (this.blade) {
      this.pivot.remove(this.blade);
      disposeObject(this.blade);
    }
    const box = new THREE.Box3().setFromObject(blade);
    const size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() === 0)
      throw new Error("Le modèle ne contient aucune géométrie visible.");
    const normalized = new THREE.Group();
    const center = box.getCenter(new THREE.Vector3());
    blade.position.sub(center);
    normalized.add(blade);
    normalized.scale.setScalar(6.6 / Math.max(size.x, size.y, size.z));
    // The supplied Sketchfab Tensa points down; present its tip upwards.
    if (imported) normalized.rotation.z = Math.PI;
    normalized.rotation.y = -0.22;
    this.blade = normalized;
    this.pivot.add(normalized);
    this.pivot.rotation.z = -0.49;
  }
  async load(model: SavedModel | null) {
    const revision = ++this.revision;
    const blade = model ? await parseModel(model) : createOriginalSword();
    if (model) await limitTextures(blade);
    if (this.disposed || revision !== this.revision) {
      disposeObject(blade);
      return;
    }
    this.setBlade(blade, model !== null);
    this.resetView();
  }
  update(motion: boolean, running: boolean, level: number) {
    this.motion = motion;
    this.running = running;
    this.level = level;
    this.controls.enableDamping = motion;
  }
  resetView() {
    this.camera.position.set(0, 0, 13);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  private resize() {
    const { width, height } = this.element.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // Keep the entire sword in frame even on narrow mobile screens.
    this.camera.fov = width / height < 0.8 ? 40 : 33;
    this.camera.updateProjectionMatrix();
  }
  private animate = (timestamp = 0) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (!this.visible || document.hidden) return;
    if (timestamp - this.lastFrame < 1000 / 30) return;
    this.lastFrame = timestamp;
    const t = this.time.getElapsedTime();
    if (this.motion) {
      this.pivot.position.y = Math.sin(t * 0.6) * 0.055;
      this.pivot.rotation.y =
        Math.sin(t * 0.22) * (this.running ? 0.045 : 0.09);
    } else {
      this.pivot.position.y = 0;
      this.pivot.rotation.y = 0;
    }
    this.rim.intensity = 3 + this.level * 0.8;
    this.scene.environmentIntensity = 1.15 + this.level * 0.15;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.disposed = true;
    this.revision++;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.intersection.disconnect();
    this.controls.dispose();
    disposeObject(this.scene);
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
