// Line-art sprites for the home page turntable: the Undeer micromouse and the
// handwired split keyboard, drawn in the same projection as the watch in
// LayerStack. Plane coordinates are (u right, v towards the viewer); z is up.
// A plane length u or v maps to the screen with the same dimetric factors the
// watch's iso() uses, so a circle on the table becomes the same ellipse, and a
// height maps 1:1. Each sprite's origin is the middle of its footprint on the
// table, so the page can stand it on the platter and scale it for depth.
//
// Everything is emitted as plain path data in painter's order (back to
// front). Faces carry a background fill so what is in front hides what is
// behind; `detail` paths are the quieter lines; `lit` paths are the parts that
// are alive and glow in the accent colour.

export type Pt = [number, number];
export type P3 = [number, number, number];
export type Elem = { d: string; cls: string; style?: string };

const KX = 1.2247;
const KY = 0.9;
const KZ = 0.8;
export const proj = (u: number, v: number, z = 0): Pt => [
  u * KX,
  v * KY - z * KZ,
];
export const n1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const pt = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
export const poly = (pts: Pt[]) => `M ${pts.map(pt).join(" L ")} Z`;
export const open = (pts: Pt[]) => `M ${pts.map(pt).join(" L ")}`;
export const p3 = (q: P3): Pt => proj(q[0], q[1], q[2]);

const area = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

// Outward-facing edges that look towards the viewer (+v).
export const frontEdges = (base: Pt[]) => {
  const s = Math.sign(area(base)) || 1;
  const out: number[] = [];
  for (let i = 0; i < base.length; i++) {
    const [x1] = base[i];
    const [x2] = base[(i + 1) % base.length];
    const ny = s > 0 ? -(x2 - x1) : x2 - x1; // v component of the outward normal
    if (ny > 1e-6) out.push(i);
  }
  return out;
};

/** A solid whose footprint is `base` at height z0 and `top` (same vertex count) at z1. */
export function loft(base: Pt[], z0: number, top: Pt[], z1: number) {
  const sides = frontEdges(base).map((i) => {
    const j = (i + 1) % base.length;
    return poly([
      p3([...base[i], z0]),
      p3([...base[j], z0]),
      p3([...top[j], z1]),
      p3([...top[i], z1]),
    ]);
  });
  return { sides: sides.join(" "), top: poly(top.map((q) => p3([...q, z1]))) };
}
export const prism = (base: Pt[], z0: number, z1: number) =>
  loft(base, z0, base, z1);

