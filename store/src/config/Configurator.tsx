import { ArrowLeft, ArrowRight, Copy, Redo2, Trash2, Undo2 } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bounds, mm, overlaps, physicalIssues, resolve, SNAP, wiring } from "../../shared/board";
import { newId } from "../../shared/kle";
import { quote } from "../../shared/pricing";
import type { BuildSpec, Item, ItemKind, McuPlace, Outline } from "../../shared/types";
import { api } from "../api";
import { linkProps, navigate } from "../router";
import { BoardArt } from "../ui/Board";
import { Price } from "../ui/Price";
import { Editor } from "./Editor";
import { McuStage } from "./McuStage";
import { CaseRail, ElectronicsRail, KeycapsRail, LayoutRail, PcbRail, ReviewRail } from "./Rails";
import type { Layers } from "./Scene3D";

const Scene3D = lazy(() => import("./Scene3D"));

export const STEPS = [
  { id: "layout", label: "Layout" },
  { id: "electronics", label: "Electronics" },
  { id: "pcb", label: "PCB" },
  { id: "case", label: "Case" },
  { id: "keycaps", label: "Keycaps" },
  { id: "review", label: "Review" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

const SIZES: Record<ItemKind, { w: number; h: number; label: string }> = {
  key: { w: 1, h: 1, label: "" },
  encoder: { w: 1, h: 1, label: "Knob" },
  oled: { w: 2, h: 1, label: "OLED" },
};

/** First free slot to the right of the board, top-aligned. */
function freeSpot(items: Item[], w: number, h: number) {
  if (items.length === 0) return { x: 0, y: 0 };
  const b = bounds(items);
  for (let y = b.y; y <= b.y + b.h; y += SNAP * 4) {
    for (let x = b.x; x <= b.x + b.w + 1; x += SNAP) {
      const clash = items.some((i) => x < i.x + i.w && i.x < x + w && y < i.y + i.h && i.y < y + h);
      if (!clash) return { x, y };
    }
  }
  return { x: b.x + b.w + 0.25, y: b.y };
}

/** How the board is shown: a per-viewer preference, shared by PCB step and studio. */
export interface ViewPrefs {
  pcb3d: boolean;
  bodies: boolean;
  studioCase: boolean;
  studioCaps: boolean;
}
const PREFS_KEY = "store:view";
const DEFAULT_PREFS: ViewPrefs = { pcb3d: false, bodies: true, studioCase: true, studioCaps: true };

function usePrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const set = (patch: Partial<ViewPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: preference lasts this visit */
      }
      return next;
    });
  return [prefs, set] as const;
}

type SaveState = "saved" | "saving" | "error";

// Undo restores the physical build only; names and part choices stay.
const physical = (from: BuildSpec, onto: BuildSpec): BuildSpec => ({
  ...onto,
  layout: from.layout,
  case: { ...onto.case, outline: from.case.outline ?? null },
  electronics: { ...onto.electronics, mcuPlace: from.electronics.mcuPlace ?? null },
});

