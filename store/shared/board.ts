// Geometry and wiring facts derived from a build: the case outline, the PCB
// inside it, where the controller sits and where its USB-C port leaves the
// case, what collides, and how the switches get wired.
//
// Everything is in keyboard units (1u = 19.05 mm), y growing downward.

import { MCUS, type Mcu, mcuById } from "./catalog";
import type { BuildSpec, Item, McuPlace, Outline, Rect, UsbDir } from "./types";

export const U_MM = 19.05;
export const SNAP = 0.25;
/** Finer snap for the case edges and the controller. */
export const FINE = 0.125;
/** Case wall, outline to PCB edge (≈ 6 mm). */
export const WALL = 0.32;
/** PCB clearance around the outermost keys (≈ 4 mm). */
export const EDGE = 0.21;
/** Largest case we will cut, print or mill (≈ 457 × 210 mm). */
export const CASE_LIMIT = { w: 24, h: 11 };
/** M3 mounting holes: drill and copper pad diameter (mm). */
export const HOLE = { drill: 3.2, pad: 6 };
/** Closest a hole centre sits to the PCB corner (mm). */
const HOLE_INSET = 3.5;
/** Corner radius presets, in mm. */
export const RADII_MM = [0, 2, 6, 12];

export const snap = (v: number, step = SNAP) => Math.round(v / step) * step;
export const mm = (u: number) => u * U_MM;

const EPS = 1e-6;

export function bounds(items: Rect[]): Rect {
  if (items.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...items.map((i) => i.x));
  const y0 = Math.min(...items.map((i) => i.y));
  const x1 = Math.max(...items.map((i) => i.x + i.w));
  const y1 = Math.max(...items.map((i) => i.y + i.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Grow (d > 0) or shrink (d < 0) a rect on every side. */
export const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 });

export const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;

export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.x + inner.w <= outer.x + outer.w + EPS &&
  inner.y + inner.h <= outer.y + outer.h + EPS;

/** Ids of every item that collides with another. */
export function overlaps(items: Item[]): Set<string> {
  const hit = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlap(items[i], items[j])) {
        hit.add(items[i].id);
        hit.add(items[j].id);
      }
    }
  }
  return hit;
}

/** Where a part occupies the PCB: a switch only its 14 mm footprint, the rest their full body. */
export function footprint(i: Item): Rect {
  if (i.kind !== "key") return i;
  const f = 14 / U_MM;
  return { x: i.x + i.w / 2 - f / 2, y: i.y + i.h / 2 - f / 2, w: f, h: f };
}

const circleHits = (c: { x: number; y: number }, r: number, b: Rect) => {
  const dx = c.x - Math.max(b.x, Math.min(c.x, b.x + b.w));
  const dy = c.y - Math.max(b.y, Math.min(c.y, b.y + b.h));
  return dx * dx + dy * dy < r * r - EPS;
};

/** PCB corner radius (u) for a given case outline. */
export const pcbRadius = (o: Outline) => Math.max(0, Math.min(o.r, o.w / 2, o.h / 2) - WALL);

/** Hole centre's distance from the PCB corner (u), clear of the corner rounding. */
const holeInset = (o: { r: number; w: number; h: number }) =>
  Math.max(HOLE_INSET, pcbRadius({ x: 0, y: 0, ...o }) * U_MM * 0.45 + 2.2) / U_MM;

/** The four M3 hole centres, tucked into the PCB corners clear of the rounding. */
export function holesFor(o: Outline) {
  const pcb = grow(o, -WALL);
  const d = holeInset(o);
  return [
    { x: pcb.x + d, y: pcb.y + d },
    { x: pcb.x + pcb.w - d, y: pcb.y + d },
    { x: pcb.x + pcb.w - d, y: pcb.y + pcb.h - d },
    { x: pcb.x + d, y: pcb.y + pcb.h - d },
  ];
}

