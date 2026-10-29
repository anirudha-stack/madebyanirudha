// Keyboard Layout Editor (keyboard-layout-editor.com) import and export.
//
// KLE's "raw data" is a list of rows; each row is a list of legends (strings)
// with property objects in between that apply to the next key (x/y offsets,
// w/h sizes) and, for some properties, to every key after it. Accepts the
// JSON from "Download JSON" or the looser raw-data text box (unquoted keys,
// no outer brackets).

import type { Item } from "./types";

type Row = (string | Record<string, unknown>)[];

export interface KleResult {
  items: Item[];
  name: string | null;
  warnings: string[];
}

let seq = 0;
export const newId = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Turn KLE raw-data text into strict JSON. */
function normalise(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    // Raw-data box: rows without outer brackets and unquoted property names.
    const quoted = t.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    try {
      return JSON.parse(quoted);
    } catch {
      return JSON.parse(`[${quoted}]`);
    }
  }
}

/** First non-empty legend line; KLE stacks up to 12 legend positions with "\n". */
const legend = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .find((l) => l.length > 0) ?? "";

export function parseKle(text: string): KleResult {
  let data = normalise(text);
  if (!Array.isArray(data)) throw new Error("Expected a list of rows.");
  // A single row pasted on its own: ["Copy","Paste"].
  if (data.some((r) => typeof r === "string")) data = [data];

  const warnings = new Set<string>();
  const items: Item[] = [];
  let name: string | null = null;
  let y = 0;

  for (const row of data as unknown[]) {
    if (!Array.isArray(row)) {
      if (row && typeof row === "object" && "name" in row) name = String((row as { name: unknown }).name);
      continue;
    }
    let x = 0;
    let w = 1;
    let h = 1;
    for (const cell of row as Row) {
      if (typeof cell === "string") {
        items.push({ id: newId(), kind: "key", x, y, w, h, label: legend(cell) });
        x += w;
        w = 1;
        h = 1;
        continue;
      }
      if (typeof cell.x === "number") x += cell.x;
      if (typeof cell.y === "number") y += cell.y;
      if (typeof cell.w === "number") w = cell.w;
      if (typeof cell.h === "number") h = cell.h;
      if ("r" in cell || "rx" in cell || "ry" in cell) warnings.add("Rotated keys were placed unrotated.");
      if ("w2" in cell || "h2" in cell) warnings.add("Stepped/ISO-enter keys were simplified to rectangles.");
      if (cell.d === true) warnings.add("Decal labels were imported as keys; delete them if unwanted.");
    }
    y += 1;
  }

  if (items.length === 0) throw new Error("No keys found in that layout.");
  return { items, name, warnings: [...warnings] };
}

/** Export keys back to KLE JSON (rows grouped by y). Encoders/OLEDs are omitted. */
export function toKle(items: Item[], name: string): string {
  const keys = items
    .filter((i) => i.kind === "key")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Row[] = [];
  let cy = 0;
  let row: Row | null = null;
  let cx = 0;
  let rowY = Number.NaN;
  for (const k of keys) {
    if (k.y !== rowY) {
      row = [];
      rows.push(row);
      const dy = k.y - cy;
      cx = 0;
      rowY = k.y;
      cy = k.y + 1;
      if (dy !== 0) row.push({ y: dy });
    }
    const props: Record<string, number> = {};
    if (k.x !== cx) props.x = k.x - cx;
    if (k.w !== 1) props.w = k.w;
    if (k.h !== 1) props.h = k.h;
    if (Object.keys(props).length) {
      // Merge into a preceding props object when it is the last cell.
      const last = row?.[row.length - 1];
      if (last && typeof last === "object") Object.assign(last, props);
      else row?.push(props);
    }
    row?.push(k.label);
    cx = k.x + k.w;
  }
  return JSON.stringify([{ name }, ...rows], null, 0);
}
