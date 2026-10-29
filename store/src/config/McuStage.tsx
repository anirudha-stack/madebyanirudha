// The controller, two ways.
//
// McuManipulator lives inside the layout editor's SVG. Move: drag the
// module; it refuses to land on keys or mounting holes (it slides back to
// the last good spot), and released near a wall its USB-C end snaps flush so
// the port lines up with the cut-out. Rotate: drag the ring around it, the
// way Fusion 360's rotate manipulator works; the turn follows the pointer and
// snaps every 90°, with the angle read out on the ring.
//
// McuStage is the read-only electronics view: the board as its PCB, keycaps
// ghosted over the footprints, the controller where it sits, and air-wires to
// every pin it drives.

import { useMemo, useState } from "react";
import {
  airwires,
  clampInto,
  FINE,
  flushUsb,
  mcuFits,
  mcuRect,
  type Resolved,
  resolve,
  snap,
  usbGap,
} from "../../shared/board";
import { finishById } from "../../shared/catalog";
import type { BuildSpec, McuPlace, UsbDir } from "../../shared/types";
import { BoardDefs, KeyArt, McuArt, PALETTES, PcbArt, S, UsbMarker } from "../ui/Board";

/** Released within this distance of the edge, the port snaps flush. */
const SNAP_EDGE = 0.75;
/** Ring clearance beyond the module's corners (svg units). */
const RING_GAP = 26;

type Drag =
  | { kind: "move"; sx: number; sy: number; orig: McuPlace; live: McuPlace }
  | { kind: "turn"; a0: number; raw: number; orig: McuPlace; live: McuPlace };

const deg = (rad: number) => (rad * 180) / Math.PI;
const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360;

interface ManipulatorProps {
  spec: BuildSpec;
  res: Resolved;
  /** Pointer position in board units, from the host SVG. */
  toU: (e: React.PointerEvent) => { x: number; y: number };
  onPlace: (p: McuPlace) => void;
  /** Draw it but take no input (e.g. while the case is being resized). */
  locked?: boolean;
}

export function McuManipulator({ spec, res: base, toU, onPlace, locked }: ManipulatorProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [bounce, setBounce] = useState(false);

  const live = useMemo<Resolved>(
    () => (drag ? resolve({ ...spec, electronics: { ...spec.electronics, mcuPlace: drag.live } }) : base),
    [drag, spec, base],
  );

  const r0 = base.mcuRect;
  const center = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
  const valid = (p: McuPlace) => mcuFits(spec.layout.items, base.pcb, base.holes, mcuRect(base.mcu, p), p.rot);

  /** The module turned to `rot` about its own centre, kept on the board. */
  const turned = (rot: UsbDir): McuPlace => {
    const r = mcuRect(base.mcu, { x: 0, y: 0, rot });
    const c = clampInto({ ...r, x: center.x - r.w / 2, y: center.y - r.h / 2 }, base.pcb);
    return { x: c.x, y: c.y, rot };
  };

  const grab = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const startMove = (e: React.PointerEvent) => {
    grab(e);
    const p = toU(e);
    setDrag({ kind: "move", sx: p.x, sy: p.y, orig: base.place, live: base.place });
  };

  const startTurn = (e: React.PointerEvent) => {
    grab(e);
    const p = toU(e);
    const a0 = deg(Math.atan2(p.y - center.y, p.x - center.x));
    setDrag({ kind: "turn", a0, raw: base.place.rot, orig: base.place, live: base.place });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    e.stopPropagation();
    const p = toU(e);
    if (drag.kind === "move") {
      const r = mcuRect(base.mcu, {
        ...drag.orig,
        x: snap(drag.orig.x + p.x - drag.sx, FINE),
        y: snap(drag.orig.y + p.y - drag.sy, FINE),
      });
      const c = clampInto(r, base.pcb);
      setDrag({ ...drag, live: { ...drag.orig, x: c.x, y: c.y } });
    } else {
      // Screen y grows downward, so atan2 turns clockwise, the same way as rot.
      const a = deg(Math.atan2(p.y - center.y, p.x - center.x));
      const raw = drag.orig.rot + ((a - drag.a0 + 540) % 360) - 180;
      const rot = norm(Math.round(raw / 90) * 90) as UsbDir;
      setDrag({ ...drag, raw, live: turned(rot) });
    }
  };

  const up = (e: React.PointerEvent) => {
    if (!drag) return;
    e.stopPropagation();
    let next = drag.live;
    const r = mcuRect(base.mcu, next);
    // After a turn, slide toward the wall the port now faces if the way is clear.
    if (drag.kind === "turn" || usbGap(r, next.rot, base.pcb) < SNAP_EDGE) {
      const flush = flushUsb(base.mcu, next, base.pcb);
      if (valid(flush)) next = flush;
    }
    const changed = next.x !== drag.orig.x || next.y !== drag.orig.y || next.rot !== drag.orig.rot;
    if (valid(next)) {
      if (changed) onPlace(next);
    } else if (changed) {
      // Refuse to sit on keyholes or mounting holes: go back.
      setBounce(true);
      setTimeout(() => setBounce(false), 320);
    }
    setDrag(null);
  };

  const clash = drag ? !valid(drag.live) : base.mcuClash.size > 0 || base.mcuOutside;

  // The ring circles the module at its centre (fixed while turning).
  const ringC = { x: center.x * S, y: center.y * S };
  const ringR = (Math.hypot(r0.w, r0.h) / 2) * S + RING_GAP;
  const turning = drag?.kind === "turn";
  const shown = turning ? drag.raw : base.place.rot;
  // Knob on the ring where the USB-C end points (0° = up).
  const knobA = ((shown - 90) * Math.PI) / 180;
  const knob = { x: ringC.x + Math.cos(knobA) * ringR, y: ringC.y + Math.sin(knobA) * ringR };
  const arc = (from: number, to: number) => {
    const a = ((from - 90) * Math.PI) / 180;
    const b = ((to - 90) * Math.PI) / 180;
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    const sweep = to > from ? 1 : 0;
    return `M${ringC.x + Math.cos(a) * ringR} ${ringC.y + Math.sin(a) * ringR} A${ringR} ${ringR} 0 ${large} ${sweep} ${ringC.x + Math.cos(b) * ringR} ${ringC.y + Math.sin(b) * ringR}`;
  };

  const handlers = locked ? {} : { onPointerMove: move, onPointerUp: up, onPointerCancel: up };

  return (
    <g className={locked ? "mcu-locked" : ""}>
      {!locked && (
        <g className={`turn-ring ${turning ? "active" : ""}`} onPointerDown={startTurn} {...handlers}>
          <circle cx={ringC.x} cy={ringC.y} r={ringR} className="turn-hit" />
          <circle cx={ringC.x} cy={ringC.y} r={ringR} className="turn-track" />
          {[0, 90, 180, 270].map((t) => {
            const a = ((t - 90) * Math.PI) / 180;
            return (
              <line
                key={t}
                className="turn-tick"
                x1={ringC.x + Math.cos(a) * (ringR - 8)}
                y1={ringC.y + Math.sin(a) * (ringR - 8)}
                x2={ringC.x + Math.cos(a) * (ringR + 8)}
                y2={ringC.y + Math.sin(a) * (ringR + 8)}
              />
            );
          })}
          {turning && Math.abs(drag.raw - drag.orig.rot) > 1 && <path className="turn-arc" d={arc(drag.orig.rot, drag.raw)} />}
          <circle cx={knob.x} cy={knob.y} r={11} className="turn-knob" />
          {turning && (
            <g transform={`translate(${knob.x} ${knob.y - 34})`} pointerEvents="none">
              <rect x={-40} y={-17} width={80} height={32} rx={16} className="turn-readout-bg" />
              <text y={6} textAnchor="middle" className="turn-readout">
                {norm(drag.live.rot)}°
              </text>
            </g>
          )}
        </g>
      )}

      <g
        className={`mcu-handle ${drag?.kind === "move" ? "dragging" : ""} ${bounce ? "bounce" : ""}`}
        onPointerDown={locked ? undefined : startMove}
        {...handlers}
      >
        <McuArt res={live} bodies state={clash ? "bad" : "ok"} />
      </g>

      {drag && <UsbMarker res={live} uid="editor" highlight />}
    </g>
  );
}

