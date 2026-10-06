// Undeer, the micromouse, as built (see the three-quarter photograph in
// assets/flagship): a round yellow PCB with a fan of IR sensor boards at the
// front, two fat foam wheels, a red printed cage with the USB-C board and a
// 0.96" OLED stacked on it, and a tape-wrapped LiPo standing at the tail with
// its JST lead looped over the top. Robot coordinates: `a` forward, `b` to the
// robot's right, in millimetres. The robot faces front-left, towards the
// viewer, like the photograph. Same projection and conventions as sprites.ts.

import {
  type Elem,
  frontEdges,
  n1,
  open,
  type P3,
  type Pt,
  p3,
  poly,
  prism,
  rot,
} from "./sprites.ts";

const hull = (pts: Pt[]): Pt[] => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  for (const q of p) {
    while (
      lo.length >= 2 &&
      cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0
    )
      lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (
      up.length >= 2 &&
      cross(up[up.length - 2], up[up.length - 1], q) <= 0
    )
      up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};

const F: Pt = [-0.8, 0.6]; // heading, in plane (u, v)
const Rt: Pt = [-0.6, -0.8]; // the robot's right-hand side
const P = (a: number, b: number): Pt => [
  a * F[0] + b * Rt[0],
  a * F[1] + b * Rt[1],
];
const at = (a: number, b: number, z: number): Pt => p3([...P(a, b), z]);
const dot = (c: Pt) => `M ${n1(c[0])} ${n1(c[1])} h 0.01`;
const rad = Math.PI / 180;

