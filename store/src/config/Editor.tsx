// The layout editor: keys on a 0.25u grid inside the case outline. Dragging
// lifts a key off the board and follows the pointer freely while a dashed
// ghost shows where it will land; on release it drops into the ghost and
// settles with a small overshoot. The case outline has handles on every edge
// and corner; it can grow past the keys (room for a logo, a screen, a bigger
// palm area) up to the size limit, but never shrink onto them.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bounds,
  clampOutline,
  FINE,
  grow,
  HOLE,
  holesFor,
  minOutline,
  mm,
  overlaps,
  type Resolved,
  snap,
  U_MM,
} from "../../shared/board";
import type { BuildSpec, Item, McuPlace, Outline } from "../../shared/types";
import { BoardDefs, KeyArt, PALETTES, S } from "../ui/Board";
import { McuManipulator } from "./McuStage";

/** Offset of a dimension line from the edge it measures (u). */
const DIM_OFF = 0.6;
const TICK = 9;

/**
 * A CAD-style dimension: extension lines off the edge, a measured line with
 * arrowheads, and the length in mm set in the middle of it.
 */
function Dimension({
  from,
  to,
  side,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  side: "below" | "left";
}) {
  const below = side === "below";
  const len = below ? to.x - from.x : to.y - from.y;
  const off = DIM_OFF * S * (below ? 1 : -1);
  const a = { x: from.x * S + (below ? 0 : off), y: from.y * S + (below ? off : 0) };
  const b = { x: to.x * S + (below ? 0 : off), y: to.y * S + (below ? off : 0) };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const label = `${Math.round(mm(len))} mm`;
  const arrow = (p: { x: number; y: number }, dir: 1 | -1) =>
    below
      ? `M${p.x} ${p.y} l${dir * TICK * 1.6} ${-TICK / 2} v${TICK} z`
      : `M${p.x} ${p.y} l${-TICK / 2} ${dir * TICK * 1.6} h${TICK} z`;
  return (
    <g className="dim">
      <line className="dim-ext" x1={from.x * S} y1={from.y * S} x2={a.x + (below ? 0 : -10)} y2={a.y + (below ? 10 : 0)} />
      <line className="dim-ext" x1={to.x * S} y1={to.y * S} x2={b.x + (below ? 0 : -10)} y2={b.y + (below ? 10 : 0)} />
      <line className="dim-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <path className="dim-arrow" d={arrow(a, 1)} />
      <path className="dim-arrow" d={arrow(b, -1)} />
      <g transform={`translate(${mid.x} ${mid.y})${below ? "" : " rotate(-90)"}`}>
        <rect className="dim-bg" x={-58} y={-17} width={116} height={34} rx={8} />
        <text className="dim-text" y={8} textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
}

interface Props {
  spec: BuildSpec;
  items: Item[];
  res: Resolved;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  /** Commit a finished edit (adds an undo step). */
  onCommit: (items: Item[]) => void;
  onOutline: (o: Outline) => void;
  onPlace: (p: McuPlace) => void;
}

interface Drag {
  ids: string[];
  sx: number;
  sy: number;
  orig: Map<string, { x: number; y: number }>;
  dx: number;
  dy: number;
  moved: boolean;
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<Handle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

interface Resize {
  handle: Handle;
  sx: number;
  sy: number;
  start: Outline;
  live: Outline;
}

const MIN_VIEW = { w: 10, h: 6 };
const VIEW_PAD = 1.6;

function viewFor(o: Outline) {
  const w = Math.max(MIN_VIEW.w, o.w + VIEW_PAD * 2);
  const h = Math.max(MIN_VIEW.h, o.h + VIEW_PAD * 2);
  return { x: o.x + o.w / 2 - w / 2, y: o.y + o.h / 2 - h / 2, w, h };
}

function handlePoint(o: Outline, h: Handle) {
  const x = h.includes("w") ? o.x : h.includes("e") ? o.x + o.w : o.x + o.w / 2;
  const y = h.includes("n") ? o.y : h.includes("s") ? o.y + o.h : o.y + o.h / 2;
  return { x, y };
}

export function Editor({ spec, items, res, selected, onSelect, onCommit, onOutline, onPlace }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const frozenView = useRef<ReturnType<typeof viewFor> | null>(null);

  const outline = resize?.live ?? res.outline;
  const liveView = useMemo(() => viewFor(res.outline), [res.outline]);
  const view = drag || marquee || resize ? (frozenView.current ?? liveView) : liveView;
  const bad = useMemo(() => overlaps(items), [items]);
  const minO = useMemo(() => minOutline(items, res.mcuRect, res.outline.r), [items, res.mcuRect, res.outline.r]);

  useEffect(() => {
    if (settling.size === 0) return;
    const t = setTimeout(() => setSettling(new Set()), 220);
    return () => clearTimeout(t);
  }, [settling]);

  const toU = (e: React.PointerEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x / S, y: p.y / S };
  };

  const startItem = (e: React.PointerEvent, it: Item) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    let sel = selected;
    if (e.shiftKey) {
      sel = new Set(selected);
      if (sel.has(it.id)) sel.delete(it.id);
      else sel.add(it.id);
      onSelect(sel);
      if (!sel.has(it.id)) return;
    } else if (!selected.has(it.id)) {
      sel = new Set([it.id]);
      onSelect(sel);
    }
    const p = toU(e);
    frozenView.current = liveView;
    const orig = new Map(items.filter((i) => sel.has(i.id)).map((i) => [i.id, { x: i.x, y: i.y }]));
    setDrag({ ids: [...orig.keys()], sx: p.x, sy: p.y, orig, dx: 0, dy: 0, moved: false });
  };

  const startHandle = (e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toU(e);
    frozenView.current = liveView;
    setResize({ handle, sx: p.x, sy: p.y, start: res.outline, live: res.outline });
  };

  const startCanvas = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toU(e);
    frozenView.current = liveView;
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey });
    if (!e.shiftKey) onSelect(new Set());
  };

  const move = (e: React.PointerEvent) => {
    if (drag) {
      const p = toU(e);
      const dx = p.x - drag.sx;
      const dy = p.y - drag.sy;
      setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > 0.08 });
    } else if (resize) {
      const p = toU(e);
      const dx = snap(p.x - resize.sx, FINE);
      const dy = snap(p.y - resize.sy, FINE);
      const s = resize.start;
      let { x, y, w, h } = s;
      if (resize.handle.includes("w")) {
        x = s.x + dx;
        w = s.w - dx;
      }
      if (resize.handle.includes("e")) w = s.w + dx;
      if (resize.handle.includes("n")) {
        y = s.y + dy;
        h = s.h - dy;
      }
      if (resize.handle.includes("s")) h = s.h + dy;
      setResize({ ...resize, live: clampOutline({ x, y, w: Math.max(w, 0), h: Math.max(h, 0), r: s.r }, minO) });
    } else if (marquee) {
      const p = toU(e);
      setMarquee({ ...marquee, x1: p.x, y1: p.y });
    }
  };

  const end = () => {
    if (drag) {
      const sdx = snap(drag.dx);
      const sdy = snap(drag.dy);
      if (drag.moved && (sdx !== 0 || sdy !== 0)) {
        onCommit(
          items.map((i) => {
            const o = drag.orig.get(i.id);
            return o ? { ...i, x: o.x + sdx, y: o.y + sdy } : i;
          }),
        );
      }
      if (drag.moved) setSettling(new Set(drag.ids));
      setDrag(null);
    }
    if (resize) {
      const a = resize.live;
      const b = resize.start;
      if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h) onOutline(a);
      setResize(null);
    }
    if (marquee) {
      const x0 = Math.min(marquee.x0, marquee.x1);
      const x1 = Math.max(marquee.x0, marquee.x1);
      const y0 = Math.min(marquee.y0, marquee.y1);
      const y1 = Math.max(marquee.y0, marquee.y1);
      if (x1 - x0 > 0.1 || y1 - y0 > 0.1) {
        const hit = items.filter((i) => i.x < x1 && i.x + i.w > x0 && i.y < y1 && i.y + i.h > y0);
        const next = new Set(marquee.additive ? selected : []);
        for (const i of hit) next.add(i.id);
        onSelect(next);
      }
      setMarquee(null);
    }
    frozenView.current = null;
  };

  // Drawn far past the viewBox: the stage is wider than the view's aspect.
  const gridLines = [];
  const GX = 24;
  const gx0 = Math.floor(view.x) - GX;
  const gx1 = Math.ceil(view.x + view.w) + GX;
  const gy0 = Math.floor(view.y) - GX;
  const gy1 = Math.ceil(view.y + view.h) + GX;
  for (let x = gx0; x <= gx1; x++)
    gridLines.push(<line key={`x${x}`} className="grid-line" x1={x * S} y1={gy0 * S} x2={x * S} y2={gy1 * S} />);
  for (let y = gy0; y <= gy1; y++)
    gridLines.push(<line key={`y${y}`} className="grid-line" x1={gx0 * S} y1={y * S} x2={gx1 * S} y2={y * S} />);

  const pos = (it: Item) => {
    const o = drag?.orig.get(it.id);
    if (!o || !drag?.moved) return { x: it.x, y: it.y };
    return { x: o.x + drag.dx, y: o.y + drag.dy };
  };

  const lifting = !!drag?.moved;
  const resting = lifting ? items.filter((i) => !drag?.orig.has(i.id)) : items;
  const lifted = lifting ? items.filter((i) => drag?.orig.has(i.id)) : [];
  const pcb = grow(outline, -(res.pcb.x - res.outline.x));
  const rx = Math.min(outline.r, outline.w / 2, outline.h / 2) * S;
  const keysB = items.length ? bounds(items) : null;

  const renderItem = (it: Item) => {
    const p = pos(it);
    const isLifted = lifting && !!drag?.orig.has(it.id);
    const wrong = !isLifted && (bad.has(it.id) || res.outside.has(it.id) || res.mcuClash.has(it.id));
    const cls = `item ${isLifted ? "lifted" : ""} ${settling.has(it.id) ? "settle" : ""}`;
    return (
      <g key={it.id} className={cls} transform={`translate(${p.x * S} ${p.y * S})`} onPointerDown={(e) => startItem(e, it)}>
        <g className="item-body">
          <KeyArt item={it} palette={PALETTES.legend} legends />
        </g>
        {wrong && (
          <g pointerEvents="none">
            <rect className="item-bad" x={2} y={2} width={it.w * S - 4} height={it.h * S - 4} rx={11} />
            <line className="item-bad-strike" x1={10} y1={it.h * S - 10} x2={it.w * S - 10} y2={10} />
          </g>
        )}
        {selected.has(it.id) && (
          <rect className="item-select" x={-1} y={-1} width={it.w * S + 2} height={it.h * S + 2} rx={13} pointerEvents="none" />
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svg}
      className={`editor-svg ${drag?.moved ? "dragging" : ""}`}
      viewBox={`${view.x * S} ${view.y * S} ${view.w * S} ${view.h * S}`}
      onPointerDown={startCanvas}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="Keyboard layout editor. Arrow keys move the selection; drag the case handles to reshape it."
    >
      <BoardDefs uid="editor" />
      <g>{gridLines}</g>

      {/* Case outline and the PCB edge inside its walls. */}
      <g pointerEvents="none">
        <rect className="case-fill" x={outline.x * S} y={outline.y * S} width={outline.w * S} height={outline.h * S} rx={rx} />
        <rect
          className="pcb-guide"
          x={pcb.x * S}
          y={pcb.y * S}
          width={pcb.w * S}
          height={pcb.h * S}
          rx={Math.max(4, rx - (pcb.x - outline.x) * S)}
        />
        <rect className="case-line" x={outline.x * S} y={outline.y * S} width={outline.w * S} height={outline.h * S} rx={rx} />
        <Dimension from={{ x: outline.x, y: outline.y + outline.h }} to={{ x: outline.x + outline.w, y: outline.y + outline.h }} side="below" />
        <Dimension from={{ x: outline.x, y: outline.y }} to={{ x: outline.x, y: outline.y + outline.h }} side="left" />
      </g>

      {/* M3 mounting holes in the PCB corners. */}
      <g pointerEvents="none">
        {(resize ? holesFor(outline).map((h) => ({ ...h, clash: false })) : res.holes).map((h, i) => (
          <g key={`${h.x}-${h.y}`} className={`hole ${h.clash ? "hole-bad" : ""}`}>
            <circle cx={h.x * S} cy={h.y * S} r={(HOLE.pad / 2 / U_MM) * S} className="hole-pad" />
            <circle cx={h.x * S} cy={h.y * S} r={(HOLE.drill / 2 / U_MM) * S} className="hole-drill" />
            {i === 0 && (
              <text x={h.x * S + 22} y={h.y * S + 7} className="hole-label">
                M3
              </text>
            )}
          </g>
        ))}
      </g>

      {resting.map(renderItem)}

      {/* The controller: drag to move, ring to turn. Visible but still while the case resizes. */}
      <McuManipulator spec={spec} res={res} toU={toU} onPlace={onPlace} locked={!!resize || lifting} />

      {drag?.moved &&
        drag.ids.map((id) => {
          const it = items.find((i) => i.id === id);
          const o = drag.orig.get(id);
          if (!it || !o) return null;
          return (
            <rect
              key={`ghost-${id}`}
              className="ghost"
              x={(o.x + snap(drag.dx)) * S + 3}
              y={(o.y + snap(drag.dy)) * S + 3}
              width={it.w * S - 6}
              height={it.h * S - 6}
              rx={11}
            />
          );
        })}

      {lifted.map(renderItem)}

      {!lifting &&
        HANDLES.map((h) => {
          const p = handlePoint(outline, h);
          const corner = h.length === 2;
          return (
            <g key={h} className={`case-handle ${resize?.handle === h ? "active" : ""}`} style={{ cursor: CURSORS[h] }} onPointerDown={(e) => startHandle(e, h)}>
              <circle cx={p.x * S} cy={p.y * S} r={26} fill="transparent" />
              {corner ? (
                <circle cx={p.x * S} cy={p.y * S} r={9} />
              ) : (
                <rect
                  x={p.x * S - (h === "n" || h === "s" ? 18 : 6)}
                  y={p.y * S - (h === "n" || h === "s" ? 6 : 18)}
                  width={h === "n" || h === "s" ? 36 : 12}
                  height={h === "n" || h === "s" ? 12 : 36}
                  rx={6}
                />
              )}
            </g>
          );
        })}

      {keysB && resize && (
        <rect
          className="min-guide"
          x={minO.x * S}
          y={minO.y * S}
          width={minO.w * S}
          height={minO.h * S}
          rx={8}
          pointerEvents="none"
        />
      )}

      {marquee && (
        <rect
          className="marquee"
          x={Math.min(marquee.x0, marquee.x1) * S}
          y={Math.min(marquee.y0, marquee.y1) * S}
          width={Math.abs(marquee.x1 - marquee.x0) * S}
          height={Math.abs(marquee.y1 - marquee.y0) * S}
        />
      )}
    </svg>
  );
}
