// The right-hand rail for each step: the options, grouped, with each
// choice's price beside it.

import { AlertTriangle, ChevronDown, CircleDot, Info, Monitor, Plus, Square, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { WiringReport } from "../../shared/board";
import {
  CASE_LIMIT,
  clampOutline,
  minOutline,
  mm,
  pcbSize,
  RADII_MM,
  type Resolved,
  U_MM,
  wiring as wiringFor,
} from "../../shared/board";
import {
  CASES,
  ENCODER_COST,
  HOTSWAP_COST,
  capProfileById,
  COLORWAYS,
  KEYCAP_PROFILES,
  LEGEND_COST,
  MASKS,
  MCUS,
  OLED_COST,
  price,
  SWITCHES,
  switchById,
} from "../../shared/catalog";
import { parseKle, toKle } from "../../shared/kle";
import { inr } from "../../shared/pricing";
import { capsOf, TEMPLATES, templateItems } from "../../shared/templates";
import type { BuildSpec, Item, ItemKind, McuPlace, Outline, Quote, SwitchFamily, UsbDir } from "../../shared/types";
import { api, fileUrl } from "../api";
import type { StepId } from "./Configurator";

interface RailProps {
  spec: BuildSpec;
  update: (fn: (s: BuildSpec) => BuildSpec) => void;
  quote: Quote;
  wiring: WiringReport;
  blockers: string[];
  id: string;
  res: Resolved;
}

const WIDTHS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25];
const HEIGHTS = [1, 2];

function WiringFacts({ wiring }: { wiring: WiringReport }) {
  const w = wiring.wiring;
  return (
    <div className="facts">
      <div className="fact">
        <span>Wiring</span>
        <b>{w.kind === "direct" ? "Direct, no diodes" : w.kind === "matrix" ? `${w.rows} × ${w.cols} matrix` : "Doesn't fit"}</b>
      </div>
      <div className="fact">
        <span>MCU pins used</span>
        <b className="num">
          {w.pins + wiring.extraPins} / {wiring.available + wiring.extraPins}
        </b>
      </div>
    </div>
  );
}