/** Read-only PCB view for the electronics step. */
export function McuStage({ spec }: { spec: BuildSpec }) {
  const res = useMemo(() => resolve(spec), [spec]);
  const wires = useMemo(() => airwires(spec, res), [spec, res]);

  const o = res.outline;
  const pad = 1.3;
  const vw = Math.max(o.w + pad * 2, 11);
  const vh = Math.max(o.h + pad * 2 + 0.6, 7);
  const vx = o.x + o.w / 2 - vw / 2;
  const vy = o.y + o.h / 2 - vh / 2;
  const lr = res.mcuRect;
  const mc = { x: (lr.x + lr.w / 2) * S, y: (lr.y + lr.h / 2) * S };
  const finish = finishById(spec.case.finish);
  const rx = Math.min(o.r, o.w / 2, o.h / 2) * S;
  const clash = res.mcuClash.size > 0 || res.mcuOutside;

  return (
    <svg
      className="editor-svg"
      viewBox={`${vx * S} ${vy * S} ${vw * S} ${vh * S}`}
      role="img"
      aria-label={`PCB view. ${res.mcu.name} with its USB-C port facing the ${["top", "right", "bottom", "left"][res.place.rot / 90]} edge.`}
    >
      <BoardDefs uid="mcu" />
      <rect x={o.x * S} y={o.y * S} width={o.w * S} height={o.h * S} rx={rx} fill={finish?.hex ?? "#232326"} opacity={0.22} />
      <rect className="case-line" x={o.x * S} y={o.y * S} width={o.w * S} height={o.h * S} rx={rx} />
      <PcbArt spec={spec} res={res} bodies={false} mcu={false} />

      <g opacity={0.3}>
        {spec.layout.items.map((it) => (
          <g key={it.id} transform={`translate(${it.x * S} ${it.y * S})`}>
            <KeyArt item={it} palette={PALETTES.blank} legends={false} />
          </g>
        ))}
      </g>

      {wires.map((w, i) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: wires have no identity beyond order
          key={i}
          className={`airwire airwire-${w.kind}`}
          x1={mc.x}
          y1={mc.y}
          x2={w.x * S}
          y2={w.y * S}
        />
      ))}

      <McuArt res={res} bodies state={clash ? "bad" : "ok"} />
      <UsbMarker res={res} uid="mcu" highlight />
    </svg>
  );
}