/** Keep-out around a hole: its copper pad plus half a millimetre. */
const HOLE_R = (HOLE.pad / 2 + 0.5) / U_MM;
/** The USB-C shell sticks out past the module's end (u). */
const USB_LIP = 1.4 / U_MM;

/** The controller's full body, including the USB-C shell past its end. */
export function mcuBody(r: Rect, dir: UsbDir): Rect {
  switch (dir) {
    case 0:
      return { ...r, y: r.y - USB_LIP, h: r.h + USB_LIP };
    case 90:
      return { ...r, w: r.w + USB_LIP };
    case 180:
      return { ...r, h: r.h + USB_LIP };
    default:
      return { ...r, x: r.x - USB_LIP, w: r.w + USB_LIP };
  }
}

/** Does anything sit on a hole's pad? Keys count by their whole keycap. */
export const holeBlocked = (h: { x: number; y: number }, parts: Rect[]) => parts.some((p) => circleHits(h, HOLE_R, p));

/** Does this controller position sit fully on the PCB, off keys and holes? */
export function mcuFits(items: Item[], pcb: Rect, holes: { x: number; y: number }[], r: Rect, dir: UsbDir) {
  const body = mcuBody(r, dir);
  return contains(pcb, r) && !items.some((i) => overlap(r, footprint(i))) && !holes.some((h) => holeBlocked(h, [body]));
}

/* ------------------------------------------------------------ Controller */

export function mcuRect(mcu: Mcu, p: McuPlace): Rect {
  const w = mcu.mm.w / U_MM;
  const h = mcu.mm.h / U_MM;
  const side = p.rot === 90 || p.rot === 270;
  return { x: p.x, y: p.y, w: side ? h : w, h: side ? w : h };
}

/** Midpoint of the USB-C end of the module. */
export function usbPoint(r: Rect, dir: UsbDir) {
  switch (dir) {
    case 0:
      return { x: r.x + r.w / 2, y: r.y };
    case 90:
      return { x: r.x + r.w, y: r.y + r.h / 2 };
    case 180:
      return { x: r.x + r.w / 2, y: r.y + r.h };
    default:
      return { x: r.x, y: r.y + r.h / 2 };
  }
}

/** Distance from the USB-C end to the PCB edge it faces. */
export function usbGap(r: Rect, dir: UsbDir, pcb: Rect) {
  switch (dir) {
    case 0:
      return r.y - pcb.y;
    case 90:
      return pcb.x + pcb.w - (r.x + r.w);
    case 180:
      return pcb.y + pcb.h - (r.y + r.h);
    default:
      return r.x - pcb.x;
  }
}

/** Slide the module along its USB axis so the port sits on the PCB edge. */
export function flushUsb(mcu: Mcu, p: McuPlace, pcb: Rect): McuPlace {
  const r = mcuRect(mcu, p);
  switch (p.rot) {
    case 0:
      return { ...p, y: pcb.y };
    case 90:
      return { ...p, x: pcb.x + pcb.w - r.w };
    case 180:
      return { ...p, y: pcb.y + pcb.h - r.h };
    default:
      return { ...p, x: pcb.x };
  }
}

/** Free spot on the given PCB edge, nearest the middle, or null. */
function spotOnEdge(mcu: Mcu, dir: UsbDir, pcb: Rect, keep: Rect[]): McuPlace | null {
  const probe = mcuRect(mcu, { x: 0, y: 0, rot: dir });
  const along = dir === 0 || dir === 180;
  const span = along ? pcb.w - probe.w : pcb.h - probe.h;
  if (span < 0) return null;
  const mid = span / 2;
  for (let k = 0; k <= span / FINE + 1; k++) {
    const off = mid + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * FINE;
    if (off < -EPS || off > span + EPS) continue;
    const base: McuPlace = along
      ? { x: pcb.x + off, y: 0, rot: dir }
      : { x: 0, y: pcb.y + off, rot: dir };
    const p = flushUsb(mcu, base, pcb);
    const r = mcuRect(mcu, p);
    if (!keep.some((k2) => overlap(grow(r, 0.04), k2))) return p;
  }
  return null;
}