export function mouse(): { elems: Elem[]; scale: number } {
  const elems: Elem[] = [];
  type Item = { v: number; build: () => void };
  const items: Item[] = [];
  const depth = (a: number, b: number) => P(a, b)[1];
  const foot = (pts: Pt[]) => pts.map((q) => P(q[0], q[1]));
  const box = (
    a0: number,
    a1: number,
    b0: number,
    b1: number,
    z0: number,
    z1: number,
  ) => {
    const l = prism(
      foot([
        [a0, b0],
        [a1, b0],
        [a1, b1],
        [a0, b1],
      ]),
      z0,
      z1,
    );
    elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
  };

  // Base PCB: a front half-disc, tapering to a tail under the battery.
  const baseR = 38;
  const baseC = 2;
  const arc: Pt[] = [];
  for (let phi = -105; phi <= 105; phi += 15)
    arc.push([
      baseC + baseR * Math.cos(phi * rad),
      baseR * Math.sin(phi * rad),
    ]);
  const baseShape: Pt[] = [
    ...arc,
    [-22, 30],
    [-44, 18],
    [-52, 8],
    [-52, -8],
    [-44, -18],
    [-22, -30],
  ];
  items.push({
    v: -1000,
    build: () => {
      const l = prism(foot(baseShape), 6, 8);
      elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
      const inner = foot(baseShape).map((q): Pt => [q[0] * 0.9, q[1] * 0.9]);
      elems.push({
        d: poly(inner.map((q) => p3([...q, 8] as P3))),
        cls: "face detail",
      });
    },
  });
  items.push({
    v: -990,
    build: () => {
      // Caster ball under the nose.
      const c = at(42, 0, 3);
      const r = 3.4;
      elems.push({
        d: `M ${n1(c[0] - r)} ${n1(c[1])} a ${r} ${r} 0 1 0 ${n1(2 * r)} 0 a ${r} ${r} 0 1 0 ${n1(-2 * r)} 0 Z`,
        cls: "face",
      });
    },
  });

  // IR sensor boards around the nose; each emitter pulses in turn.
  [-75, -38, 0, 38, 75].forEach((phi, i) => {
    const ca = Math.cos(phi * rad);
    const sa = Math.sin(phi * rad);
    const ra = baseC + 35 * ca;
    const rb = 35 * sa;
    items.push({
      v: depth(ra, rb),
      build: () => {
        const t = rad * (phi + 90);
        const long = 14;
        const thick = 2.8;
        const pts = (
          [
            [-long / 2, -thick / 2],
            [long / 2, -thick / 2],
            [long / 2, thick / 2],
            [-long / 2, thick / 2],
          ] as Pt[]
        ).map((q) => {
          const r = rot(q, t);
          return [ra + r[0], rb + r[1]] as Pt;
        });
        const l = prism(foot(pts), 8, 22);
        elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
        const ox = ra + ca * (thick / 2 + 0.2);
        const oy = rb + sa * (thick / 2 + 0.2);
        elems.push({
          d: dot(at(ox, oy, 17)),
          cls: "lit-dot",
          style: `animation-delay:${i * 160}ms`,
        });
        elems.push({
          d: `M ${at(ox + ca * 2, oy + sa * 2, 17)
            .map(n1)
            .join(" ")} L ${at(ox + ca * 16, oy + sa * 16, 17)
            .map(n1)
            .join(" ")}`,
          cls: "ray",
          style: `animation-delay:${i * 160}ms`,
        });
      },
    });
  });

  // The power pack, standing at the tail, with its connector and loop of wire.
  items.push({
    v: depth(-32, 2) - 5,
    build: () => {
      box(-41, -25, -4, 7, 8, 40);
      for (const z of [18, 30]) {
        elems.push({ d: open([at(-41, -4, z), at(-41, 7, z)]), cls: "detail" });
        elems.push({
          d: open([at(-41, -4, z), at(-25, -4, z)]),
          cls: "detail",
        });
      }
      box(-36, -29, -0.5, 4.5, 40, 44);
      elems.push({
        d: [-34, -32.5, -31]
          .map((a) => open([at(a, -0.5, 44), at(a, 4.5, 44)]))
          .join(" "),
        cls: "detail",
      });
      const a0 = at(-29, 2, 42);
      const a1 = at(-6, 10, 30);
      const loop = (dx: number, c1: number, c2: number) =>
        `M ${n1(a0[0] + dx)} ${n1(a0[1])} C ${n1(a0[0] + 6 + dx)} ${n1(a0[1] - c1)} ${n1(a1[0] + 10 + dx)} ${n1(a1[1] - c2)} ${n1(a1[0] + dx)} ${n1(a1[1])}`;
      elems.push(
        { d: loop(0, 22, 26), cls: "wire" },
        { d: loop(-1.8, 20, 24), cls: "wire" },
      );
    },
  });

  // The stack in the middle: cage, USB-C board, OLED.
  items.push({
    v: 0,
    build: () => {
      const cage = foot([
        [-24, -16],
        [8, -16],
        [8, 16],
        [-24, 16],
      ]);
      const l = prism(cage, 8, 27);
      elems.push({ d: l.sides, cls: "face" }, { d: l.top, cls: "face" });
      for (const z of [15, 21]) {
        const loop = frontEdges(cage)
          .map((i) =>
            open([
              p3([...cage[i], z] as P3),
              p3([...cage[(i + 1) % 4], z] as P3),
            ]),
          )
          .join(" ");
        elems.push({ d: loop, cls: "detail" });
      }
      box(-22, 8, -15, 15, 27, 29.4);
      elems.push({
        d: poly([
          at(-9, -15, 27.6),
          at(-1, -15, 27.6),
          at(-1, -15, 28.8),
          at(-9, -15, 28.8),
        ]),
        cls: "detail",
      });
      for (const [a, b] of [
        [-17, -11],
        [4, -11],
        [4, 11],
        [-17, 11],
      ])
        elems.push({
          d: open([at(a, b, 29.4), at(a, b, 31.4)]),
          cls: "detail",
        });
      box(-18, 9, -14, 14, 31.4, 33);
      const glass: Pt[] = [
        [-16, -11.5],
        [5, -11.5],
        [5, 11.5],
        [-16, 11.5],
      ];
      elems.push({
        d: poly(glass.map((q) => at(q[0], q[1], 33))),
        cls: "face detail",
      });
      const lines = [
        [-13, 9],
        [-9.5, 7],
        [-6, 10],
        [-2.5, 5],
      ].map(([a, len]) => open([at(a, -9, 33), at(a, -9 + len * 1.7, 33)]));
      elems.push({ d: lines.join(" "), cls: "lit" });
      elems.push({ d: dot(at(-9.5, -10.5, 33)), cls: "lit-dot cursor" });
      elems.push({
        d: [-6, -2, 2, 6]
          .map((b) => open([at(-18, b, 33), at(-19.6, b, 33)]))
          .join(" "),
        cls: "detail",
      });
    },
  });

  // Wheels: cylinders on the axle line, drawn as the hull of their two end
  // discs, with the end that faces the viewer shown with its tread ring.
  const wheelR = 21;
  const wheelW = 16;
  const disc = (b: number, rr: number, end: number): Pt[] => {
    const pts: Pt[] = [];
    for (let k = 0; k < 28; k++) {
      const th = (k / 28) * Math.PI * 2;
      pts.push(
        p3([
          ...P(-14 + rr * Math.cos(th), b + end),
          wheelR + rr * Math.sin(th),
        ] as P3),
      );
    }
    return pts;
  };
  for (const side of [1, -1]) {
    const b = side * 27;
    items.push({
      v: depth(-14, b),
      build: () => {
        elems.push({
          d: poly(
            hull([
              ...disc(b, wheelR, -wheelW / 2),
              ...disc(b, wheelR, wheelW / 2),
            ]),
          ),
          cls: "face",
        });
        elems.push({ d: poly(disc(b, wheelR, -wheelW / 2)), cls: "face" });
        elems.push({
          d: poly(disc(b, wheelR * 0.72, -wheelW / 2)),
          cls: "detail",
        });
        if (side < 0) {
          elems.push({ d: poly(disc(b, 7, -wheelW / 2)), cls: "face" });
          elems.push({ d: poly(disc(b, 2.6, -wheelW / 2)), cls: "detail" });
        }
      },
    });
  }

  items.sort((a, b) => a.v - b.v);
  for (const it of items) it.build();
  return { elems, scale: 2 };
}
