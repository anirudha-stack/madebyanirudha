// Parts with no permissively licensed CAD model, built from their datasheet
// dimensions: sculpted keycaps per profile, the EC11 rotary encoder and its
// knurled knob, and the common 0.91" 128×32 SSD1306 OLED module.
// Everything is in centimetres, y up, +z toward the typist.

import { useMemo } from "react";
import * as THREE from "three";
import type { KeycapProfile } from "../../shared/catalog";

const MM = 0.1;

/* --------------------------------------------------------------- Keycaps */

/** Points around a rounded rectangle, counter-clockwise seen from above. */
function ring(w: number, d: number, r: number, cz: number, seg: number) {
  const rr = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const pts: [number, number][] = [];
  // Each corner's centre and the angle its quarter-arc starts from.
  const corners: [number, number, number][] = [
    [w / 2 - rr, d / 2 - rr, 0],
    [-w / 2 + rr, d / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -d / 2 + rr, Math.PI],
    [w / 2 - rr, -d / 2 + rr, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cz + cy + Math.sin(a) * rr]);
    }
  return pts;
}

const capCache = new Map<string, THREE.BufferGeometry>();

/**
 * A keycap lofted from its rounded base to its tilted, dished top.
 * `row` indexes the profile's rows (R1 = 0 … R4 = 3); uniform profiles have one.
 */
export function capGeometry(p: KeycapProfile, row: number, wU: number, dU: number) {
  const key = `${p.id}:${row}:${wU}:${dU}`;
  const hit = capCache.get(key);
  if (hit) return hit;

  const r = p.rows[Math.min(row, p.rows.length - 1)];
  const W = wU * 19.05 - 1.05;
  const D = dU * 19.05 - 1.05;
  const tw = Math.max(4, W - p.taper.x * 2);
  const td = Math.max(4, D - p.taper.front - p.taper.back);
  // The top sits back from centre by half the front/back taper difference (−z = away).
  const tz = -(p.taper.front - p.taper.back) / 2;
  const slope = Math.tan((r.tilt * Math.PI) / 180);
  const SEG = 5;
  const RINGS = 5;

  const topY = (x: number, z: number) => {
    const u = x / (tw / 2);
    const v = (z - tz) / (td / 2);
    const dish =
      p.dish === "cyl"
        ? p.dishDepth * Math.max(0, 1 - u * u)
        : p.dish === "sph"
          ? p.dishDepth * Math.max(0, 1 - (u * u + v * v) / 2)
          : 0;
    return r.h - slope * (z - tz) - dish;
  };

  // Side walls and top face are separate surfaces so the top edge stays
  // crisp instead of being smoothed into a ridge.
  const base = ring(W, D, 1.0, 0, SEG);
  const n = base.length;
  const tops: [number, number][][] = [];
  for (let k = 0; k < RINGS; k++) {
    const s = 1 - k / RINGS;
    tops.push(ring(tw * s, td * s, p.topR * s, tz, SEG));
  }

  const verts: number[] = [];
  const idx: number[] = [];
  const quadStrip = (a0: number, b0: number) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(a0 + i, b0 + i, a0 + j, a0 + j, b0 + i, b0 + j);
    }
  };

  // Walls: base ring up to the top's outer edge, with a mid ring for a soft belly.
  for (const [x, z] of base) verts.push(x, 0, z);
  for (let i = 0; i < n; i++) {
    const [bx, bz] = base[i];
    const [tx, tzz] = tops[0][i];
    verts.push(bx * 0.55 + tx * 0.45, topY(tx, tzz) * 0.5, bz * 0.55 + tzz * 0.45);
  }
  for (const [x, z] of tops[0]) verts.push(x, topY(x, z), z);
  quadStrip(0, n);
  quadStrip(n, 2 * n);

  // Top: its own copy of the outer edge, then rings into the dish.
  const t0 = verts.length / 3;
  for (const r of tops) for (const [x, z] of r) verts.push(x, topY(x, z), z);
  for (let k = 0; k < RINGS - 1; k++) quadStrip(t0 + k * n, t0 + (k + 1) * n);
  const center = verts.length / 3;
  verts.push(0, topY(0, tz), tz);
  const last = t0 + (RINGS - 1) * n;
  for (let i = 0; i < n; i++) idx.push(last + i, center, last + ((i + 1) % n));

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts.map((v) => v * MM), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the top centre must face up; flip every triangle if not.
  if (g.getAttribute("normal").getY(center) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  capCache.set(key, g);
  return g;
}

/* --------------------------------------------------------------- Encoder */