/**
 * Place the controller facing `dir`: keep it near where it was if that spot
 * is free, otherwise the free spot on that edge nearest the middle.
 */
export function placeFacing(spec: BuildSpec, dir: UsbDir): McuPlace {
  const res = resolve(spec);
  const c = { x: res.mcuRect.x + res.mcuRect.w / 2, y: res.mcuRect.y + res.mcuRect.h / 2 };
  const probe = mcuRect(res.mcu, { x: 0, y: 0, rot: dir });
  const kept = flushUsb(res.mcu, { x: c.x - probe.w / 2, y: c.y - probe.h / 2, rot: dir }, res.pcb);
  const r = mcuRect(res.mcu, kept);
  if (contains(res.pcb, r) && !spec.layout.items.some((i) => overlap(r, i))) return kept;
  return spotOnEdge(res.mcu, dir, res.pcb, spec.layout.items) ?? kept;
}

/** Keep a rect inside another by sliding it. */
export function clampInto(r: Rect, outer: Rect): Rect {
  return {
    ...r,
    x: Math.min(Math.max(r.x, outer.x), outer.x + outer.w - r.w),
    y: Math.min(Math.max(r.y, outer.y), outer.y + outer.h - r.h),
  };
}

/** The tight outline around keys (with clearance) and the controller. */
export function fitOutline(items: Item[], mcuR: Rect | null, r: number): Outline {
  const parts: Rect[] = [];
  // The hole sits on the diagonal in from the PCB corner; the corner key must
  // stay a pad radius (plus clearance) away from it along that diagonal.
  const margin = Math.max(EDGE, holeInset({ r, w: 99, h: 99 }) + HOLE_R / Math.SQRT2 + 0.2 / U_MM);
  if (items.length) parts.push(grow(bounds(items), margin));
  if (mcuR) parts.push(mcuR);
  const b = parts.length ? bounds(parts) : { x: 0, y: 0, w: 2, h: 2 };
  return { ...grow(b, WALL), r };
}

/** Smallest outline that still holds everything, for clamping edge drags. */
export function minOutline(items: Item[], mcuR: Rect | null, r = 0): Rect {
  return fitOutline(items, mcuR, r);
}

export function clampOutline(o: Outline, min: Rect): Outline {
  let x0 = Math.min(o.x, min.x);
  let y0 = Math.min(o.y, min.y);
  let x1 = Math.max(o.x + o.w, min.x + min.w);
  let y1 = Math.max(o.y + o.h, min.y + min.h);
  // Never past the size limit: pull back the edge that moved.
  if (x1 - x0 > CASE_LIMIT.w) {
    if (o.x < min.x) x0 = x1 - CASE_LIMIT.w;
    else x1 = x0 + CASE_LIMIT.w;
  }
  if (y1 - y0 > CASE_LIMIT.h) {
    if (o.y < min.y) y0 = y1 - CASE_LIMIT.h;
    else y1 = y0 + CASE_LIMIT.h;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, r: o.r };
}

export interface Resolved {
  mcu: Mcu;
  outline: Outline;
  pcb: Rect;
  place: McuPlace;
  mcuRect: Rect;
  usb: { x: number; y: number; dir: UsbDir; gap: number };
  autoOutline: boolean;
  autoPlace: boolean;
  /** Items that stick out of the PCB. */
  outside: Set<string>;
  mcuClash: Set<string>;
  mcuOutside: boolean;
  /** M3 holes, each flagged if a part sits on it. */
  holes: { x: number; y: number; clash: boolean }[];
  tooBig: boolean;
}

const DEFAULT_R = 6 / U_MM;

