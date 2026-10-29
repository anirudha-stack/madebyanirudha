// The 3D view of a build, in layers: the PCB (always), component bodies
// (switches, sockets, stabilizers, diodes, controller, encoder, screen), the
// case with its plate, and the keycaps. Geometry comes straight from the
// resolved build (1u = 19.05 mm, drawn here in centimetres), so what turns on
// screen is what gets made.
//
// Switches, hotswap sockets and stabilizers are real CAD models (KiSwitch,
// MIT); keycaps are lofted per profile and row; the encoder, knob and OLED are
// modelled from their datasheets (see parts3d.tsx).

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { HOLE, type Resolved, resolve, U_MM, wiring } from "../../shared/board";
import { capProfileById, colorwayById, finishById, maskById } from "../../shared/catalog";
import { capsOf } from "../../shared/templates";
import type { BuildSpec, Item, Rect } from "../../shared/types";
import { capColor, MCU_COLOR } from "../ui/Board";
import { Instanced, type Placement } from "./models";
import { capGeometry, Ec11, Knob, Oled } from "./parts3d";

const U = U_MM / 10; // cm per u

// Stack heights, cm from the case floor.
const FLOOR = 0.3;
const PCB_Y = 0.5;
const PCB_T = 0.16;
const PCB_TOP = PCB_Y + PCB_T;
/** Plate top above the PCB, and where a cap's skirt rests, per switch family. */
const STACK = {
  mx: { plate: 0.5, capBase: 0.86 },
  choc: { plate: 0.22, capBase: 0.48 },
} as const;

export interface Layers {
  case: boolean;
  caps: boolean;
  bodies: boolean;
}

type Frame = { cx: number; cz: number };
/** Board-unit rect → centred cm rect. */
const toCm = (r: Rect, f: Frame) => ({
  x: (r.x + r.w / 2) * U - f.cx,
  z: (r.y + r.h / 2) * U - f.cz,
  w: r.w * U,
  d: r.h * U,
});

function roundedRect(w: number, d: number, r: number, hole?: { w: number; d: number; r: number }) {
  const make = (W: number, D: number, R: number) => {
    const s = new THREE.Shape();
    const rr = Math.min(R, W / 2, D / 2);
    const x = -W / 2;
    const y = -D / 2;
    s.moveTo(x + rr, y);
    s.lineTo(x + W - rr, y);
    s.quadraticCurveTo(x + W, y, x + W, y + rr);
    s.lineTo(x + W, y + D - rr);
    s.quadraticCurveTo(x + W, y + D, x + W - rr, y + D);
    s.lineTo(x + rr, y + D);
    s.quadraticCurveTo(x, y + D, x, y + D - rr);
    s.lineTo(x, y + rr);
    s.quadraticCurveTo(x, y, x + rr, y);
    return s;
  };
  const shape = make(w, d, r);
  if (hole) {
    const h = make(hole.w, hole.d, hole.r);
    shape.holes.push(new THREE.Path(h.getPoints().reverse()));
  }
  return shape;
}

/** A flat rounded slab (or ring, with a hole) lying on the floor plane. */
function Slab({
  w,
  d,
  r,
  h,
  y,
  x = 0,
  z = 0,
  hole,
  children,
}: {
  w: number;
  d: number;
  r: number;
  h: number;
  y: number;
  x?: number;
  z?: number;
  hole?: { w: number; d: number; r: number };
  children: React.ReactNode;
}) {
  const geo = useMemo(
    () => new THREE.ExtrudeGeometry(roundedRect(w, d, r, hole), { depth: h, bevelEnabled: false, curveSegments: 10 }),
    [w, d, r, h, hole],
  );
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} castShadow receiveShadow>
      {children}
    </mesh>
  );
}

/** Simple boxes, one draw call: diodes, footprint outlines. */
function Boxes({ at, size, color }: { at: Placement[]; size: [number, number, number]; color: string }) {
  const geo = useMemo(() => new THREE.BoxGeometry(...size), [size]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), [color]);
  if (at.length === 0) return null;
  return (
    <instancedMesh
      key={at.length}
      args={[geo, mat, at.length]}
      ref={(m) => {
        if (!m) return;
        const mx = new THREE.Matrix4();
        at.forEach((p, i) => m.setMatrixAt(i, mx.makeTranslation(p.x, p.y, p.z)));
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
      }}
    />
  );
}