/** Knurled aluminium knob: a toothed body with a smooth chamfered top and a pointer groove. */
export function Knob({ y }: { y: number }) {
  const body = useMemo(() => {
    const teeth = 72;
    const s = new THREE.Shape();
    for (let i = 0; i <= teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rad = (i % 2 ? 7.15 : 7.5) * MM;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (i === 0) s.moveTo(x, z);
      else s.lineTo(x, z);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 11 * MM, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={body} castShadow>
        <meshStandardMaterial color="#c9ccd2" metalness={0.55} roughness={0.38} />
      </mesh>
      <mesh position={[0, 11.6 * MM, 0]}>
        <cylinderGeometry args={[6.6 * MM, 7.15 * MM, 1.2 * MM, 64]} />
        <meshStandardMaterial color="#e4e6ea" metalness={0.5} roughness={0.22} />
      </mesh>
      <mesh position={[0, 12.25 * MM, -3.6 * MM]}>
        <boxGeometry args={[0.8 * MM, 0.2 * MM, 4.5 * MM]} />
        <meshStandardMaterial color="#3a3b40" />
      </mesh>
    </group>
  );
}

/** EC11 encoder body on the PCB: steel can, black base, threaded bushing, D-shaft. */
export function Ec11({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 1.2 * MM, 0]} castShadow>
        <boxGeometry args={[12 * MM, 2.4 * MM, 13.2 * MM]} />
        <meshStandardMaterial color="#1c1c1f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 4.5 * MM, 0]} castShadow>
        <boxGeometry args={[12.4 * MM, 4.2 * MM, 12.4 * MM]} />
        <meshStandardMaterial color="#b9bcc2" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Side tabs folded down to the PCB */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 6.3 * MM, 2.6 * MM, 0]}>
          <boxGeometry args={[0.4 * MM, 4.4 * MM, 3 * MM]} />
          <meshStandardMaterial color="#b9bcc2" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 10.1 * MM, 0]}>
        <cylinderGeometry args={[3.5 * MM, 3.5 * MM, 7 * MM, 40]} />
        <meshStandardMaterial color="#cfd2d7" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Thread crests */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0, (7.4 + i * 1.0) * MM, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.5 * MM, 0.18 * MM, 6, 40]} />
          <meshStandardMaterial color="#dfe2e6" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 16.6 * MM, 0]}>
        <cylinderGeometry args={[3 * MM, 3 * MM, 6 * MM, 32]} />
        <meshStandardMaterial color="#d6d9de" metalness={0.75} roughness={0.25} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ OLED */

let screenTex: THREE.CanvasTexture | null = null;

/** The panel's lit pixels: a 128×32 bitmap with the default layer readout. */
function screenTexture() {
  if (screenTex) return screenTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#020306";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#bfe8ff";
    ctx.font = "bold 26px monospace";
    ctx.textBaseline = "middle";
    ctx.fillText("LAYER 0", 14, 24);
    ctx.font = "16px monospace";
    ctx.fillText("CAPS · NUM", 14, 50);
  }
  screenTex = new THREE.CanvasTexture(c);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.magFilter = THREE.NearestFilter;
  return screenTex;
}

/** 0.91" SSD1306 module: 38 × 12 mm blue PCB, glass panel, flex tail, 4-pin header. */
export function Oled({ y, along }: { y: number; along: "x" | "z" }) {
  const tex = useMemo(() => screenTexture(), []);
  return (
    <group position={[0, y, 0]} rotation={[0, along === "x" ? 0 : Math.PI / 2, 0]}>
      <mesh position={[0, 0.6 * MM, 0]} castShadow>
        <boxGeometry args={[38 * MM, 1.2 * MM, 12 * MM]} />
        <meshStandardMaterial color="#1f4f8f" roughness={0.5} />
      </mesh>
      <mesh position={[1.5 * MM, 1.9 * MM, 0]}>
        <boxGeometry args={[30 * MM, 1.4 * MM, 11.5 * MM]} />
        <meshPhysicalMaterial color="#0a0c10" roughness={0.08} clearcoat={1} />
      </mesh>
      <mesh position={[1.5 * MM, 2.61 * MM, -0.6 * MM]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22.4 * MM, 5.6 * MM]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Flex tail folding round the glass edge */}
      <mesh position={[17 * MM, 1.6 * MM, 0]}>
        <boxGeometry args={[1 * MM, 2 * MM, 8 * MM]} />
        <meshStandardMaterial color="#b8752a" roughness={0.6} />
      </mesh>
      {/* 4-pin header */}
      <mesh position={[-17 * MM, -1.25 * MM, 0]}>
        <boxGeometry args={[2.5 * MM, 2.5 * MM, 10.2 * MM]} />
        <meshStandardMaterial color="#141416" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-17 * MM, -3 * MM, (i - 1.5) * 2.54 * MM]}>
          <boxGeometry args={[0.64 * MM, 7 * MM, 0.64 * MM]} />
          <meshStandardMaterial color="#d9b765" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