/** Resolve automatic choices and check the physical build. */
export function resolve(spec: BuildSpec): Resolved {
  const items = spec.layout.items;
  const mcu = mcuById(spec.electronics.mcu) ?? MCUS[0];
  const manual = spec.case.outline ?? null;
  let place = spec.electronics.mcuPlace ?? null;
  const autoPlace = !place;

  if (!place) {
    // Prefer the top edge, USB pointing away from the typist; then the sides.
    const o0 = manual ?? fitOutline(items, null, DEFAULT_R);
    const pcb0 = grow(o0, -WALL);
    const keep: Rect[] = [...items, ...holesFor(o0).map((h) => grow({ ...h, w: 0, h: 0 }, HOLE_R + USB_LIP))];
    for (const dir of [0, 90, 270] as UsbDir[]) {
      place = spotOnEdge(mcu, dir, pcb0, keep);
      if (place) break;
    }
    if (!place) {
      // No room inside: give it a strip of its own above the keys.
      const b = items.length ? bounds(items) : { x: 0, y: 0, w: 1, h: 1 };
      const r = mcuRect(mcu, { x: 0, y: 0, rot: 0 });
      place = { x: b.x + b.w / 2 - r.w / 2, y: b.y - EDGE - r.h, rot: 0 };
      if (manual) place = flushUsb(mcu, place, grow(manual, -WALL));
    }
  }

  const mr = mcuRect(mcu, place);
  const outline = manual ?? fitOutline(items, mr, DEFAULT_R);
  const pcb = grow(outline, -WALL);
  const pt = usbPoint(mr, place.rot);

  const outside = new Set(items.filter((i) => !contains(pcb, i)).map((i) => i.id));
  const mcuClash = new Set(items.filter((i) => overlap(mr, footprint(i))).map((i) => i.id));
  const holes = holesFor(outline).map((h) => ({
    ...h,
    clash: holeBlocked(h, [mcuBody(mr, place.rot), ...items]),
  }));

  return {
    mcu,
    outline,
    pcb,
    place,
    mcuRect: mr,
    usb: { ...pt, dir: place.rot, gap: usbGap(mr, place.rot, pcb) },
    autoOutline: !manual,
    autoPlace,
    outside,
    mcuClash,
    mcuOutside: !contains(pcb, mr),
    holes,
    tooBig: outline.w > CASE_LIMIT.w + EPS || outline.h > CASE_LIMIT.h + EPS,
  };
}

/** Physical PCB size in millimetres. */
export function pcbSize(spec: BuildSpec) {
  const { pcb } = resolve(spec);
  return { w: mm(pcb.w), h: mm(pcb.h) };
}

/** Case footprint in millimetres. */
export function caseSize(spec: BuildSpec) {
  const { outline } = resolve(spec);
  return { w: mm(outline.w), h: mm(outline.h) };
}

/** Problems that stop an order, in plain words. */
export function physicalIssues(res: Resolved): string[] {
  const out: string[] = [];
  if (res.outside.size) out.push(`${res.outside.size} items sit outside the case. Grow the case or move them in.`);
  if (res.mcuClash.size) out.push("The controller sits on top of keys. Move it to free board space.");
  if (res.mcuOutside) out.push("The controller hangs outside the case.");
  else if (res.usb.gap > 0.02) out.push("The USB-C port doesn't reach the case edge. Slide the controller to the edge.");
  const blocked = res.holes.filter((h) => h.clash).length;
  if (blocked) out.push(`${blocked} M3 mounting hole${blocked > 1 ? "s are" : " is"} covered by a part. Grow the case or move the part.`);
  if (res.tooBig) out.push(`The case is over the ${Math.round(mm(CASE_LIMIT.w))} × ${Math.round(mm(CASE_LIMIT.h))} mm limit.`);
  return out;
}

/* ---------------------------------------------------------------- Wiring */

export type Wiring =
  | { kind: "direct"; pins: number }
  | { kind: "matrix"; rows: number; cols: number; pins: number }
  | { kind: "too-many"; pins: number };

