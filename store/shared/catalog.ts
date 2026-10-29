// Everything a customer can pick, with its price.
//
// `cost` is the average Indian retail price (INR, incl. GST) found across
// Robu, Probots, Hubtronics, Robocraze, Meckeys and StacksKB in Oct 2026;
// imported-only parts (hotswap sockets, Choc switches) are landed estimates.
// Customer price = cost × MARKUP, rounded to the rupee. Edit this file to
// change any price; the client and the Worker both read it, so the order
// total is always recomputed server-side from the same numbers.

export const MARKUP = 1.2;

export const price = (cost: number) => Math.round(cost * MARKUP);

export interface Mcu {
  id: string;
  name: string;
  chip: string;
  firmware: string;
  /** GPIO pins reachable for the matrix, encoders and OLED. */
  pins: number;
  /** Module footprint in mm, USB-C on the short end. */
  mm: { w: number; h: number };
  cost: number;
  blurb: string;
}

export const MCUS: Mcu[] = [
  {
    id: "pro-micro",
    name: "Pro Micro (USB-C)",
    chip: "ATmega32U4",
    firmware: "QMK / VIA",
    pins: 18,
    mm: { w: 18, h: 33 },
    cost: 719,
    blurb: "The classic. Every QMK guide on the internet was written for it.",
  },
  {
    id: "rp2040-pro-micro",
    name: "RP2040 Pro Micro",
    chip: "RP2040",
    firmware: "QMK / VIA / KMK",
    pins: 20,
    mm: { w: 18, h: 33 },
    cost: 450,
    blurb: "Pro Micro footprint, 16 MB flash, drag-and-drop flashing.",
  },
  {
    id: "rp2040-zero",
    name: "RP2040-Zero",
    chip: "RP2040",
    firmware: "QMK / VIA / KMK",
    pins: 20,
    mm: { w: 18, h: 23.5 },
    cost: 352,
    blurb: "Tiny and cheap. Ideal for macropads and 2-key boards.",
  },
];

export interface Switch {
  id: string;
  family: "mx" | "choc";
  name: string;
  feel: "Linear" | "Tactile" | "Clicky";
  /** Per switch. */
  cost: number;
}

export const SWITCHES: Switch[] = [
  { id: "gateron-milky-yellow", family: "mx", name: "Gateron Milky Yellow", feel: "Linear", cost: 16 },
  { id: "gateron-g-pro-brown", family: "mx", name: "Gateron G Pro 3.0 Brown", feel: "Tactile", cost: 24 },
  { id: "gateron-g-pro-blue", family: "mx", name: "Gateron G Pro 3.0 Blue", feel: "Clicky", cost: 24 },
  { id: "gateron-baby-raccoon", family: "mx", name: "Gateron Baby Raccoon 2.0", feel: "Linear", cost: 45 },
  { id: "choc-red", family: "choc", name: "Kailh Choc v1 Red", feel: "Linear", cost: 40 },
  { id: "choc-brown", family: "choc", name: "Kailh Choc v1 Brown", feel: "Tactile", cost: 40 },
  { id: "choc-white", family: "choc", name: "Kailh Choc v1 White", feel: "Clicky", cost: 42 },
];

/** Per socket, by switch family. */
export const HOTSWAP_COST = { mx: 14, choc: 16 } as const;

/**
 * Keycap profiles. Row heights and tilts (mm, degrees; R1 = number row down
 * to R4 = bottom rows) drive the 3D shape, so the difference between
 * profiles is visible, not just named.
 */
export interface KeycapProfile {
  id: string;
  family: "mx" | "choc";
  name: string;
  blurb: string;
  /** Per 1u of cap; wide caps count by width. */
  cost: number;
  sculpted: boolean;
  rows: { h: number; tilt: number }[];
  /** How far the top face sits in from the base (mm). */
  taper: { x: number; front: number; back: number };
  dish: "cyl" | "sph" | "flat";
  dishDepth: number;
  /** Corner radius of the top face (mm). */
  topR: number;
}