export const rot = (q: Pt, a: number, c: Pt = [0, 0]): Pt => {
  const s = Math.sin(a);
  const k = Math.cos(a);
  const x = q[0] - c[0];
  const y = q[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
};
export const rect = (
  cx: number,
  cy: number,
  w: number,
  h: number,
  a = 0,
): Pt[] =>
  (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as Pt[]
  ).map((q) => {
    const r = rot(q, a);
    return [cx + r[0], cy + r[1]] as Pt;
  });

// Push a polygon outwards by d (miter joins). Good enough for the case outline.
export function grow(pts: Pt[], d: number): Pt[] {
  const s = Math.sign(area(pts)) || 1;
  return pts.map((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length];
    const b = pts[(i + 1) % pts.length];
    const n = (p0: Pt, p1: Pt): Pt => {
      const ex = p1[0] - p0[0];
      const ey = p1[1] - p0[1];
      const l = Math.hypot(ex, ey) || 1;
      return s > 0 ? [ey / l, -ex / l] : [-ey / l, ex / l];
    };
    const n1v = n(a, p);
    const n2v = n(p, b);
    const mx = n1v[0] + n2v[0];
    const my = n1v[1] + n2v[1];
    const dot = 1 + n1v[0] * n2v[0] + n1v[1] * n2v[1];
    return [p[0] + (mx / dot) * d, p[1] + (my / dot) * d] as Pt;
  });
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

/**
 * The split Corne from the Sputnik design: two 3 x 6 halves with a staggered
 * column layout and a three-key thumb cluster, each half with a printed bezel
 * and a portrait OLED on its inner edge. Key units; y grows towards the viewer.
 */
export function keyboard(): {
  elems: Elem[];
  oleds: { d: string }[];
  width: number;
} {
  const K = 17;
  const stagger = [0.3, 0.3, 0.12, 0, 0.12, 0.22];
  const innerX = 6.9; // where the left half's case ends
  const gap = 0.9;
  const X0 = innerX * 2 + gap; // mirror axis x2
  const cx0 = X0 / 2;
  const cy0 = 1.9;

  // The left half, in key units.
  const keys: { x: number; y: number; a: number }[] = [];
  for (let c = 0; c < 6; c++)
    for (let r = 0; r < 3; r++) keys.push({ x: c, y: r + stagger[c], a: 0 });
  const deg = Math.PI / 180;
  keys.push({ x: 3.0, y: 3.08, a: 0 });
  keys.push({ x: 4.05, y: 3.2, a: 12 * deg });
  keys.push({ x: 5.12, y: 3.45, a: 25 * deg });

  const caseLeft: Pt[] = [
    [-0.88, -0.58],
    [1.5, -0.58],
    [1.5, -0.76],
    [2.5, -0.76],
    [2.5, -0.88],
    [3.5, -0.88],
    [3.5, -0.76],
    [4.5, -0.76],
    [4.5, -0.66],
    [5.5, -0.66],
    [5.5, -0.62],
    [6.9, -0.62],
    [6.9, 2.35],
    [6.12, 3.95],
    [5.4, 4.42],
    [4.2, 4.3],
    [3.0, 4.02],
    [2.12, 4.02],
    [2.12, 3.02],
    [1.5, 3.02],
    [1.5, 3.18],
    [-0.88, 3.18],
  ];
  const bezelLeft: Pt[] = [
    [5.62, -0.42],
    [6.66, -0.42],
    [6.66, 2.0],
    [5.98, 2.7],
    [5.62, 2.7],
  ];
  const oledLeft = rect(6.14, 0.5, 0.52, 1.36);

  const mx = (q: Pt): Pt => [X0 - q[0], q[1]];
  const mirror = (pts: Pt[]) => pts.map(mx).reverse();
  const toPlane = (q: Pt): Pt => [(q[0] - cx0) * K, (q[1] - cy0) * K];
  const plane = (pts: Pt[]) => pts.map(toPlane);

  const Hcase = 7;
  const Hkey = 8;
  const elems: Elem[] = [];

  // Case and plate, one pair per half.
  const halves = [
    { outline: caseLeft, bezel: bezelLeft, oled: oledLeft, keys, flip: false },
    {
      outline: mirror(caseLeft),
      bezel: mirror(bezelLeft),
      oled: mirror(oledLeft),
      keys: keys.map((k) => ({ x: X0 - k.x, y: k.y, a: -k.a })),
      flip: true,
    },
  ];
  for (const h of halves) {
    const base = plane(h.outline);
    const pr = prism(base, 0, Hcase);
    elems.push({ d: pr.sides, cls: "face" }, { d: pr.top, cls: "face" });
    const plate = plane(grow(h.outline, -0.17));
    elems.push({
      d: poly(plate.map((q) => p3([...q, Hcase]))),
      cls: "face detail",
    });
  }

  // Everything that stands on the plate, back to front.
  type Item = { v: number; build: () => void };
  const items: Item[] = [];
  const oleds: { d: string }[] = [];
  for (const h of halves) {
    for (const k of h.keys) {
      items.push({
        v: k.y,
        build: () => {
          const c = toPlane([k.x, k.y]);
          const b = rect(c[0], c[1], 0.9 * K, 0.9 * K, k.a);
          const t = rect(c[0], c[1], 0.76 * K, 0.76 * K, k.a);
          const l = loft(b, Hcase, t, Hcase + Hkey);
          elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
        },
      });
    }
    items.push({
      v: 1.0,
      build: () => {
        const b = plane(h.bezel);
        const l = prism(b, Hcase, Hcase + 5);
        elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
        const zTop = Hcase + 5;
        const win = plane(h.oled).map((q) => p3([...q, zTop]));
        elems.push({ d: poly(win), cls: "face detail" });
        // What the status screen shows, in key units around the glass centre
        // (portrait): a link mark, the layer name, a battery.
        const [gx, gy] = h.flip ? [X0 - 6.14, 0.5] : [6.14, 0.5];
        const g = (ax: number, ay: number): Pt => toPlane([gx + ax, gy + ay]);
        const mark = (a: Pt[]) => open(a.map((q) => p3([...q, zTop])));
        const glyph = [
          mark([g(-0.12, -0.5), g(-0.12, -0.38)]),
          mark([g(0, -0.5), g(0, -0.3)]),
          mark([g(0.12, -0.5), g(0.12, -0.22)]),
          mark([g(-0.15, -0.08), g(0.15, -0.08)]),
          mark([g(-0.15, 0.02), g(0.07, 0.02)]),
          mark([
            g(-0.1, 0.36),
            g(0.1, 0.36),
            g(0.1, 0.56),
            g(-0.1, 0.56),
            g(-0.1, 0.36),
          ]),
          mark([g(-0.1, 0.48), g(0.1, 0.48)]),
        ].join(" ");
        elems.push({ d: glyph, cls: "lit" });
        oleds.push({ d: glyph });
      },
    });
  }
  items.sort((a, b) => a.v - b.v);
  for (const it of items) it.build();

  return { elems, oleds, width: (X0 + 1.8) * K * KX };
}

/**
 * The box a sprite occupies, from the absolute coordinates in its path data
 * (M, L and C only; arcs and relative dots are within the padding). Used to
 * give each sprite its own tightly sized layer.
 */
export function bounds(elems: Elem[], pad = 10) {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const { d } of elems) {
    for (const seg of d.matchAll(/([MLC])([^MLCZhaHAV]*)/g)) {
      const nums = (seg[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x0 = Math.min(x0, nums[i]);
        x1 = Math.max(x1, nums[i]);
        y0 = Math.min(y0, nums[i + 1]);
        y1 = Math.max(y1, nums[i + 1]);
      }
    }
  }
  return {
    x: x0 - pad,
    y: y0 - pad,
    w: x1 - x0 + 2 * pad,
    h: y1 - y0 + 2 * pad,
  };
}