function Controller({ res, f }: { res: Resolved; f: Frame }) {
  const c = toCm(res.mcuRect, f);
  const along = res.place.rot === 0 || res.place.rot === 180;
  const dir = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] }[res.place.rot] as [number, number];
  const usbLen = 0.74;
  const usbW = 0.9;
  const ux = c.x + dir[0] * (c.w / 2 - usbLen / 2 + 0.14);
  const uz = c.z + dir[1] * (c.d / 2 - usbLen / 2 + 0.14);
  const board = MCU_COLOR[res.mcu.id] === "#1c1c20" ? "#34363e" : (MCU_COLOR[res.mcu.id] ?? "#34363e");
  return (
    <group>
      <mesh position={[c.x, PCB_TOP + 0.4, c.z]} castShadow>
        <boxGeometry args={[c.w, 0.16, c.d]} />
        <meshStandardMaterial color={board} roughness={0.45} />
      </mesh>
      {/* Header pins down to the main PCB */}
      <mesh position={[c.x, PCB_TOP + 0.16, c.z]}>
        <boxGeometry args={[c.w * 0.92, 0.32, c.d * 0.92]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.85} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={along ? [c.x + sd * (c.w / 2 - 0.08), PCB_TOP + 0.49, c.z] : [c.x, PCB_TOP + 0.49, c.z + sd * (c.d / 2 - 0.08)]}>
          <boxGeometry args={along ? [0.1, 0.02, c.d * 0.86] : [c.w * 0.86, 0.02, 0.1]} />
          <meshStandardMaterial color="#d9b765" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[c.x, PCB_TOP + 0.53, c.z]}>
        <boxGeometry args={[0.7, 0.1, 0.7]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.3} />
      </mesh>
      <mesh position={[ux, PCB_TOP + 0.6, uz]}>
        <boxGeometry args={along ? [usbW, 0.32, usbLen] : [usbLen, 0.32, usbW]} />
        <meshStandardMaterial color="#d6d9de" metalness={0.75} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Which sculpted row a key sits in, counting up from the bottom row (R4). */
function rowsOf(keys: Item[]) {
  const ys = [...new Set(keys.map((k) => Math.floor(k.y + k.h / 2)))].sort((a, b) => a - b);
  const few = ys.length <= 2;
  return (k: Item) => {
    if (few) return 2; // a pad of one or two rows: all home-row caps
    const fromBottom = ys.length - 1 - ys.indexOf(Math.floor(k.y + k.h / 2));
    return fromBottom <= 1 ? 3 : fromBottom === 2 ? 2 : fromBottom === 3 ? 1 : 0;
  };
}

function Keycaps({ spec, keys, f, base }: { spec: BuildSpec; keys: Item[]; f: Frame; base: number }) {
  const choice = capsOf(spec);
  const prof = capProfileById(choice.profile);
  const palette = colorwayById(choice.colorway);
  const mats = useMemo(() => new Map<string, THREE.MeshStandardMaterial>(), []);
  if (!prof) return null;
  const row = rowsOf(keys);
  const mat = (color: string) => {
    let m = mats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
      mats.set(color, m);
    }
    return m;
  };
  return (
    <>
      {keys.map((k) => {
        const c = toCm(k, f);
        // Tall keys (numpad + and Enter) are wide caps turned on their side.
        const turned = k.h > k.w;
        const g = capGeometry(prof, row(k), turned ? k.h : k.w, turned ? k.w : k.h);
        return (
          <mesh
            key={k.id}
            geometry={g}
            material={mat(capColor(k, palette))}
            position={[c.x, base, c.z]}
            rotation={[0, turned ? Math.PI / 2 : 0, 0]}
            castShadow
          />
        );
      })}
    </>
  );
}