function Blockers({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <div className="notice notice-bad" role="status">
      <AlertTriangle size={15} />
      <div>
        {list.map((b) => (
          <div key={b}>{b}</div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Layout */

export function LayoutRail({
  spec,
  update,
  wiring,
  selected,
  setSelected,
  commitItems,
  setOutline,
  setPlace,
  res,
  add,
  duplicate,
  remove,
  overlapCount,
}: RailProps & {
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  commitItems: (items: Item[]) => void;
  setOutline: (o: Outline | null) => void;
  setPlace: (p: McuPlace | null) => void;
  add: (k: ItemKind) => void;
  duplicate: () => void;
  remove: () => void;
  overlapCount: number;
}) {
  const items = spec.layout.items;
  const sel = items.filter((i) => selected.has(i.id));
  const one = sel.length === 1 ? sel[0] : null;
  const [replacing, setReplacing] = useState<string | null>(null);
  const [kle, setKle] = useState("");
  const [kleMsg, setKleMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hasOled = items.some((i) => i.kind === "oled");

  const patchSel = (patch: Partial<Item>) =>
    commitItems(items.map((i) => (selected.has(i.id) && i.kind === "key" ? { ...i, ...patch } : i)));

  const replaceWith = (next: Item[], name?: string) => {
    commitItems(next);
    setSelected(new Set());
    if (name) update((s) => ({ ...s, name }));
  };

  const importKle = () => {
    try {
      const r = parseKle(kle);
      replaceWith(r.items, r.name ?? undefined);
      setKleMsg({
        ok: true,
        text: `Imported ${r.items.length} keys.${r.warnings.length ? ` ${r.warnings.join(" ")}` : ""}`,
      });
      setKle("");
    } catch (e) {
      setKleMsg({ ok: false, text: `Couldn't read that layout: ${e instanceof Error ? e.message : "unknown format"}` });
    }
  };

  const exportKle = async () => {
    await navigator.clipboard.writeText(toKle(items, spec.name));
    setKleMsg({ ok: true, text: "KLE JSON copied. Paste it into keyboard-layout-editor.com → Raw data." });
  };

  return (
    <>
      <div className="rail-head">
        <h1>Arrange your keys</h1>
        <p>Drag to move. Everything snaps to a quarter unit, the way real plates are cut.</p>
      </div>

      {sel.length > 0 ? (
        <section className="group" aria-label="Selection">
          <div className="group-title">
            {one ? (one.kind === "key" ? "Selected key" : one.kind === "encoder" ? "Rotary encoder" : "OLED screen") : `${sel.length} selected`}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
          {one?.kind === "key" && (
            <div className="field">
              <label htmlFor="key-label">Legend</label>
              <input
                id="key-label"
                className="input"
                value={one.label}
                maxLength={16}
                placeholder="e.g. Ctrl+C"
                onChange={(e) => commitItems(items.map((i) => (i.id === one.id ? { ...i, label: e.target.value } : i)))}
              />
            </div>
          )}
          {sel.some((i) => i.kind === "key") && (
            <>
              <div className="label">Width</div>
              <div className="chips" role="group" aria-label="Key width">
                {WIDTHS.map((w) => (
                  <button
                    type="button"
                    key={w}
                    className="chip"
                    aria-pressed={sel.every((i) => i.kind !== "key" || i.w === w)}
                    onClick={() => patchSel({ w })}
                  >
                    {w}u
                  </button>
                ))}
              </div>
              <div className="label">Height</div>
              <div className="chips" role="group" aria-label="Key height">
                {HEIGHTS.map((h) => (
                  <button
                    type="button"
                    key={h}
                    className="chip"
                    aria-pressed={sel.every((i) => i.kind !== "key" || i.h === h)}
                    onClick={() => patchSel({ h })}
                  >
                    {h}u
                  </button>
                ))}
              </div>
            </>
          )}
          {one && one.kind !== "key" && (
            <p className="muted" style={{ fontSize: 13 }}>
              {one.kind === "encoder"
                ? `EC11 with push. Turns for volume or scroll, presses as a key. ${inr(price(ENCODER_COST))}.`
                : `0.91" 128×32 screen for layer, caps-lock or a logo. ${inr(price(OLED_COST))}.`}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={duplicate}>
              Duplicate
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={remove}>
              Delete
            </button>
          </div>
        </section>
      ) : null}

      <section className="group" aria-label="Add to the board">
        <div className="group-title">Add</div>
        <div className="tiles">
          <button type="button" className="tile" onClick={() => add("key")}>
            <div className="tile-row">
              <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Square size={16} /> Key
              </span>
              <Plus size={16} />
            </div>
          </button>
          <button type="button" className="tile" onClick={() => add("encoder")}>
            <div className="tile-row">
              <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <CircleDot size={16} /> Rotary knob
              </span>
              <span className="tile-price">+{inr(price(ENCODER_COST))}</span>
            </div>
          </button>
          <button type="button" className="tile" onClick={() => add("oled")} disabled={hasOled}>
            <div className="tile-row">
              <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Monitor size={16} /> OLED screen
              </span>
              <span className="tile-price">{hasOled ? "One per board" : `+${inr(price(OLED_COST))}`}</span>
            </div>
          </button>
        </div>
      </section>

      <section className="group" aria-label="Case shape">
        <div className="group-title">
          Case shape
          <span className="muted num">
            {Math.round(mm(res.outline.w))} × {Math.round(mm(res.outline.h))} mm
          </span>
        </div>
        <p className="tile-sub">
          Drag the handles on the outline to make room for a logo, a wider palm rest or the controller. Up to{" "}
          {Math.round(mm(CASE_LIMIT.w))} × {Math.round(mm(CASE_LIMIT.h))} mm.
        </p>
        <div className="segmented" role="radiogroup" aria-label="Case size">
          <button type="button" role="radio" aria-checked={res.autoOutline} onClick={() => setOutline(null)}>
            Hug the keys
          </button>
          <button type="button" role="radio" aria-checked={!res.autoOutline} onClick={() => setOutline({ ...res.outline })}>
            Custom
          </button>
        </div>
        <div className="label">Corner radius</div>
        <div className="chips" role="group" aria-label="Corner radius">
          {RADII_MM.map((r) => (
            <button
              type="button"
              key={r}
              className="chip"
              aria-pressed={Math.abs(res.outline.r * U_MM - r) < 0.5}
              // A rounder corner pushes the holes inward: grow the case if the keys need it.
              onClick={() => setOutline(clampOutline({ ...res.outline, r: r / U_MM }, minOutline(items, res.mcuRect, r / U_MM)))}
            >
              {r === 0 ? "Square" : `${r} mm`}
            </button>
          ))}
        </div>
        {res.outside.size > 0 && (
          <div className="notice notice-bad">
            <AlertTriangle size={15} />
            <span>
              {res.outside.size} items stick out of the case.{" "}
              <button type="button" className="btn btn-ghost btn-sm inline-link" onClick={() => setOutline(null)}>
                Fit the case to the keys
              </button>
            </span>
          </div>
        )}
      </section>

      <ControllerPlacement res={res} setPlace={setPlace} />

      <section className="group" aria-label="Board">
        <div className="group-title">Board</div>
        <WiringFacts wiring={wiring} />
        {res.mcuClash.size > 0 && (
          <div className="notice notice-bad">
            <AlertTriangle size={15} /> Keys sit on the controller. Move them or the controller.
          </div>
        )}
        {overlapCount > 0 && (
          <div className="notice notice-bad">
            <AlertTriangle size={15} /> {overlapCount} items overlap. They're struck through in red.
          </div>
        )}
        {wiring.wiring.kind === "too-many" && (
          <div className="notice notice-bad">
            <AlertTriangle size={15} /> Too many keys for {wiring.available} free pins. Pick a bigger MCU on the next step, or remove keys.
          </div>
        )}
      </section>

      <details className="disclosure">
        <summary>
          Start from a template <ChevronDown size={16} />
        </summary>
        <div className="tiles">
          {TEMPLATES.map((t) => (
            <button
              type="button"
              key={t.id}
              className="tile"
              aria-pressed={replacing === t.id}
              onClick={() => {
                if (items.length === 0 || replacing === t.id) {
                  replaceWith(templateItems(t), t.name);
                  setReplacing(null);
                } else setReplacing(t.id);
              }}
            >
              <div className="tile-row">
                <span className="tile-name">{t.name}</span>
                {replacing === t.id && <span className="tag">Click again to replace</span>}
              </div>
              <span className="tile-sub">{t.blurb}</span>
            </button>
          ))}
        </div>
      </details>

      <details className="disclosure">
        <summary>
          Import or export KLE <ChevronDown size={16} />
        </summary>
        <div className="group">
          <textarea
            className="textarea"
            value={kle}
            onChange={(e) => setKle(e.target.value)}
            placeholder={'Paste raw data from keyboard-layout-editor.com\n["Esc","F1","F2"],\n[{w:1.5},"Tab","Q"]'}
            aria-label="KLE raw data"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={importKle} disabled={!kle.trim()}>
              Replace layout with this
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={exportKle} disabled={!items.length}>
              Copy as KLE
            </button>
          </div>
          {kleMsg && <p className={kleMsg.ok ? "muted" : "error-text"} style={{ fontSize: 13 }}>{kleMsg.text}</p>}
        </div>
      </details>

      <details className="disclosure">
        <summary>
          Shortcuts <ChevronDown size={16} />
        </summary>
        <div className="shortcuts">
          <span className="kbd">Shift</span> <span>+ click to select several, or drag a box</span>
          <span className="kbd">←→</span> <span>Nudge ¼u, with Shift 1u</span>
          <span className="kbd">Del</span> <span>Delete selection</span>
          <span className="kbd">Ctrl D</span> <span>Duplicate</span>
          <span className="kbd">Ctrl Z</span> <span>Undo (Shift to redo)</span>
          <span className="kbd">Ctrl A</span> <span>Select everything</span>
        </div>
      </details>
    </>
  );
}

/** Where the controller sits and whether its USB-C reaches the wall. */
function ControllerPlacement({
  res,
  setPlace,
  goLayout,
}: {
  res: Resolved;
  setPlace: (p: McuPlace | null) => void;
  /** Present on read-only steps: link back to where it can be moved. */
  goLayout?: () => void;
}) {
  return (
    <section className="group" aria-label="Controller placement">
      <div className="group-title">
        {goLayout ? "Where it sits" : "Controller"}
        <span className="muted num">
          {res.mcu.mm.w} × {res.mcu.mm.h} mm
        </span>
      </div>
      {goLayout ? (
        <p className="tile-sub">
          Shown where it sits, with a wire to every pin it drives. Move or turn it on the{" "}
          <button type="button" className="btn btn-ghost btn-sm inline-link" onClick={goLayout}>
            Layout
          </button>{" "}
          step.
        </p>
      ) : (
        <p className="tile-sub">
          Drag the {res.mcu.name} to move it; drag the ring around it to turn it in 90° steps. The USB-C end goes wherever it
          points. It can't sit on keys or mounting holes, and near a wall it snaps flush.
        </p>
      )}
      {res.mcuClash.size > 0 || res.mcuOutside ? (
        <div className="notice notice-bad">
          <AlertTriangle size={15} /> The controller overlaps keys. Move it to free space, or grow the case.
        </div>
      ) : res.usb.gap > 0.02 ? (
        <div className="notice notice-bad">
          <AlertTriangle size={15} /> USB-C is {Math.round(mm(res.usb.gap))} mm from the wall, so the cable won't reach. Slide it to
          the edge.
        </div>
      ) : (
        <div className="notice">
          <Info size={15} />
          <span>
            USB-C flush with the {USB_DIRS.find((d) => d.dir === res.place.rot)?.label.toLowerCase()} wall
            {res.autoPlace ? ", placed automatically" : ""}.
          </span>
        </div>
      )}
      {goLayout && (
        <div className="legend-row">
          <span>
            <i /> Row / column wires
          </span>
          <span>
            <i className="extra" /> Knobs &amp; screen
          </span>
        </div>
      )}
      {!goLayout && !res.autoPlace && (
        <button type="button" className="btn btn-sm" onClick={() => setPlace(null)} style={{ justifySelf: "start" }}>
          Place automatically
        </button>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- Electronics */

const USB_DIRS: { dir: UsbDir; label: string }[] = [
  { dir: 0, label: "Top" },
  { dir: 90, label: "Right" },
  { dir: 180, label: "Bottom" },
  { dir: 270, label: "Left" },
];

export function ElectronicsRail({
  spec,
  update,
  wiring,
  res,
  setPlace,
  goLayout,
}: RailProps & { setPlace: (p: McuPlace | null) => void; goLayout: () => void }) {
  const e = spec.electronics;
  const keys = wiring.keys;
  const setE = (patch: Partial<BuildSpec["electronics"]>) =>
    update((s) => ({ ...s, electronics: { ...s.electronics, ...patch } }));

  // Changing switch family swaps in switches, and keycaps, that fit it.
  const setFamily = (f: SwitchFamily) => {
    if (f === e.switchFamily) return;
    const sw = switchById(e.switchId);
    const caps = capsOf(spec);
    const prof = capProfileById(caps.profile);
    update((s) => ({
      ...s,
      electronics: {
        ...s.electronics,
        switchFamily: f,
        switchId: sw && sw.family !== f ? (SWITCHES.find((x) => x.family === f)?.id ?? null) : s.electronics.switchId,
      },
      keycaps: prof && prof.family !== f ? { ...caps, profile: KEYCAP_PROFILES.find((k) => k.family === f)?.id ?? "none" } : caps,
    }));
  };

  return (
    <>
      <div className="rail-head">
        <h1>Pick the electronics</h1>
        <p>The brain, the switches and how they fit. The PCB is drawn around whatever you choose.</p>
      </div>

      <section className="group" aria-label="Microcontroller">
        <div className="group-title">
          Microcontroller <span className="muted">wired, USB-C</span>
        </div>
        <div className="tiles" role="radiogroup">
          {MCUS.map((m) => {
            const fits = wiringFor({ ...spec, electronics: { ...e, mcu: m.id } }).wiring.kind !== "too-many";
            return (
              <button
                type="button"
                role="radio"
                key={m.id}
                className="tile"
                aria-checked={e.mcu === m.id}
                onClick={() => setE({ mcu: m.id })}
              >
                <div className="tile-row">
                  <span className="tile-name">{m.name}</span>
                  <span className="tile-price">{inr(price(m.cost))}</span>
                </div>
                <span className="tile-sub">
                  {m.chip} · {m.firmware} · {m.pins} pins
                </span>
                <span className="tile-sub">{m.blurb}</span>
                {!fits && <span className="error-text">Not enough pins for this layout.</span>}
              </button>
            );
          })}
        </div>
        <WiringFacts wiring={wiring} />
      </section>

      <ControllerPlacement res={res} setPlace={setPlace} goLayout={goLayout} />

      <section className="group" aria-label="Switches">
        <div className="group-title">
          Switches <span className="muted">{keys} needed</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Switch family">
          <button type="button" role="radio" aria-checked={e.switchFamily === "mx"} onClick={() => setFamily("mx")}>
            MX style
          </button>
          <button type="button" role="radio" aria-checked={e.switchFamily === "choc"} onClick={() => setFamily("choc")}>
            Low-profile Choc
          </button>
        </div>
        <div className="tiles" role="radiogroup">
          {SWITCHES.filter((s) => s.family === e.switchFamily).map((s) => (
            <button
              type="button"
              role="radio"
              key={s.id}
              className="tile"
              aria-checked={e.switchId === s.id}
              onClick={() => setE({ switchId: s.id })}
            >
              <div className="tile-row">
                <span className="tile-name">{s.name}</span>
                <span className="tile-price">{inr(price(s.cost) * keys)}</span>
              </div>
              <span className="tile-sub">
                {s.feel} · {inr(price(s.cost))} each
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            className="tile"
            aria-checked={e.switchId === null}
            onClick={() => setE({ switchId: null, hotswap: true })}
          >
            <div className="tile-row">
              <span className="tile-name">Bring my own</span>
              <span className="tile-price">{inr(0)}</span>
            </div>
            <span className="tile-sub">Hotswap sockets are added so yours drop straight in.</span>
          </button>
        </div>
        <div
          className="toggle-row"
          onClick={() => e.switchId !== null && setE({ hotswap: !e.hotswap })}
          onKeyDown={() => {}}
          role="presentation"
        >
          <div>
            <div className="tile-name">Hotswap sockets</div>
            <div className="tile-sub">
              Swap switches without soldering · +{inr(price(HOTSWAP_COST[e.switchFamily]) * keys)}
            </div>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={e.hotswap}
            aria-label="Hotswap sockets"
            disabled={e.switchId === null}
            onClick={(ev) => {
              ev.stopPropagation();
              setE({ hotswap: !e.hotswap });
            }}
          />
        </div>
      </section>


      <section className="group" aria-label="Add-ons">
        <div className="group-title">Knobs &amp; screen</div>
        <div className="notice">
          <Info size={15} />
          <span>
            {wiring.encoders} knob{wiring.encoders === 1 ? "" : "s"} and {wiring.oleds ? "an OLED" : "no OLED"} on this board. They're placed on the{" "}
            <button type="button" className="btn btn-ghost btn-sm" style={{ height: 22, padding: "0 4px" }} onClick={goLayout}>
              Layout
            </button>{" "}
            step.
          </span>
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------- Keycaps */

/** Side view of a profile's rows: the silhouette is the difference. */
function ProfileSilhouette({ id }: { id: string }) {
  const p = capProfileById(id);
  if (!p) return null;
  const rows = p.sculpted ? p.rows : [p.rows[0], p.rows[0], p.rows[0], p.rows[0]];
  const scale = 2.2; // px per mm
  const base = 34;
  const capW = 18 * scale;
  return (
    <svg className="silhouette" viewBox="0 0 176 40" aria-hidden>
      <line x1={0} y1={base + 0.5} x2={176} y2={base + 0.5} className="silhouette-floor" />
      {rows.map((r, i) => {
        const x0 = 4 + i * (capW + 4);
        const h = r.h * scale;
        // Tilt raises the back (left, away from the typist) edge.
        const lift = Math.tan((r.tilt * Math.PI) / 180) * (capW - (p.taper.front + p.taper.back) * scale) * 0.5;
        const topL = x0 + p.taper.back * scale;
        const topR = x0 + capW - p.taper.front * scale;
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            key={i}
            className="silhouette-cap"
            d={`M${x0} ${base} L${topL} ${base - h - lift} Q${(topL + topR) / 2} ${base - h + p.dishDepth * scale * 1.5} ${topR} ${base - h + lift} L${x0 + capW} ${base} Z`}
          />
        );
      })}
    </svg>
  );
}

export function KeycapsRail({ spec, update, wiring }: RailProps) {
  const caps = capsOf(spec);
  const family = spec.electronics.switchFamily;
  const setCaps = (patch: Partial<typeof caps>) => update((s) => ({ ...s, keycaps: { ...capsOf(s), ...patch } }));
  const units = spec.layout.items.filter((i) => i.kind === "key").reduce((n, k) => n + Math.ceil(Math.max(k.w, k.h)), 0);

  return (
    <>
      <div className="rail-head">
        <h1>Choose the keycaps</h1>
        <p>
          The part your fingers touch. Profiles differ in height and shape; watch the board as you switch. {wiring.keys} caps for{" "}
          {family === "mx" ? "MX" : "Choc"} stems.
        </p>
      </div>

      <section className="group" aria-label="Profile">
        <div className="group-title">Profile</div>
        <div className="tiles" role="radiogroup">
          {KEYCAP_PROFILES.filter((k) => k.family === family).map((k) => (
            <button
              type="button"
              role="radio"
              key={k.id}
              className="tile"
              aria-checked={caps.profile === k.id}
              onClick={() => setCaps({ profile: k.id })}
            >
              <div className="tile-row">
                <span className="tile-name">{k.name}</span>
                <span className="tile-price">{inr(price(k.cost) * units)}</span>
              </div>
              <ProfileSilhouette id={k.id} />
              <span className="tile-sub">{k.blurb}</span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            className="tile"
            aria-checked={caps.profile === "none"}
            onClick={() => setCaps({ profile: "none" })}
          >
            <div className="tile-row">
              <span className="tile-name">No keycaps</span>
              <span className="tile-price">{inr(0)}</span>
            </div>
            <span className="tile-sub">Bring your own set.</span>
          </button>
        </div>
      </section>

      {caps.profile !== "none" && (
        <>
          <section className="group" aria-label="Colourway">
            <div className="group-title">Colourway</div>
            <div className="swatches" role="radiogroup">
              {COLORWAYS.map((c) => (
                <button
                  type="button"
                  role="radio"
                  key={c.id}
                  className="swatch"
                  aria-checked={caps.colorway === c.id}
                  onClick={() => setCaps({ colorway: c.id })}
                >
                  <span className="swatch-chip swatch-split" style={{ background: `linear-gradient(135deg, ${c.alpha} 0 50%, ${c.mod} 50% 78%, ${c.accent} 78%)` }} />
                  {c.name}
                </button>
              ))}
            </div>
          </section>

          <section className="group" aria-label="Legends">
            <div className="group-title">Legends</div>
            <div className="segmented" role="radiogroup">
              <button type="button" role="radio" aria-checked={!caps.legends} onClick={() => setCaps({ legends: false })}>
                Blank
              </button>
              <button type="button" role="radio" aria-checked={caps.legends} onClick={() => setCaps({ legends: true })}>
                Dye-sub · +{inr(price(LEGEND_COST) * units)}
              </button>
            </div>
            <p className="tile-sub">Legends come from the labels you typed on the Layout step.</p>
          </section>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- PCB */

export function PcbRail({ spec, update }: RailProps) {
  const p = spec.pcb;
  const setP = (patch: Partial<BuildSpec["pcb"]>) => update((s) => ({ ...s, pcb: { ...s.pcb, ...patch } }));
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const size = pcbSize(spec);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (!["image/png", "image/svg+xml"].includes(f.type)) return setErr("Logos must be PNG or SVG.");
    if (f.size > 1024 * 1024) return setErr("Logos must be under 1 MB.");
    setUploading(true);
    try {
      const { key } = await api.upload(f);
      setP({ logo: { key, name: f.name } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="rail-head">
        <h1>Dress the PCB</h1>
        <p>
          A {Math.round(size.w)} × {Math.round(size.h)} mm board, generated for your exact layout. Choose how it looks.
        </p>
      </div>

      <section className="group" aria-label="Solder mask">
        <div className="group-title">Solder mask</div>
        <div className="swatches" role="radiogroup">
          {MASKS.map((m) => (
            <button
              type="button"
              role="radio"
              key={m.id}
              className="swatch"
              aria-checked={p.mask === m.id}
              onClick={() => setP({ mask: m.id, silk: m.id === "white" ? "black" : p.silk === "black" && p.mask === "white" ? "white" : p.silk })}
            >
              <span className="swatch-chip" style={{ background: m.hex }} />
              {m.name}
              {m.cost > 0 && <span className="num" style={{ fontSize: 11 }}>+{inr(price(m.cost))}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="group" aria-label="Silkscreen">
        <div className="group-title">Silkscreen</div>
        <div className="segmented" role="radiogroup">
          {(["white", "black"] as const).map((c) => (
            <button type="button" role="radio" key={c} aria-checked={p.silk === c} onClick={() => setP({ silk: c })}>
              {c === "white" ? "White" : "Black"}
            </button>
          ))}
        </div>
      </section>

      <section className="group" aria-label="Logo">
        <div className="group-title">
          Your logo <span className="muted">printed in silkscreen, free</span>
        </div>
        {p.logo ? (
          <div className="toggle-row" style={{ cursor: "default" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <img src={fileUrl(p.logo.key)} alt="" width={44} height={28} style={{ objectFit: "contain", background: "#1b1b1d", borderRadius: 4 }} />
              <span className="tile-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.logo.name}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove logo" onClick={() => setP({ logo: null })}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <button type="button" className="tile" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <div className="tile-row">
              <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Upload size={16} /> {uploading ? "Uploading…" : "Upload PNG or SVG"}
              </span>
            </div>
            <span className="tile-sub">High contrast works best. Max 1 MB. Goes on the bottom-right corner.</span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/svg+xml"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {err && <p className="error-text">{err}</p>}
      </section>

      <div className="notice">
        <Info size={15} />
        <span>Switch to 3D above the board, and toggle component bodies to see it bare or populated. The studio remembers your choice.</span>
      </div>

      <div className="notice">
        <Info size={15} />
        <span>2-layer FR4, 1.6 mm, HASL. Schematic and Gerbers ship with your kit, so you can re-order the board yourself.</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Case */

export function CaseRail({ spec, update, quote }: RailProps) {
  const c = spec.case;
  const caseLine = quote.lines.find((l) => l.id === "case");
  return (
    <>
      <div className="rail-head">
        <h1>Choose the case</h1>
        <p>Cut, printed or milled to fit your board{caseLine ? `: ${caseLine.detail.split(",")[0]}` : ""}.</p>
      </div>

      <section className="group" aria-label="Case type">
        <div className="group-title">Material</div>
        <div className="tiles" role="radiogroup">
          {CASES.map((opt) => (
            <button
              type="button"
              role="radio"
              key={opt.type}
              className="tile"
              aria-checked={c.type === opt.type}
              onClick={() => update((s) => ({ ...s, case: { ...s.case, type: opt.type, finish: opt.finishes[0].id } }))}
            >
              <div className="tile-row">
                <span className="tile-name">{opt.name}</span>
                <span className="tag">{opt.leadDays}</span>
              </div>
              <span className="tile-sub">{opt.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="group" aria-label="Finish">
        <div className="group-title">
          Finish <span className="tile-price">{caseLine ? inr(caseLine.total) : ""}</span>
        </div>
        <div className="swatches" role="radiogroup">
          {CASES.find((o) => o.type === c.type)?.finishes.map((f) => (
            <button
              type="button"
              role="radio"
              key={f.id}
              className="swatch"
              aria-checked={c.finish === f.id}
              onClick={() => update((s) => ({ ...s, case: { ...s.case, finish: f.id } }))}
            >
              <span
                className="swatch-chip"
                style={{
                  background: f.metal ? `linear-gradient(135deg, #fff8 0%, ${f.hex} 45%, ${f.hex} 70%, #0003 100%)` : f.hex,
                  opacity: f.clear ? 0.75 : 1,
                }}
              />
              {f.name}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- Review */

export function ReviewRail({ spec, quote, blockers, go }: RailProps & { go: (s: StepId) => void }) {
  return (
    <>
      <div className="rail-head">
        <h1>{spec.name || "Your keyboard"}</h1>
        <p>Everything below arrives sorted and labelled in one box, with the files to make it again.</p>
      </div>

      <Blockers list={blockers} />

      <section className="group" aria-label="Kit contents">
        <div className="group-title">In the kit</div>
        <div className="lines">
          {quote.lines.map((l) => (
            <div className="qline" key={l.id}>
              <span className="qline-label">
                {l.label}
                {l.qty > 1 ? <span className="muted num"> × {l.qty}</span> : null}
              </span>
              <span className="qline-total">{l.total ? inr(l.total) : "Included"}</span>
              <span className="qline-detail">{l.detail}</span>
            </div>
          ))}
          <div className="qline">
            <span className="qline-label">Shipping</span>
            <span className="qline-total">{inr(quote.shipping)}</span>
            <span className="qline-detail">Anywhere in India</span>
          </div>
        </div>
      </section>

      <section className="group" aria-label="Change something">
        <div className="group-title">Change something</div>
        <div className="chips">
          {(["layout", "electronics", "pcb", "case", "keycaps"] as const).map((s) => (
            <button type="button" key={s} className="btn btn-sm" onClick={() => go(s)}>
              {s === "pcb" ? "PCB" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
