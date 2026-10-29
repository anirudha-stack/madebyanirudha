// The quote: every line of the kit with its customer price. The client shows
// it live; the Worker recomputes it from the frozen spec when an order is
// placed, so a tampered client total is never trusted.

import { caseSize, pcbSize, wiring } from "./board";
import {
  caseByType,
  DIODE_COST,
  ENCODER_COST,
  finishById,
  HARDWARE_COST,
  HOTSWAP_COST,
  capProfileById,
  colorwayById,
  LEGEND_COST,
  maskById,
  mcuById,
  OLED_COST,
  PACKING_COST,
  PCB_COST,
  price,
  SHIPPING_FLAT,
  switchById,
} from "./catalog";
import { capsOf } from "./templates";
import type { BuildSpec, Quote, QuoteLine } from "./types";

const line = (
  id: string,
  label: string,
  detail: string,
  qty: number,
  cost: number,
): QuoteLine => {
  const unit = price(cost);
  return { id, label, detail, qty, unit, total: unit * qty };
};

export function quote(spec: BuildSpec): Quote {
  const items = spec.layout.items;
  const keys = items.filter((i) => i.kind === "key");
  const e = spec.electronics;
  const w = wiring(spec);
  const lines: QuoteLine[] = [];

  const mcu = mcuById(e.mcu);
  if (mcu) lines.push(line("mcu", mcu.name, `${mcu.chip} · ${mcu.firmware}`, 1, mcu.cost));

  const sw = switchById(e.switchId);
  if (sw && keys.length > 0)
    lines.push(line("switches", sw.name, `${sw.feel}, ${sw.family.toUpperCase()}`, keys.length, sw.cost));

  if (e.hotswap && keys.length > 0)
    lines.push(
      line(
        "hotswap",
        "Hotswap sockets",
        `Kailh ${e.switchFamily === "mx" ? "MX" : "Choc"}: swap switches without solder`,
        keys.length,
        HOTSWAP_COST[e.switchFamily],
      ),
    );

  const choice = capsOf(spec);
  const prof = capProfileById(choice.profile);
  if (prof && keys.length > 0) {
    // Wide caps cost by width: a 6.25u spacebar is seven caps' worth.
    // Priced per cap as the set's average, so the pick list counts real caps.
    const units = keys.reduce((n, k) => n + Math.ceil(Math.max(k.w, k.h)), 0);
    const perU = prof.cost + (choice.legends ? LEGEND_COST : 0);
    const look = `${prof.name} profile PBT, ${colorwayById(choice.colorway).name}, ${choice.legends ? "dye-sub legends" : "blank"}`;
    lines.push(line("keycaps", "Keycaps", look, keys.length, (units * perU) / keys.length));
  }

  if (w.encoders > 0)
    lines.push(line("encoders", "Rotary encoders", "EC11 with push + aluminium knob", w.encoders, ENCODER_COST));
  if (w.oleds > 0) lines.push(line("oled", "OLED display", '0.91" 128×32, I²C', w.oleds, OLED_COST));
  if (w.diodes > 0) lines.push(line("diodes", "Diodes", "1N4148W, one per key", w.diodes, DIODE_COST));

  const pcb = pcbSize(spec);
  const area = (pcb.w * pcb.h) / 100;
  const mask = maskById(spec.pcb.mask);
  lines.push(
    line(
      "pcb",
      "Custom PCB",
      `${Math.round(pcb.w)} × ${Math.round(pcb.h)} mm, ${mask?.name ?? "Green"} mask${spec.pcb.logo ? ", your logo" : ""}`,
      1,
      PCB_COST.base + area * PCB_COST.perCm2 + PCB_COST.shipping + (mask?.cost ?? 0),
    ),
  );

  const c = caseByType(spec.case.type);
  if (c) {
    const cs = caseSize(spec);
    const cArea = (cs.w * cs.h) / 100;
    const finish = finishById(spec.case.finish);
    lines.push(
      line(
        "case",
        `${c.name} case`,
        `${Math.round(cs.w)} × ${Math.round(cs.h)} mm, ${finish?.name ?? ""}`,
        1,
        Math.max(c.min, cArea * c.perCm2),
      ),
    );
  }

  lines.push(line("hardware", "Hardware & cable", "4× M3 screws & standoffs, feet, USB-C cable", 1, HARDWARE_COST));
  lines.push(line("files", "Build files", "Schematic, PCB, case files, firmware", 1, 0));
  lines.push(line("packing", "Kit packing", "Sorted, labelled, boxed", 1, PACKING_COST));

  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  return { lines, subtotal, shipping: SHIPPING_FLAT, total: subtotal + SHIPPING_FLAT };
}

export const inr = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;