function Board({ spec, layers }: { spec: BuildSpec; layers: Layers }) {
  const res = resolve(spec);
  const o = res.outline;
  const f: Frame = { cx: (o.x + o.w / 2) * U, cz: (o.y + o.h / 2) * U };
  const outline = toCm(o, f);
  const pcb = toCm(res.pcb, f);
  const r = Math.min(o.r, o.w / 2, o.h / 2) * U;
  const pr = Math.max(0.15, r - (res.pcb.x - o.x) * U);
  const family = spec.electronics.switchFamily;
  const stack = STACK[family];
  const plateTop = PCB_TOP + stack.plate;
  const wallTop = plateTop + 0.22;
  const capBase = PCB_TOP + stack.capBase;

  const finish = finishById(spec.case.finish);
  const mask = maskById(spec.pcb.mask);
  const clear = !!finish?.clear;
  const metal = !!finish?.metal;
  const caseColor = finish?.hex ?? "#232326";
  const silk = spec.pcb.silk === "white" ? "#f4f4f0" : "#1b1b1d";
  const items = spec.layout.items;
  const keys = items.filter((i) => i.kind === "key");
  const hole = useMemo(() => ({ w: pcb.w + 0.08, d: pcb.d + 0.08, r: pr }), [pcb.w, pcb.d, pr]);

  const at = useMemo(() => {
    const sw: Placement[] = [];
    const sock: Placement[] = [];
    const stab2: Placement[] = [];
    const stab6: Placement[] = [];
    const diode: Placement[] = [];
    for (const k of keys) {
      const c = toCm(k, f);
      sw.push({ x: c.x, y: PCB_TOP, z: c.z });
      // The socket model assumes a thinner board; seat it under ours.
      sock.push({ x: c.x, y: PCB_TOP - 0.12, z: c.z });
      diode.push({ x: c.x + 0.6, y: PCB_Y - 0.05, z: c.z + 0.62 });
      const long = Math.max(k.w, k.h);
      const ry = k.h > k.w ? Math.PI / 2 : 0;
      if (family === "mx" && long >= 6) stab6.push({ x: c.x, y: PCB_TOP, z: c.z, ry });
      else if (family === "mx" && long >= 2) stab2.push({ x: c.x, y: PCB_TOP, z: c.z, ry });
    }
    return { sw, sock, stab2, stab6, diode };
  }, [keys, f.cx, f.cz, family]);

  const caseMat = (
    <meshPhysicalMaterial
      color={caseColor}
      roughness={clear ? (finish?.id === "acrylic-frosted" ? 0.6 : 0.08) : metal ? 0.38 : 0.78}
      metalness={metal ? 0.45 : 0}
      transmission={clear ? 0.85 : 0}
      thickness={0.3}
      transparent={clear}
      opacity={clear ? 0.5 : 1}
    />
  );

  // USB-C port on the outer wall, in line with the connector.
  const u = res.usb;
  const portAt = {
    0: [u.x * U - f.cx, o.y * U - f.cz],
    90: [(o.x + o.w) * U - f.cx, u.y * U - f.cz],
    180: [u.x * U - f.cx, (o.y + o.h) * U - f.cz],
    270: [o.x * U - f.cx, u.y * U - f.cz],
  }[u.dir] as [number, number];
  const along = u.dir === 0 || u.dir === 180;
  const showSwitches = layers.bodies || (layers.caps && capsOf(spec).profile === "none");

  return (
    <group>
      {/* PCB */}
      <Slab w={pcb.w} d={pcb.d} r={pr} h={PCB_T} y={PCB_Y} x={pcb.x} z={pcb.z}>
        <meshStandardMaterial color={mask?.id === "black" ? "#26272b" : (mask?.hex ?? "#1e6b3a")} roughness={0.55} />
      </Slab>

      {showSwitches && <Instanced name={family === "mx" ? "switch-mx" : "switch-choc"} at={at.sw} />}
      {layers.bodies && (
        <>
          {spec.electronics.hotswap && <Instanced name={family === "mx" ? "hotswap-mx" : "hotswap-choc"} at={at.sock} />}
          <Instanced name="stab-2u" at={at.stab2} />
          <Instanced name="stab-6u" at={at.stab6} />
          {wiring(spec).diodes > 0 && <Boxes at={at.diode} size={[0.27, 0.11, 0.16]} color="#0c0c0e" />}
          <Controller res={res} f={f} />
        </>
      )}
      {!layers.bodies && <Boxes at={at.sw.map((p) => ({ ...p, y: PCB_TOP + 0.002 }))} size={[1.4, 0.004, 1.4]} color={silk} />}

      {/* M3 holes: copper ring on the PCB; brass standoffs below it; screw heads on a sandwich. */}
      {res.holes.map((h) => {
        const x = h.x * U - f.cx;
        const z = h.y * U - f.cz;
        return (
          <group key={`${h.x}-${h.y}`} position={[x, 0, z]}>
            <mesh position={[0, PCB_TOP + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[HOLE.drill / 20, HOLE.pad / 20, 32]} />
              <meshStandardMaterial color="#d7b56d" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, PCB_TOP + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[HOLE.drill / 20, 24]} />
              <meshStandardMaterial color="#0b0b0d" />
            </mesh>
            {layers.bodies && (
              <mesh position={[0, (FLOOR + PCB_Y) / 2, 0]}>
                <cylinderGeometry args={[0.27, 0.27, PCB_Y - FLOOR, 6]} />
                <meshStandardMaterial color="#c9a54a" metalness={0.8} roughness={0.3} />
              </mesh>
            )}
            {layers.case && spec.case.type === "acrylic" && (
              <mesh position={[0, FLOOR + 0.06 + 3 * 0.36 + 0.08, 0]}>
                <cylinderGeometry args={[0.29, 0.29, 0.16, 24]} />
                <meshStandardMaterial color="#d4d7dc" metalness={0.35} roughness={0.35} />
              </mesh>
            )}
          </group>
        );
      })}

      {items
        .filter((i) => i.kind !== "key")
        .map((it) => {
          const c = toCm(it, f);
          if (it.kind === "encoder")
            return (
              <group key={it.id} position={[c.x, 0, c.z]}>
                {layers.bodies && <Ec11 y={PCB_TOP} />}
                {layers.caps && <Knob y={capBase + 0.05} />}
              </group>
            );
          return (
            <group key={it.id} position={[c.x, 0, c.z]}>
              {(layers.bodies || layers.case) && <Oled y={plateTop + 0.05} along={it.w >= it.h ? "x" : "z"} />}
            </group>
          );
        })}

      {layers.case && (
        <>
          {/* Floor, walls, and the plate the switches clip into. */}
          <Slab w={outline.w} d={outline.d} r={r} h={FLOOR} y={0}>
            {caseMat}
          </Slab>
          {spec.case.type === "acrylic" ? (
            [0, 1, 2].map((l) => (
              <Slab key={l} w={outline.w} d={outline.d} r={r} h={0.3} y={FLOOR + 0.06 + l * 0.36} hole={hole}>
                {caseMat}
              </Slab>
            ))
          ) : (
            <Slab w={outline.w} d={outline.d} r={r} h={wallTop - FLOOR} y={FLOOR} hole={hole}>
              {caseMat}
            </Slab>
          )}
          <Slab w={pcb.w + 0.06} d={pcb.d + 0.06} r={pr} h={0.15} y={plateTop - 0.15} x={pcb.x} z={pcb.z}>
            <meshStandardMaterial
              color={clear ? "#d6e2e8" : metal ? caseColor : "#2a2a2e"}
              roughness={0.6}
              metalness={metal ? 0.4 : 0}
              transparent={clear}
              opacity={clear ? 0.45 : 1}
            />
          </Slab>
          {/* The USB-C port cut through the wall */}
          <mesh position={[portAt[0], PCB_TOP + 0.6, portAt[1]]}>
            <boxGeometry args={along ? [1.15, 0.5, 0.7] : [0.7, 0.5, 1.15]} />
            <meshStandardMaterial color="#0b0b0d" emissive="#ff5a1f" emissiveIntensity={0.18} />
          </mesh>
        </>
      )}

      {layers.caps && <Keycaps spec={spec} keys={keys} f={f} base={capBase} />}
    </group>
  );
}

