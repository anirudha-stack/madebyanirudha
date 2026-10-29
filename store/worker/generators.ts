// The generator seam. Each module takes a frozen build spec and produces the
// files that ship with the kit. None are wired in yet: the schematic/PCB
// module comes from the partner company's API, and the case STL/DXF module
// needs a CAD runtime that cannot run inside a Worker. Until a module is
// registered here, its job sits in "awaiting-module" and the order still
// flows; the maker generates those files by hand from the spec.

import type { BuildSpec, GeneratorJob } from "../shared/types";

export interface GeneratorOutput {
  files: { name: string; contentType: string; body: ArrayBuffer | string }[];
  note?: string;
}

export interface Generator {
  id: string;
  label: string;
  /** Long-running modules should enqueue and return; this is the contract shape. */
  run(spec: BuildSpec, orderId: string): Promise<GeneratorOutput>;
}

/** Every artifact an order needs, in the order the maker uses them. */
export const ARTIFACTS: { id: string; label: string }[] = [
  { id: "schematic", label: "Schematic (KiCad)" },
  { id: "pcb", label: "PCB layout + Gerbers" },
  { id: "case", label: "Case (STL / DXF)" },
  { id: "firmware", label: "Firmware (QMK keymap)" },
];

/** Register real modules here as they arrive, keyed by artifact id. */
export const REGISTRY: Partial<Record<string, Generator>> = {};

export function initialJobs(): GeneratorJob[] {
  return ARTIFACTS.map((a) => ({
    generator: a.id,
    label: a.label,
    state: REGISTRY[a.id] ? "queued" : "awaiting-module",
    note: REGISTRY[a.id] ? "" : "Generator module not connected yet",
    files: [],
  }));
}