export const KEYCAP_PROFILES: KeycapProfile[] = [
  {
    id: "cherry",
    family: "mx",
    name: "Cherry",
    blurb: "Low and sculpted. The enthusiast default.",
    cost: 14,
    sculpted: true,
    rows: [
      { h: 9.4, tilt: 9 },
      { h: 7.9, tilt: 5 },
      { h: 7.4, tilt: 0 },
      { h: 8.4, tilt: -6 },
    ],
    taper: { x: 2.8, front: 3.6, back: 1.4 },
    dish: "cyl",
    dishDepth: 0.55,
    topR: 1.6,
  },
  {
    id: "oem",
    family: "mx",
    name: "OEM",
    blurb: "Taller sculpt, like most office keyboards.",
    cost: 12,
    sculpted: true,
    rows: [
      { h: 11.9, tilt: 10 },
      { h: 9.8, tilt: 5 },
      { h: 9.0, tilt: 1 },
      { h: 9.6, tilt: -6 },
    ],
    taper: { x: 2.9, front: 3.8, back: 1.4 },
    dish: "cyl",
    dishDepth: 0.6,
    topR: 1.6,
  },
  {
    id: "sa",
    family: "mx",
    name: "SA",
    blurb: "Tall, round and retro, with a spherical dish.",
    cost: 22,
    sculpted: true,
    rows: [
      { h: 13.6, tilt: 10 },
      { h: 12.4, tilt: 5 },
      { h: 12.1, tilt: 0 },
      { h: 12.9, tilt: -10 },
    ],
    taper: { x: 3.1, front: 3.4, back: 2.6 },
    dish: "sph",
    dishDepth: 1.0,
    topR: 3.6,
  },
  {
    id: "dsa",
    family: "mx",
    name: "DSA",
    blurb: "Low and uniform: every row the same, so any key goes anywhere.",
    cost: 16,
    sculpted: false,
    rows: [{ h: 7.6, tilt: 0 }],
    taper: { x: 3.0, front: 2.9, back: 2.9 },
    dish: "sph",
    dishDepth: 0.8,
    topR: 2.2,
  },
  {
    id: "xda",
    family: "mx",
    name: "XDA",
    blurb: "Uniform with a wide, nearly flat top. A big landing area.",
    cost: 16,
    sculpted: false,
    rows: [{ h: 9.1, tilt: 0 }],
    taper: { x: 1.6, front: 1.6, back: 1.6 },
    dish: "sph",
    dishDepth: 0.6,
    topR: 2.6,
  },
  {
    id: "mbk",
    family: "choc",
    name: "MBK",
    blurb: "Low-profile Choc caps with a soft spherical dish.",
    cost: 28,
    sculpted: false,
    rows: [{ h: 3.4, tilt: 0 }],
    taper: { x: 0.7, front: 0.7, back: 0.7 },
    dish: "sph",
    dishDepth: 0.3,
    topR: 1.6,
  },
  {
    id: "cfx",
    family: "choc",
    name: "CFX",
    blurb: "Choc caps with a cylindrical dish, like a slim Cherry.",
    cost: 30,
    sculpted: false,
    rows: [{ h: 5.3, tilt: 0 }],
    taper: { x: 1.4, front: 1.6, back: 1.2 },
    dish: "cyl",
    dishDepth: 0.5,
    topR: 1.4,
  },
];

/** Dye-sublimated legends, per 1u. */
export const LEGEND_COST = 8;

export interface Colorway {
  id: string;
  name: string;
  alpha: string;
  mod: string;
  accent: string;
  legend: string;
}

export const COLORWAYS: Colorway[] = [
  { id: "classic", name: "Classic", alpha: "#f4f3ef", mod: "#cfcfcb", accent: "#ff5a1f", legend: "#2a2a2e" },
  { id: "carbon", name: "Carbon", alpha: "#55575e", mod: "#34353a", accent: "#ff5a1f", legend: "#ececee" },
  { id: "paper", name: "Paper", alpha: "#f6f5f1", mod: "#f6f5f1", accent: "#f6f5f1", legend: "#6a6a70" },
  { id: "mint", name: "Mint", alpha: "#cfe9dc", mod: "#f4f3ef", accent: "#1f4f8f", legend: "#24314a" },
];