export interface WiringReport {
  wiring: Wiring;
  keys: number;
  encoders: number;
  oleds: number;
  /** Pins used by encoders (A/B each) and the OLED (I²C SDA/SCL). */
  extraPins: number;
  available: number;
  diodes: number;
}

/**
 * How the switches get wired. Up to the free pin count, each switch gets its
 * own pin (no diodes). Beyond that, a row/column matrix following the
 * physical rows; if that runs out of pins, the generator folds it into the
 * squarest matrix that fits.
 */
export function wiring(spec: BuildSpec): WiringReport {
  const items = spec.layout.items;
  const keys = items.filter((i) => i.kind === "key");
  const encoders = items.filter((i) => i.kind === "encoder").length;
  const oleds = items.filter((i) => i.kind === "oled").length;
  const extraPins = encoders * 2 + (oleds > 0 ? 2 : 0);
  const available = (mcuById(spec.electronics.mcu)?.pins ?? 18) - extraPins;
  const n = keys.length;

  let w: Wiring;
  if (n <= available && n <= 8) {
    w = { kind: "direct", pins: n };
  } else {
    const rows = physicalRows(keys);
    const physR = rows.length;
    const physC = Math.max(0, ...rows.map((r) => r.length));
    if (physR + physC <= available) {
      w = { kind: "matrix", rows: physR, cols: physC, pins: physR + physC };
    } else {
      const r = Math.ceil(Math.sqrt(n));
      const c = Math.ceil(n / r);
      w =
        r + c <= available
          ? { kind: "matrix", rows: r, cols: c, pins: r + c }
          : { kind: "too-many", pins: r + c };
    }
  }

  return {
    wiring: w,
    keys: n,
    encoders,
    oleds,
    extraPins,
    available,
    diodes: w.kind === "matrix" ? n : 0,
  };
}

function physicalRows(keys: Item[]): Item[][] {
  const rows = new Map<number, Item[]>();
  for (const k of keys) {
    const r = Math.floor(k.y + k.h / 2);
    rows.set(r, [...(rows.get(r) ?? []), k]);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x));
}

/**
 * Air-wires from the controller: one line per pin it drives, to the first
 * switch on that row or column (or to each switch when wired directly, and
 * to each encoder and the OLED). Shows how far the copper has to run.
 */
export function airwires(spec: BuildSpec, res: Resolved): { x: number; y: number; kind: "row" | "col" | "direct" | "extra" }[] {
  const items = spec.layout.items;
  const keys = items.filter((i) => i.kind === "key");
  const c = (i: Item) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 });
  const w = wiring(spec);
  const out: { x: number; y: number; kind: "row" | "col" | "direct" | "extra" }[] = [];

  if (w.wiring.kind === "direct") for (const k of keys) out.push({ ...c(k), kind: "direct" });
  else if (w.wiring.kind === "matrix") {
    const rows = physicalRows(keys);
    const near = (row: Item[]) => {
      // Enter each row from the end nearer the controller.
      const mx = res.mcuRect.x + res.mcuRect.w / 2;
      const a = row[0];
      const b = row[row.length - 1];
      return Math.abs(c(a).x - mx) <= Math.abs(c(b).x - mx) ? a : b;
    };
    for (const row of rows) out.push({ ...c(near(row)), kind: "row" });
    const widest = rows.reduce((a, b) => (b.length > a.length ? b : a), [] as Item[]);
    const top = rows[0] ?? [];
    for (let i = 0; i < Math.min(w.wiring.cols, widest.length); i++) {
      // Each column enters at its topmost switch.
      const k = widest[i];
      const above = top.find((t) => Math.abs(c(t).x - c(k).x) < 0.5) ?? k;
      out.push({ ...c(above), kind: "col" });
    }
  }
  for (const e of items.filter((i) => i.kind !== "key")) out.push({ ...c(e), kind: "extra" });
  return out;
}
