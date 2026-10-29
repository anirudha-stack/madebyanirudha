// Converts the switch, hotswap-socket and stabilizer 3D models from the
// KiSwitch library (MIT / CC-BY-SA 4.0, github.com/kiswitch/kiswitch) into
// small mesh files the store's 3D view loads.
//
//   node tools/build-models.mjs
//
// Each VRML model is flattened, its meshes merged by material, simplified
// with meshoptimizer (an 84-key board instances these, so every triangle
// counts), and written to public/models/<name>.json:
//   { parts: [{ color, metalness, roughness, position (b64 f32), index (b64 u32) }] }
// Units are centimetres, Y up, board top surface at y = 0, +Z toward the
// typist: the scene's own frame. KiCad VRML is 0.1-inch units, Z up.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, ".cache");
const OUT = join(here, "..", "public", "models");
const SRC = "https://raw.githubusercontent.com/kiswitch/kiswitch/main/library/3dmodels/3d-library.3dshapes";

// name → [source file, triangle budget per material group]
const MODELS = {
  "switch-mx": ["SW_Cherry_MX_PCB", 1600],
  "switch-choc": ["SW_Kailh_Choc_V1", 1000],
  "hotswap-mx": ["SW_Hotswap_Kailh_MX", 500],
  "hotswap-choc": ["SW_Hotswap_Kailh_Choc_V1", 400],
  "stab-2u": ["Stabilizer_Cherry_MX_2.00u", 900],
  "stab-6u": ["Stabilizer_Cherry_MX_6.25u", 900],
};

const KICAD_TO_CM = 0.254;

async function source(file) {
  const p = join(CACHE, `${file}.wrl`);
  try {
    return readFileSync(p, "utf8");
  } catch {
    const res = await fetch(`${SRC}/${file}.wrl`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    const text = await res.text();
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(p, text);
    return text;
  }
}

const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");

function simplify(geo, budget) {
  const g = mergeVertices(geo.deleteAttribute("normal") && geo, 1e-4);
  const pos = g.getAttribute("position").array;
  const idx = new Uint32Array(g.getIndex().array);
  const target = Math.min(idx.length, budget * 3);
  if (target >= idx.length) return { pos, idx };
  const [out] = MeshoptSimplifier.simplify(idx, pos, 3, target - (target % 3), 0.01, ["LockBorder"]);
  return { pos, idx: out };
}

await MeshoptSimplifier.ready;
mkdirSync(OUT, { recursive: true });

for (const [name, [file, budget]] of Object.entries(MODELS)) {
  const scene = new VRMLLoader().parse(await source(file), "");
  scene.updateMatrixWorld(true);

  // KiCad (x, y, z) in 0.1" → scene (x, z, -y) in cm.
  const toScene = new THREE.Matrix4()
    .makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0))
    .multiply(new THREE.Matrix4().makeScale(KICAD_TO_CM, KICAD_TO_CM, KICAD_TO_CM));

  const groups = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const color = `#${m.color.getHexString()}`;
    const g = o.geometry.clone().toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toScene, o.matrixWorld));
    const key = color;
    if (!groups.has(key)) groups.set(key, { color, shininess: m.shininess ?? 0.3, geos: [] });
    groups.get(key).geos.push(g);
  });

  const parts = [];
  let tris = 0;
  for (const { color, shininess, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    const { pos, idx } = simplify(merged, budget);
    tris += idx.length / 3;
    const metallic = /^#(c[0-9a-f]|d[0-9a-f]|b[0-9a-f])/.test(color) && shininess > 0.5;
    parts.push({
      color,
      metalness: metallic ? 0.75 : 0,
      roughness: metallic ? 0.3 : Math.max(0.25, 0.8 - shininess * 0.6),
      position: b64(new Float32Array(pos)),
      index: b64(new Uint32Array(idx)),
    });
  }

  const box = new THREE.Box3();
  for (const g of groups.values()) for (const geo of g.geos) box.union(new THREE.Box3().setFromBufferAttribute(geo.getAttribute("position")));
  const json = JSON.stringify({ source: `kiswitch ${file}`, parts });
  writeFileSync(join(OUT, `${name}.json`), json);
  console.log(
    `${name}: ${parts.length} parts, ${tris} tris, ${(json.length / 1024).toFixed(0)} KB, bounds cm`,
    box.min.toArray().map((v) => v.toFixed(2)).join(","),
    "→",
    box.max.toArray().map((v) => v.toFixed(2)).join(","),
  );
}