export function Configurator({ id, step }: { id: string; step: StepId }) {
  const [spec, setSpec] = useState<BuildSpec | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [past, setPast] = useState<BuildSpec[]>([]);
  const [future, setFuture] = useState<BuildSpec[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [save, setSave] = useState<SaveState>("saved");
  const [prefs, setPrefs] = usePrefs();
  const first = useRef(true);

  useEffect(() => {
    api
      .build(id)
      .then((b) => setSpec(b.spec))
      .catch((e) => setLoadError(e.message));
  }, [id]);

  // Autosave, debounced: the build is always the last thing on screen.
  useEffect(() => {
    if (!spec) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    const t = setTimeout(() => {
      api
        .saveBuild(id, spec)
        .then(() => setSave("saved"))
        .catch(() => setSave("error"));
    }, 700);
    return () => clearTimeout(t);
  }, [spec, id]);

  const update = useCallback((fn: (s: BuildSpec) => BuildSpec) => setSpec((s) => (s ? fn(s) : s)), []);

  /** A physical edit (keys, case shape, controller): one undo step. */
  const commit = useCallback(
    (fn: (s: BuildSpec) => BuildSpec) => {
      if (!spec) return;
      setPast((p) => [...p.slice(-80), spec]);
      setFuture([]);
      setSpec(fn(spec));
    },
    [spec],
  );

  const commitItems = useCallback((items: Item[]) => commit((s) => ({ ...s, layout: { items } })), [commit]);
  const setOutline = useCallback(
    (outline: Outline | null) => commit((s) => ({ ...s, case: { ...s.case, outline } })),
    [commit],
  );
  const setPlace = useCallback(
    (mcuPlace: McuPlace | null) => commit((s) => ({ ...s, electronics: { ...s.electronics, mcuPlace } })),
    [commit],
  );

  const undo = useCallback(() => {
    if (!spec || past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((f) => [spec, ...f]);
    setSpec(physical(prev, spec));
  }, [spec, past]);

  const redo = useCallback(() => {
    if (!spec || future.length === 0) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setPast((p) => [...p, spec]);
    setSpec(physical(next, spec));
  }, [spec, future]);

  const items = spec?.layout.items ?? [];

  const add = useCallback(
    (kind: ItemKind) => {
      const sz = SIZES[kind];
      const spot = freeSpot(items, sz.w, sz.h);
      const it: Item = { id: newId(), kind, ...sz, ...spot };
      commitItems([...items, it]);
      setSelected(new Set([it.id]));
    },
    [items, commitItems],
  );

  const removeSelected = useCallback(() => {
    if (selected.size === 0) return;
    commitItems(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  }, [items, selected, commitItems]);

  const duplicate = useCallback(() => {
    if (selected.size === 0) return;
    const sel = items.filter((i) => selected.has(i.id));
    const b = bounds(sel);
    const copies = sel.map((i) => ({ ...i, id: newId(), y: i.y + b.h + 0.25 }));
    commitItems([...items, ...copies]);
    setSelected(new Set(copies.map((c) => c.id)));
  }, [items, selected, commitItems]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selected.size === 0) return;
      commitItems(items.map((i) => (selected.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)));
    },
    [items, selected, commitItems],
  );

  // Editor keyboard: layout and electronics steps, never while typing.
  useEffect(() => {
    if (step !== "layout" && step !== "electronics") return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (step !== "layout") return;
      const big = e.shiftKey ? 1 : SNAP;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(items.map((i) => i.id)));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") setSelected(new Set());
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(-big, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(big, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nudge(0, -big);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudge(0, big);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [step, items, undo, redo, duplicate, removeSelected, nudge]);

  const q = useMemo(() => (spec ? quote(spec) : null), [spec]);
  const bad = useMemo(() => overlaps(items), [items]);
  const wire = useMemo(() => (spec ? wiring(spec) : null), [spec]);
  const res = useMemo(() => (spec ? resolve(spec) : null), [spec]);

  if (loadError)
    return (
      <div className="loading-screen">
        <div className="empty">
          <b>That build could not be opened</b>
          {loadError} <a {...linkProps("/")}>Back to your builds</a>
        </div>
      </div>
    );
  if (!spec || !q || !wire || !res) return <div className="loading-screen">Opening your build…</div>;

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const go = (s: StepId) => navigate(`/build/${id}?step=${s}`);
  const next = STEPS[stepIndex + 1];
  const prev = STEPS[stepIndex - 1];
  const keyCount = items.filter((i) => i.kind === "key").length;
  const blockers = [
    keyCount === 0 && "Add at least one key.",
    bad.size > 0 && `${bad.size} items overlap. Move them apart.`,
    wire.wiring.kind === "too-many" && "Too many keys for this MCU. Pick one with more pins.",
    ...physicalIssues(res),
  ].filter(Boolean) as string[];

  const railProps = { spec, update, quote: q, wiring: wire, blockers, id, res };
  const studio: Layers = { case: prefs.studioCase, caps: prefs.studioCaps, bodies: prefs.bodies };
  const toggle = (on: boolean, label: string, flip: () => void) => (
    <button type="button" className="btn btn-ghost btn-sm tool-toggle" aria-pressed={on} onClick={flip}>
      <span className="tool-check" aria-hidden /> {label}
    </button>
  );

  return (
    <div className="config studio">
      <header className="topbar">
        <div className="topbar-left">
          <a className="wordmark" {...linkProps("/")} aria-label="Your builds">
            madebyanirudha <span className="wordmark-store">store</span>
          </a>
          <input
            className="build-name"
            value={spec.name}
            aria-label="Build name"
            maxLength={80}
            onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <nav className="steps" aria-label="Build steps">
          {STEPS.map((s, i) => (
            <button
              type="button"
              key={s.id}
              className={`step ${i < stepIndex ? "done" : ""}`}
              aria-current={s.id === step ? "step" : undefined}
              onClick={() => go(s.id)}
            >
              <span className="step-dot">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="save-state" aria-live="polite">
            {save === "saving" ? "Saving…" : save === "error" ? "Not saved, retrying on next change" : "Saved"}
          </span>
          <Price value={q.total} className="bar-price" />
        </div>
      </header>

      <div className="config-body">
        <main className="stage" aria-label="Board preview">
          {step === "layout" && (
            <div className="stage-tools" role="toolbar" aria-label="Edit">
              <button type="button" className="btn btn-ghost btn-icon" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
                <Undo2 size={17} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={17} />
              </button>
              {step === "layout" && (
                <>
                  <span className="tool-sep" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={duplicate} disabled={!selected.size} title="Duplicate (Ctrl+D)">
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-danger"
                    onClick={removeSelected}
                    disabled={!selected.size}
                    title="Delete (Del)"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {step === "layout" && (
            <>
              <Editor
                spec={spec}
                items={items}
                res={res}
                selected={selected}
                onSelect={setSelected}
                onCommit={commitItems}
                onOutline={setOutline}
                onPlace={setPlace}
              />
              {items.length === 0 && (
                <div className="empty-hint">
                  <div>
                    <b>An empty board</b>
                    Add a key from the panel, or start from a template.
                  </div>
                </div>
              )}
            </>
          )}

          {step === "electronics" && <McuStage spec={spec} />}

          {step === "pcb" && (
            <>
              <div className="stage-tools" role="toolbar" aria-label="PCB view">
                <div className="segmented segmented-sm" role="radiogroup" aria-label="View">
                  <button type="button" role="radio" aria-checked={!prefs.pcb3d} onClick={() => setPrefs({ pcb3d: false })}>
                    2D
                  </button>
                  <button type="button" role="radio" aria-checked={prefs.pcb3d} onClick={() => setPrefs({ pcb3d: true })}>
                    3D
                  </button>
                </div>
                <span className="tool-sep" />
                {toggle(prefs.bodies, "Component bodies", () => setPrefs({ bodies: !prefs.bodies }))}
              </div>
              {prefs.pcb3d ? (
                <Suspense fallback={<div className="empty-hint">Setting up the 3D view…</div>}>
                  <Scene3D spec={spec} layers={{ case: false, caps: false, bodies: prefs.bodies }} />
                  <div className="review-hint">Drag to turn · scroll to zoom</div>
                </Suspense>
              ) : (
                <div className="stage-floor">
                  <BoardArt spec={spec} mode="pcb" bodies={prefs.bodies} minView={{ w: 11, h: 7 }} className="showpiece showpiece-enter" />
                </div>
              )}
            </>
          )}

          {step === "case" && (
            <div className="stage-floor">
              <BoardArt spec={spec} mode="case" highlightUsb minView={{ w: 11, h: 7 }} className="showpiece showpiece-enter" />
            </div>
          )}

          {step === "keycaps" && (
            <>
              <div className="stage-tools" role="toolbar" aria-label="Keycap view">
                {toggle(prefs.bodies, "Show switches", () => setPrefs({ bodies: !prefs.bodies }))}
              </div>
              <Suspense fallback={<div className="empty-hint">Setting up the 3D view…</div>}>
                <Scene3D spec={spec} layers={{ case: true, caps: true, bodies: prefs.bodies }} angle="low" rotate={false} />
                <div className="review-hint">Drag to turn · scroll to zoom</div>
              </Suspense>
            </>
          )}

          {step === "review" && (
            <>
              <div className="stage-tools" role="toolbar" aria-label="Studio layers">
                {toggle(prefs.studioCase, "Case", () => setPrefs({ studioCase: !prefs.studioCase }))}
                {toggle(prefs.studioCaps, "Keycaps", () => setPrefs({ studioCaps: !prefs.studioCaps }))}
                {toggle(prefs.bodies, "Component bodies", () => setPrefs({ bodies: !prefs.bodies }))}
              </div>
              <Suspense fallback={<div className="empty-hint">Setting up the studio…</div>}>
                <Scene3D spec={spec} layers={studio} />
                <div className="review-hint">Drag to turn · scroll to zoom</div>
              </Suspense>
            </>
          )}

          <div className="stage-caption">
            <span>
              <b className="num">{keyCount}</b> keys
            </span>
            <span>
              <b className="num">
                {Math.round(mm(res.outline.w))} × {Math.round(mm(res.outline.h))}
              </b>{" "}
              mm case
            </span>
            <span>
              <b>
                {wire.wiring.kind === "direct"
                  ? "Direct wiring"
                  : wire.wiring.kind === "matrix"
                    ? `${wire.wiring.rows} × ${wire.wiring.cols} matrix`
                    : "Needs more pins"}
              </b>
            </span>
            <span>
              USB-C <b>{["top", "right", "bottom", "left"][res.place.rot / 90]}</b>
            </span>
          </div>
        </main>

        <aside className="rail" aria-label={`${STEPS[stepIndex].label} options`}>
          <div className="rail-scroll">
            {step === "layout" && (
              <LayoutRail
                {...railProps}
                selected={selected}
                setSelected={setSelected}
                commitItems={commitItems}
                setOutline={setOutline}
                setPlace={setPlace}
                add={add}
                duplicate={duplicate}
                remove={removeSelected}
                overlapCount={bad.size}
              />
            )}
            {step === "electronics" && <ElectronicsRail {...railProps} setPlace={setPlace} goLayout={() => go("layout")} />}
            {step === "pcb" && <PcbRail {...railProps} />}
            {step === "case" && <CaseRail {...railProps} />}
            {step === "keycaps" && <KeycapsRail {...railProps} />}
            {step === "review" && <ReviewRail {...railProps} go={go} />}
          </div>
          <div className="rail-foot">
            <div className="foot-price">
              <small>Kit total incl. GST &amp; shipping</small>
              <Price value={q.total} />
            </div>
            {next ? (
              <div style={{ display: "flex", gap: 8 }}>
                {prev && (
                  <button type="button" className="btn btn-lg" onClick={() => go(prev.id)} aria-label={`Back to ${prev.label}`}>
                    <ArrowLeft size={17} />
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => go(next.id)}>
                  Continue to {next.label} <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                disabled={blockers.length > 0}
                onClick={() => navigate(`/checkout/${id}`)}
              >
                Checkout <ArrowRight size={17} />
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
