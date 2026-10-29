// Starting shapes. Written as KLE raw data so every template exercises the
// same import path a customer's own layout does.

import { newId, parseKle } from "./kle";
import type { BuildSpec, Item, KeycapChoice } from "./types";

export interface Template {
  id: string;
  name: string;
  blurb: string;
  kle: string;
  /** Encoders and OLEDs, which KLE has no notion of. */
  extras?: Omit<Item, "id">[];
}

const enc = (x: number, y: number): Omit<Item, "id"> => ({ kind: "encoder", x, y, w: 1, h: 1, label: "Knob" });
const oled = (x: number, y: number): Omit<Item, "id"> => ({ kind: "oled", x, y, w: 2, h: 1, label: "OLED" });

export const TEMPLATES: Template[] = [
  {
    id: "copy-paste",
    name: "Copy / Paste",
    blurb: "Two keys. Ctrl+C, Ctrl+V. Nothing else.",
    kle: `[["Copy","Paste"]]`,
  },
  {
    id: "deck-6",
    name: "Stream deck",
    blurb: "Six keys and a volume knob.",
    kle: `[["Scene 1","Scene 2","Scene 3"],["Mute","Cam","Live"]]`,
    extras: [enc(3.25, 0.5)],
  },
  {
    id: "macropad-9",
    name: "Macropad",
    blurb: "3×3 grid, a knob and a little screen.",
    kle: `[[{y:1},"7","8","9"],["4","5","6"],["1","2","3"]]`,
    extras: [enc(2, 0), oled(0, 0)],
  },
  {
    id: "numpad",
    name: "Numpad",
    blurb: "Full 17-key numpad for spreadsheets.",
    kle: `[["Num","/","*","-"],["7","8","9",{h:2},"+"],["4","5","6"],["1","2","3",{h:2},"Enter"],[{w:2},"0","."]]`,
  },
  {
    id: "ortho-40",
    name: "40% ortho",
    blurb: "4×12 grid. Compact and very hackable.",
    kle: `[["Tab","Q","W","E","R","T","Y","U","I","O","P","Bksp"],["Esc","A","S","D","F","G","H","J","K","L",";","'"],["Shift","Z","X","C","V","B","N","M",",",".","/","Enter"],["Fn","Ctrl","Alt","Gui","Lower",{w:2},"Space","Raise","Left","Down","Up","Right"]]`,
  },
  {
    id: "ansi-60",
    name: "60% ANSI",
    blurb: "The classic compact layout, 61 keys.",
    kle: `[["Esc","1","2","3","4","5","6","7","8","9","0","-","=",{w:2},"Backspace"],[{w:1.5},"Tab","Q","W","E","R","T","Y","U","I","O","P","[","]",{w:1.5},"\\\\"],[{w:1.75},"Caps","A","S","D","F","G","H","J","K","L",";","'",{w:2.25},"Enter"],[{w:2.25},"Shift","Z","X","C","V","B","N","M",",",".","/",{w:2.75},"Shift"],[{w:1.25},"Ctrl",{w:1.25},"Win",{w:1.25},"Alt",{w:6.25},"",{w:1.25},"Alt",{w:1.25},"Fn",{w:1.25},"Menu",{w:1.25},"Ctrl"]]`,
  },
  {
    id: "ansi-75",
    name: "75% ANSI",
    blurb: "Function row and arrows in a tight 84-key frame.",
    kle: `[["Esc","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","PrtSc","Ins","Del"],[{y:0.25},"\`","1","2","3","4","5","6","7","8","9","0","-","=",{w:2},"Backspace","Home"],[{w:1.5},"Tab","Q","W","E","R","T","Y","U","I","O","P","[","]",{w:1.5},"\\\\","PgUp"],[{w:1.75},"Caps","A","S","D","F","G","H","J","K","L",";","'",{w:2.25},"Enter","PgDn"],[{w:2.25},"Shift","Z","X","C","V","B","N","M",",",".","/",{w:1.75},"Shift","Up","End"],[{w:1.25},"Ctrl",{w:1.25},"Win",{w:1.25},"Alt",{w:6.25},"","Alt","Fn","Ctrl","Left","Down","Right"]]`,
  },
];

export function templateItems(t: Template): Item[] {
  const { items } = parseKle(t.kle);
  return [...items, ...(t.extras ?? []).map((e) => ({ ...e, id: newId() }))];
}

export function newSpec(name: string, items: Item[]): BuildSpec {
  const keys = items.filter((i) => i.kind === "key").length;
  return {
    version: 1,
    name,
    layout: { items },
    electronics: {
      mcu: keys <= 12 ? "rp2040-zero" : "rp2040-pro-micro",
      mcuPlace: null,
      switchFamily: "mx",
      switchId: "gateron-milky-yellow",
      hotswap: true,
    },
    keycaps: { profile: "cherry", legends: true, colorway: "classic" },
    pcb: { mask: "black", silk: "white", logo: null },
    case: { type: "printed", finish: "printed-black", outline: null },
  };
}

/** The keycap choice, reading builds saved before keycaps had their own step. */
export function capsOf(spec: BuildSpec): KeycapChoice {
  if (spec.keycaps) return spec.keycaps;
  const old = spec.electronics.keycaps;
  if (old === "none") return { profile: "none", legends: false, colorway: "classic" };
  return { profile: old?.includes("choc") ? "mbk" : "cherry", legends: !!old?.includes("legend"), colorway: "classic" };
}