export const capProfileById = (id: string) => KEYCAP_PROFILES.find((k) => k.id === id);
export const colorwayById = (id: string) => COLORWAYS.find((c) => c.id === id) ?? COLORWAYS[0];

export const ENCODER_COST = 80 + 55; // EC11 with push switch + aluminium knob
export const OLED_COST = 180; // 0.91" 128×32 SSD1306, I²C
export const DIODE_COST = 1; // 1N4148W, one per key in a matrix

export interface Mask {
  id: string;
  name: string;
  hex: string;
  /** Extra charge over green (fab surcharge, before markup). */
  cost: number;
}

export const MASKS: Mask[] = [
  { id: "green", name: "Green", hex: "#1e6b3a", cost: 0 },
  { id: "black", name: "Matte black", hex: "#1b1b1d", cost: 0 },
  { id: "white", name: "White", hex: "#eeeeea", cost: 0 },
  { id: "blue", name: "Blue", hex: "#1c4f9c", cost: 0 },
  { id: "red", name: "Red", hex: "#a8262a", cost: 0 },
  { id: "purple", name: "Purple", hex: "#5b3a8c", cost: 250 },
];

/** PCB cost: fab minimum + area + shipping, per order (5 boards made, 1 used). */
export const PCB_COST = { base: 350, perCm2: 0.9, shipping: 900, logo: 0 } as const;

export interface CaseFinish {
  id: string;
  name: string;
  hex: string;
  /** Rendering hints for the 3D review. */
  metal?: boolean;
  clear?: boolean;
}

export interface CaseOption {
  type: "printed" | "acrylic" | "cnc";
  name: string;
  blurb: string;
  perCm2: number;
  min: number;
  leadDays: string;
  finishes: CaseFinish[];
}

export const CASES: CaseOption[] = [
  {
    type: "printed",
    name: "3D printed",
    blurb: "PETG tray case with an integrated plate. Light, cheap, quick.",
    perCm2: 6,
    min: 400,
    leadDays: "3–5 days",
    finishes: [
      { id: "printed-black", name: "Black", hex: "#232326" },
      { id: "printed-white", name: "White", hex: "#f2f1ee" },
      { id: "printed-orange", name: "Orange", hex: "#f06a2a" },
      { id: "printed-teal", name: "Teal", hex: "#2f8f8a" },
    ],
  },
  {
    type: "acrylic",
    name: "Acrylic sandwich",
    blurb: "Laser-cut 3 mm layers stacked on standoffs. Shows off the PCB.",
    perCm2: 9,
    min: 600,
    leadDays: "4–6 days",
    finishes: [
      { id: "acrylic-clear", name: "Clear", hex: "#dfe9ee", clear: true },
      { id: "acrylic-frosted", name: "Frosted", hex: "#e9ecee", clear: true },
      { id: "acrylic-black", name: "Black", hex: "#141416" },
    ],
  },
  {
    type: "cnc",
    name: "CNC aluminium",
    blurb: "Milled 6061 with anodised finish. Heavy, quiet, forever.",
    perCm2: 60,
    min: 6000,
    leadDays: "12–18 days",
    finishes: [
      { id: "cnc-silver", name: "Silver", hex: "#c9cacc", metal: true },
      { id: "cnc-space", name: "Space grey", hex: "#55575c", metal: true },
      { id: "cnc-navy", name: "Navy", hex: "#26324d", metal: true },
    ],
  },
];

/** Screws, standoffs, bumpons, USB-C cable, kit box. */
export const HARDWARE_COST = 250;
export const PACKING_COST = 150;
export const SHIPPING_FLAT = 120; // customer-facing, no markup

export const mcuById = (id: string) => MCUS.find((m) => m.id === id);
export const switchById = (id: string | null) => SWITCHES.find((s) => s.id === id);
export const maskById = (id: string) => MASKS.find((m) => m.id === id);
export const caseByType = (type: string) => CASES.find((c) => c.type === type);
export const finishById = (id: string) =>
  CASES.flatMap((c) => c.finishes).find((f) => f.id === id);