export type CameraAngle = "studio" | "low";

export default function Scene3D({
  spec,
  layers,
  rotate = true,
  angle = "studio",
}: {
  spec: BuildSpec;
  layers: Layers;
  rotate?: boolean;
  /** "low" looks across the rows, where keycap profiles differ most. */
  angle?: CameraAngle;
}) {
  const res = resolve(spec);
  const span = Math.max(res.outline.w, res.outline.h * 1.6) * U + 6;
  const camera = useMemo(
    () => ({
      position: (angle === "low" ? [span * 0.42, span * 0.3, span * 0.72] : [span * 0.5, span * 1.0, span * 1.3]) as [
        number,
        number,
        number,
      ],
      fov: 32,
    }),
    [span, angle],
  );

  return (
    <Canvas key={angle} className="review-canvas" shadows dpr={[1, 2]} camera={camera} gl={{ antialias: true }}>
      <color attach="background" args={["#e9e9e6"]} />
      <fog attach="fog" args={["#e9e9e6", span * 1.8, span * 3.5]} />
      <hemisphereLight args={["#ffffff", "#d6d6d2", 0.9]} />
      <directionalLight
        position={[span * 0.4, span, span * 0.5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
      />
      <directionalLight position={[-span, span * 0.4, -span * 0.3]} intensity={0.5} />
      <Board spec={spec} layers={layers} />
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={span * 2.2} blur={2.6} far={6} />
      <OrbitControls
        autoRotate={rotate}
        autoRotateSpeed={0.6}
        enablePan={false}
        minDistance={span * 0.35}
        maxDistance={span * 2.6}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 1, 0]}
      />
    </Canvas>
  );
}
