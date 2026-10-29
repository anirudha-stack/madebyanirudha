// The build spec: everything a customer chose, in one serialisable object.
// It is what the editor edits, what D1 stores, what the price is computed
// from, and what the generator modules will consume to produce the
// schematic, PCB and case files.

export type ItemKind = "key" | "encoder" | "oled";

/** One thing placed on the board grid. Units are keyboard units (1u = 19.05 mm). */
export interface Item {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export type SwitchFamily = "mx" | "choc";

/** Direction the MCU's USB-C port faces, in degrees: 0 = top edge, 90 = right. */
export type UsbDir = 0 | 90 | 180 | 270;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Outer case outline in board units, with its corner radius (u). */
export interface Outline extends Rect {
  r: number;
}

export interface McuPlace {
  x: number;
  y: number;
  rot: UsbDir;
}
export type CaseType = "printed" | "acrylic" | "cnc";

export interface KeycapChoice {
  /** Profile id from the catalog, or "none" to bring your own. */
  profile: string;
  legends: boolean;
  colorway: string;
}

export interface BuildSpec {
  version: 1;
  name: string;
  layout: { items: Item[] };
  electronics: {
    mcu: string;
    /** Where the controller sits; null = placed automatically. */
    mcuPlace?: McuPlace | null;
    switchFamily: SwitchFamily;
    switchId: string | null; // null = bring your own switches
    hotswap: boolean;
    /** Legacy (before keycaps got their own step); read through capsOf(). */
    keycaps?: string;
  };
  pcb: {
    mask: string;
    silk: "white" | "black";
    logo: { key: string; name: string } | null;
  };
  keycaps?: KeycapChoice;
  case: {
    type: CaseType;
    finish: string;
    /** Custom outline; null = hug the keys and controller. */
    outline?: Outline | null;
  };
}

export interface QuoteLine {
  id: string;
  label: string;
  detail: string;
  qty: number;
  unit: number; // INR, customer price per unit (markup applied)
  total: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  shipping: number;
  total: number;
}

export type OrderStatus =
  | "paid"
  | "files"
  | "fabrication"
  | "packing"
  | "shipped"
  | "delivered";

export interface Shipping {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export type JobState = "awaiting-module" | "queued" | "running" | "done" | "failed";

export interface GeneratorJob {
  generator: string;
  label: string;
  state: JobState;
  note: string;
  files: { name: string; key: string }[];
}

export interface BuildRecord {
  id: string;
  name: string;
  spec: BuildSpec;
  createdAt: number;
  updatedAt: number;
}

export interface OrderRecord {
  id: string;
  number: number;
  buildId: string | null;
  spec: BuildSpec;
  quote: Quote;
  shipping: Shipping;
  payment: { method: string; reference: string; simulated: true; paidAt: number };
  status: OrderStatus;
  generator: GeneratorJob[];
  createdAt: number;
  updatedAt: number;
}
