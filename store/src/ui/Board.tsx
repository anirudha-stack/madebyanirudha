// The lit 2D render of a build: case, PCB, controller, keycaps and a soft
// floor shadow. Drawn in keyboard units scaled by S, so every key and the
// controller sit at their exact positions. The pieces are exported so the
// editor and the controller stage draw the board exactly the same way.

import { useId } from "react";
import { bounds, grow, HOLE, type Resolved, resolve, U_MM, WALL } from "../../shared/board";
import {
  capProfileById,
  COLORWAYS,
  colorwayById,
  finishById,
  type KeycapProfile,
  KEYCAP_PROFILES,
  maskById,
  switchById,
} from "../../shared/catalog";
import { capsOf } from "../../shared/templates";
import type { BuildSpec, Item, Rect } from "../../shared/types";
import { fileUrl } from "../api";

export const S = 100; // svg units per 1u
const GAP = 0.03; // keycap inset per side, in u (18 mm cap on 19.05 mm pitch)
const MM = S / U_MM; // svg units per mm

const ACCENT_LABELS = /^(esc|enter|live|paste|knob)$/i;
const MOD_LABELS =
  /^(tab|caps|shift|ctrl|win|alt|fn|menu|backspace|bksp|enter|num|lower|raise|gui|del|ins|home|end|pgup|pgdn|prtsc|\\|space)$/i;

export interface CapPalette {
  alpha: string;
  mod: string;
  accent: string;
  legend: string;
}

/** Editor and ghost renders use the classic colourway. */
export const PALETTES = { blank: COLORWAYS[0], legend: COLORWAYS[0] } satisfies Record<string, CapPalette>;

export const SWITCH_STEM: Record<string, string> = {
  Linear: "#e8c548",
  Tactile: "#8a5a3c",
  Clicky: "#3d74d1",
};

export const MCU_COLOR: Record<string, string> = {
  "pro-micro": "#1f4f8f",
  "rp2040-pro-micro": "#1c1c20",
  "rp2040-zero": "#1c1c20",
};

export function capColor(item: Item, p: CapPalette) {
  if (ACCENT_LABELS.test(item.label)) return p.accent;
  if (item.w >= 1.25 || item.h >= 2 || MOD_LABELS.test(item.label)) return p.mod;
  return p.alpha;
}

/** Shade a hex colour toward black (amt < 0) or white (amt > 0). */
export function shade(hex: string, amt: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const box = (r: Rect) => ({ x: r.x * S, y: r.y * S, width: r.w * S, height: r.h * S });

interface KeyArtProps {
  item: Item;
  palette: CapPalette;
  legends: boolean;
  /** Show the switch instead of a cap (keycaps: none). */
  bare?: { stem: string } | null;
  /** Shapes the top face: its taper and corner radius. */
  profile?: KeycapProfile;
}

/** One item drawn at the origin; the caller positions it. */
export function KeyArt({ item, palette, legends, bare, profile = KEYCAP_PROFILES[0] }: KeyArtProps) {
  const w = item.w * S;
  const h = item.h * S;
  const g = GAP * S;

  if (item.kind === "encoder") {
    const r = Math.min(w, h) * 0.42;
    return (
      <g>
        <circle cx={w / 2} cy={h / 2 + 4} r={r} fill="rgb(20 20 22 / 0.22)" />
        <circle cx={w / 2} cy={h / 2} r={r} fill="url(#knob)" stroke="#9c9ea3" strokeWidth={1.5} />
        <circle cx={w / 2} cy={h / 2} r={r * 0.72} fill="url(#knob-top)" />
        <line x1={w / 2} y1={h / 2 - r * 0.62} x2={w / 2} y2={h / 2 - r * 0.28} stroke="#45464b" strokeWidth={4} strokeLinecap="round" />
      </g>
    );
  }

  if (item.kind === "oled") {
    return (
      <g>
        <rect x={g} y={g + 4} width={w - g * 2} height={h - g * 2} rx={6} fill="rgb(20 20 22 / 0.22)" />
        <rect x={g} y={g} width={w - g * 2} height={h - g * 2} rx={6} fill="#1d1f24" />
        <rect x={g + 10} y={g + 14} width={w - g * 2 - 20} height={h - g * 2 - 28} rx={2} fill="#05070b" />
        <text x={w / 2} y={h / 2 + 6} textAnchor="middle" fontFamily="Geist Mono Variable, monospace" fontSize={17} fill="#7fd6ff" letterSpacing={1}>
          LAYER 0
        </text>
      </g>
    );
  }

  if (bare) return <SwitchArt w={w} h={h} stem={bare.stem} />;

  const color = capColor(item, palette);
  const top = shade(color, 0.28);
  const skirt = shade(color, -0.16);
  const cw = w - g * 2;
  const ch = h - g * 2;
  // Top face, inset by the profile's taper: more at the front on sculpted caps.
  const t = profile.taper;
  const tx = g + Math.min(t.x * MM * 0.8, cw * 0.3);
  const ty = g + t.back * MM * 0.6;
  const tw = cw - (tx - g) * 2;
  const th = ch - (t.back + t.front) * MM * 0.6 - 4;
  const trx = Math.min(profile.topR * MM * 1.3, tw / 2, th / 2);
  const fontSize = item.label.length > 6 ? 13 : item.label.length > 3 ? 15 : 18;

  return (
    <g>
      <rect x={g} y={g + 5} width={cw} height={ch} rx={11} fill="rgb(20 20 22 / 0.18)" />
      <rect x={g} y={g} width={cw} height={ch} rx={11} fill={skirt} />
      <rect x={g + 2} y={g + 1} width={cw - 4} height={ch - 6} rx={10} fill={color} />
      <rect x={tx} y={ty} width={tw} height={th} rx={trx} fill={top} />
      <rect x={tx} y={ty} width={tw} height={th} rx={trx} fill="url(#cap-sheen)" />
      {legends && item.label && (
        <text
          x={tx + 10}
          y={ty + 24}
          fontFamily="Geist Variable, sans-serif"
          fontSize={fontSize}
          fontWeight={500}
          fill={color === palette.accent && palette.accent !== palette.alpha ? "#1b1b1d" : palette.legend}
        >
          {item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label}
        </text>
      )}
    </g>
  );
}

/** A switch seen from above: housing and cross stem, centred in w×h. */
function SwitchArt({ w, h, stem }: { w: number; h: number; stem: string }) {
  const sz = 0.74 * S;
  const x = (w - sz) / 2;
  const y = (h - sz) / 2;
  return (
    <g>
      <rect x={x} y={y + 3} width={sz} height={sz} rx={8} fill="rgb(20 20 22 / 0.25)" />
      <rect x={x} y={y} width={sz} height={sz} rx={8} fill="#2b2c30" />
      <rect x={x + 8} y={y + 8} width={sz - 16} height={sz - 16} rx={6} fill="#3a3b40" />
      <rect x={w / 2 - 4} y={h / 2 - 15} width={8} height={30} rx={2} fill={stem} />
      <rect x={w / 2 - 15} y={h / 2 - 4} width={30} height={8} rx={2} fill={stem} />
    </g>
  );
}

/** Shared gradients; render once per SVG. */
export function BoardDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id="cap-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.04" />
      </linearGradient>
      <radialGradient id="knob" cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#f4f5f7" />
        <stop offset="0.6" stopColor="#c3c5ca" />
        <stop offset="1" stopColor="#8d9096" />
      </radialGradient>
      <radialGradient id="knob-top" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c9cbd0" />
      </radialGradient>
      <linearGradient id="usb-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9a9da3" />
        <stop offset="0.5" stopColor="#eef0f3" />
        <stop offset="1" stopColor="#9a9da3" />
      </linearGradient>
      <filter id={`floor-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="22" />
      </filter>
      <filter id={`glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
    </defs>
  );
}

/* ------------------------------------------------------------ Controller */

/**
 * The controller module, drawn with USB-C up in its own frame and rotated
 * into place. `bodies` draws the populated module; otherwise its footprint.
 */
export function McuArt({
  res,
  bodies,
  silk = "#f4f4f0",
  state = "ok",
}: {
  res: Resolved;
  bodies: boolean;
  silk?: string;
  state?: "ok" | "bad" | "ghost";
}) {
  const r = res.mcuRect;
  const side = res.place.rot === 90 || res.place.rot === 270;
  const w = (side ? r.h : r.w) * S; // unrotated: narrow side across
  const h = (side ? r.w : r.h) * S;
  const cx = (r.x + r.w / 2) * S;
  const cy = (r.y + r.h / 2) * S;
  const pitch = 2.54 * MM;
  const n = Math.max(2, Math.floor((h - 6 * MM) / pitch) + 1);
  const pads = Array.from({ length: n }, (_, i) => h / 2 - ((n - 1) * pitch) / 2 + i * pitch);
  const usbW = 9 * MM;
  const usbH = 7.4 * MM;
  const bad = state === "bad";

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${res.place.rot}) translate(${-w / 2} ${-h / 2})`}
      opacity={state === "ghost" ? 0.55 : 1}
    >
      {bodies ? (
        <>
          <rect x={0} y={4} width={w} height={h} rx={5} fill="rgb(20 20 22 / 0.3)" />
          <rect x={0} y={0} width={w} height={h} rx={5} fill={MCU_COLOR[res.mcu.id] ?? "#1c1c20"} />
          {pads.map((py) => (
            <g key={py} fill="#d9b765">
              <circle cx={1.6 * MM} cy={py} r={0.9 * MM} />
              <circle cx={w - 1.6 * MM} cy={py} r={0.9 * MM} />
            </g>
          ))}
          <rect x={w / 2 - 3.6 * MM} y={h * 0.52 - 3.6 * MM} width={7.2 * MM} height={7.2 * MM} rx={2} fill="#0d0d10" />
          <circle cx={w / 2 - 2.3 * MM} cy={h * 0.52 - 2.3 * MM} r={0.5 * MM} fill="#3a3a40" />
          <text
            x={w / 2}
            y={h - 3 * MM}
            textAnchor="middle"
            fontFamily="Geist Mono Variable, monospace"
            fontSize={2.2 * MM}
            fill="#f4f4f0"
            opacity={0.7}
          >
            {res.mcu.chip}
          </text>
          <rect x={w / 2 - usbW / 2} y={-1.4 * MM} width={usbW} height={usbH} rx={1.6 * MM} fill="url(#usb-metal)" />
          <rect x={w / 2 - usbW / 2 + 1.3 * MM} y={-1.4 * MM} width={usbW - 2.6 * MM} height={1.4 * MM} rx={0.6 * MM} fill="#2a2b2f" />
        </>
      ) : (
        <>
          <rect x={0} y={0} width={w} height={h} rx={4} fill="none" stroke={silk} strokeWidth={2} />
          {pads.map((py) => (
            <g key={py} fill="#d9b765">
              <rect x={0.6 * MM} y={py - 0.8 * MM} width={2 * MM} height={1.6 * MM} rx={2} />
              <rect x={w - 2.6 * MM} y={py - 0.8 * MM} width={2 * MM} height={1.6 * MM} rx={2} />
            </g>
          ))}
          <rect x={w / 2 - usbW / 2} y={-1.4 * MM} width={usbW} height={usbH} rx={1.6 * MM} fill="none" stroke={silk} strokeWidth={1.5} strokeDasharray="5 4" />
        </>
      )}
      {bad && <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={7} fill="rgb(200 40 30 / 0.18)" stroke="#c8281e" strokeWidth={3} />}
    </g>
  );
}

/**
 * Where the cable plugs in: a port cut in the case wall at the USB-C end,
 * and, when highlighted, a glow and a label outside the case.
 */
export function UsbMarker({ res, uid, highlight }: { res: Resolved; uid: string; highlight: boolean }) {
  const o = res.outline;
  const { x, y, dir } = res.usb;
  const reaches = res.usb.gap <= 0.02;
  // The port sits on the outer wall, in line with the connector.
  const wall = dir === 0 ? { x, y: o.y } : dir === 90 ? { x: o.x + o.w, y } : dir === 180 ? { x, y: o.y + o.h } : { x: o.x, y };
  const along = dir === 0 || dir === 180;
  const pw = (along ? 11 : 4.5) * MM;
  const ph = (along ? 4.5 : 11) * MM;
  const out = { x: (dir === 90 ? 1 : dir === 270 ? -1 : 0) * 0.62, y: (dir === 180 ? 1 : dir === 0 ? -1 : 0) * 0.62 };
  const lx = (wall.x + out.x) * S;
  const ly = (wall.y + out.y) * S;
  const color = reaches ? "#ff5a1f" : "#c8281e";

  return (
    <g pointerEvents="none">
      {highlight && <circle cx={wall.x * S} cy={wall.y * S} r={30} fill={color} opacity={0.55} filter={`url(#glow-${uid})`} />}
      <rect
        x={wall.x * S - pw / 2}
        y={wall.y * S - ph / 2}
        width={pw}
        height={ph}
        rx={ph < pw ? ph / 2 : pw / 2}
        fill="#141416"
        stroke={highlight ? color : "none"}
        strokeWidth={3}
      />
      {highlight && !reaches && (
        <line x1={x * S} y1={y * S} x2={wall.x * S} y2={wall.y * S} stroke={color} strokeWidth={3} strokeDasharray="6 6" />
      )}
      {highlight && (
        <g>
          <line x1={wall.x * S} y1={wall.y * S} x2={lx} y2={ly} stroke={color} strokeWidth={3} />
          <g transform={`translate(${lx} ${ly})`}>
            <rect x={reaches ? -58 : -76} y={-20} width={reaches ? 116 : 152} height={40} rx={20} fill={color} />
            <text y={7} textAnchor="middle" fontFamily="Geist Variable, sans-serif" fontWeight={600} fontSize={20} fill="#141416">
              {reaches ? "USB-C" : "Not at edge"}
            </text>
          </g>
        </g>
      )}
    </g>
  );
}

/** An M3 button-head screw seen from above, with its hex socket. */
function ScrewHead({ x, y }: { x: number; y: number }) {
  const r = 2.9 * MM;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${x + Math.cos(a) * r * 0.42},${y + Math.sin(a) * r * 0.42}`;
  }).join(" ");
  return (
    <g>
      <circle cx={x} cy={y + 2} r={r} fill="rgb(20 20 22 / 0.3)" />
      <circle cx={x} cy={y} r={r} fill="url(#knob)" stroke="#8d9096" strokeWidth={1} />
      <polygon points={hex} fill="#3a3b40" />
    </g>
  );
}

/* ------------------------------------------------------------------ Case */

export function CaseArt({ spec, res, uid }: { spec: BuildSpec; res: Resolved; uid: string }) {
  const o = res.outline;
  const rx = Math.min(o.r, o.w / 2, o.h / 2) * S;
  const finish = finishById(spec.case.finish);
  const hex = finish?.hex ?? "#232326";
  const clear = !!finish?.clear;
  const mask = maskById(spec.pcb.mask);
  const items = spec.layout.items;
  // The plate covers the PCB inside the walls.
  const plate = grow(res.pcb, 0.06);
  const prx = Math.max(6, rx - WALL * S);
  const b = items.length ? bounds(items) : res.pcb;

  return (
    <g>
      {spec.case.type === "acrylic" &&
        [3, 2, 1].map((l) => (
          <rect
            key={l}
            {...box(o)}
            y={o.y * S + l * 5}
            rx={rx}
            fill={clear ? "rgb(206 222 230 / 0.55)" : shade(hex, 0.08 * l)}
            stroke="rgb(20 20 22 / 0.12)"
          />
        ))}
      <rect {...box(o)} y={o.y * S + (spec.case.type === "acrylic" ? 0 : 8)} rx={rx} fill={shade(hex, -0.25)} />
      <rect
        {...box(o)}
        rx={rx}
        fill={clear ? "rgb(214 228 235 / 0.55)" : hex}
        stroke={clear ? "rgb(120 140 150 / 0.5)" : "rgb(0 0 0 / 0.12)"}
      />
      {finish?.metal && <rect {...box(o)} rx={rx} fill={`url(#metal-${uid})`} />}
      {clear && <rect {...box(res.pcb)} rx={Math.max(6, rx - WALL * S)} fill={mask?.hex ?? "#1b1b1d"} />}
      <rect {...box(plate)} rx={prx} fill={clear ? "rgb(20 20 22 / 0.1)" : shade(hex, -0.3)} />
      {/* Keys sit in a slightly deeper well. */}
      <rect {...box(grow(b, 0.04))} rx={12} fill={clear ? "rgb(20 20 22 / 0.06)" : shade(hex, -0.38)} />
      {spec.case.type === "acrylic" && res.holes.map((h) => <ScrewHead key={`${h.x}-${h.y}`} x={h.x * S} y={h.y * S} />)}
    </g>
  );
}

/* ------------------------------------------------------------------- PCB */

export function PcbArt({
  spec,
  res,
  bodies,
  mcu = true,
}: {
  spec: BuildSpec;
  res: Resolved;
  bodies: boolean;
  /** Draw the controller (the controller stage draws its own, draggable). */
  mcu?: boolean;
}) {
  const items = spec.layout.items;
  const maskHex = maskById(spec.pcb.mask)?.hex ?? "#1e6b3a";
  const silk = spec.pcb.silk === "white" ? "#f4f4f0" : "#1b1b1d";
  const p = res.pcb;
  const prx = Math.max(8, (Math.min(res.outline.r, res.outline.w / 2) - WALL) * S);
  const fp = 0.735 * S; // 14 mm switch cutout
  const copper = "#d7b56d";
  const hotswap = spec.electronics.hotswap;
  const choc = spec.electronics.switchFamily === "choc";
  const sw = switchById(spec.electronics.switchId);
  const stem = SWITCH_STEM[sw?.feel ?? "Linear"];

  return (
    <g>
      <rect {...box(p)} y={p.y * S + 6} rx={prx} fill={shade(maskHex, -0.4)} />
      <rect {...box(p)} rx={prx} fill={maskHex} />
      <rect {...box(p)} rx={prx} fill="url(#cap-sheen)" opacity={0.5} />
      {items.map((it) => {
        const cxk = (it.x + it.w / 2) * S;
        const cyk = (it.y + it.h / 2) * S;
        if (it.kind === "encoder")
          return (
            <g key={it.id}>
              <g fill="none" stroke={silk} strokeWidth={2}>
                <rect x={cxk - 0.33 * S} y={cyk - 0.33 * S} width={0.66 * S} height={0.66 * S} rx={4} />
                <circle cx={cxk} cy={cyk} r={0.2 * S} />
              </g>
              {[-0.13, 0, 0.13].map((d) => (
                <circle key={d} cx={cxk + d * S} cy={cyk + 0.38 * S} r={5} fill={copper} />
              ))}
              {bodies && (
                <g>
                  <rect x={cxk - 0.3 * S} y={cyk - 0.3 * S} width={0.6 * S} height={0.6 * S} rx={4} fill="#2b2c30" />
                  <circle cx={cxk} cy={cyk} r={0.14 * S} fill="#b9bcc2" />
                  <rect x={cxk - 2} y={cyk - 0.14 * S} width={4} height={0.14 * S} fill="#55575c" />
                </g>
              )}
            </g>
          );
        if (it.kind === "oled")
          return (
            <g key={it.id}>
              <rect x={it.x * S + 12} y={it.y * S + 18} width={it.w * S - 24} height={it.h * S - 36} rx={4} fill="none" stroke={silk} strokeWidth={2} />
              {[0, 1, 2, 3].map((q) => (
                <circle key={q} cx={it.x * S + 40 + q * 22} cy={it.y * S + 32} r={5} fill={copper} />
              ))}
              {bodies && (
                <g transform={`translate(${it.x * S} ${it.y * S})`}>
                  <KeyArt item={it} palette={PALETTES.blank} legends={false} />
                </g>
              )}
            </g>
          );
        return (
          <g key={it.id}>
            <rect x={cxk - fp / 2} y={cyk - fp / 2} width={fp} height={fp} rx={3} fill="none" stroke={silk} strokeWidth={2} opacity={0.9} />
            {hotswap && (
              <path
                d={`M${cxk - 0.3 * S} ${cyk + 0.05 * S} h${0.32 * S} l${0.08 * S} ${0.08 * S} h${0.2 * S} v${0.14 * S} h${-0.6 * S} z`}
                fill={bodies ? "#1a1a1d" : shade(maskHex, -0.35)}
                stroke={silk}
                strokeWidth={1.2}
                opacity={0.85}
              />
            )}
            <circle cx={cxk} cy={cyk} r={choc ? 9 : 11} fill="none" stroke={copper} strokeWidth={3} />
            <circle cx={cxk + (choc ? 0 : -0.2 * S)} cy={cyk - 0.21 * S} r={5.5} fill={copper} />
            <circle cx={cxk + (choc ? 0.26 * S : 0.13 * S)} cy={cyk - (choc ? 0.13 : 0.26) * S} r={5.5} fill={copper} />
            <rect
              x={cxk + 0.2 * S}
              y={cyk + 0.3 * S}
              width={0.12 * S}
              height={0.06 * S}
              fill={bodies ? "#111" : "none"}
              stroke={silk}
              strokeWidth={1}
              opacity={0.8}
            />
            {bodies && (
              <g transform={`translate(${it.x * S} ${it.y * S})`} opacity={0.96}>
                <SwitchArt w={it.w * S} h={it.h * S} stem={stem} />
              </g>
            )}
          </g>
        );
      })}
      {res.holes.map((h) => (
        <g key={`${h.x}-${h.y}`}>
          <circle cx={h.x * S} cy={h.y * S} r={(HOLE.pad / 2) * MM} fill={copper} stroke={h.clash ? "#c8281e" : "none"} strokeWidth={4} />
          <circle cx={h.x * S} cy={h.y * S} r={(HOLE.drill / 2) * MM} fill="#e9e9e6" />
          {bodies && <ScrewHead x={h.x * S} y={h.y * S} />}
        </g>
      ))}
      {mcu && <McuArt res={res} bodies={bodies} silk={silk} />}
      {spec.pcb.logo ? (
        <image
          href={fileUrl(spec.pcb.logo.key)}
          x={(p.x + p.w) * S - 1.4 * S}
          y={(p.y + p.h) * S - 0.5 * S}
          width={0.8 * S}
          height={0.4 * S}
          preserveAspectRatio="xMaxYMax meet"
          opacity={0.92}
        />
      ) : (
        <text
          x={(p.x + p.w) * S - 0.55 * S}
          y={(p.y + p.h) * S - 12}
          textAnchor="end"
          fontFamily="Geist Variable, sans-serif"
          fontSize={14}
          fontWeight={600}
          fill={silk}
          opacity={0.8}
        >
          madebyanirudha
        </text>
      )}
    </g>
  );
}

/* ----------------------------------------------------------------- Board */

export type BoardMode = "keys" | "pcb" | "case";

interface BoardArtProps {
  spec: BuildSpec;
  mode?: BoardMode;
  legends?: boolean;
  className?: string;
  /** Room around the case (u). */
  pad?: number;
  /** Smallest view (u), so a 2-key pad isn't blown up to fill a big stage. */
  minView?: { w: number; h: number };
  /** PCB mode: populated parts instead of bare footprints. */
  bodies?: boolean;
  /** Glow and label the USB-C port. */
  highlightUsb?: boolean;
  title?: string;
}

/** The whole build as one lit object: floor shadow, case, PCB or keys. */
export function BoardArt({
  spec,
  mode = "case",
  legends,
  className = "showpiece",
  pad = 0.9,
  minView,
  bodies = false,
  highlightUsb = false,
  title,
}: BoardArtProps) {
  const uid = useId().replace(/:/g, "");
  const res = resolve(spec);
  const items = spec.layout.items;
  const o = res.outline;
  const frame = mode === "pcb" ? res.pcb : o;
  const fw = Math.max(frame.w + pad * 2, minView?.w ?? 0);
  const fh = Math.max(frame.h + pad * 2 + 0.3, minView?.h ?? 0);
  const vx = (frame.x + frame.w / 2 - fw / 2) * S;
  const vy = (frame.y + frame.h / 2 - fh / 2) * S;

  const caps = capsOf(spec);
  const palette = colorwayById(caps.colorway);
  const profile = capProfileById(caps.profile);
  const showLegends = legends ?? caps.legends;
  const sw = switchById(spec.electronics.switchId);
  const bare = !profile ? { stem: SWITCH_STEM[sw?.feel ?? "Linear"] } : null;

  return (
    <svg
      className={className}
      viewBox={`${vx} ${vy} ${fw * S} ${fh * S}`}
      role="img"
      aria-label={title ?? `${spec.name}: ${items.filter((i) => i.kind === "key").length}-key board`}
    >
      <BoardDefs uid={uid} />
      <rect
        x={(frame.x + frame.w * 0.04) * S}
        y={(frame.y + frame.h * 0.18) * S}
        width={frame.w * 0.92 * S}
        height={frame.h * 0.95 * S}
        rx={60}
        fill="rgb(20 20 22 / 0.32)"
        filter={`url(#floor-${uid})`}
      />

      {mode === "case" && <CaseArt spec={spec} res={res} uid={uid} />}
      {mode === "pcb" && <PcbArt spec={spec} res={res} bodies={bodies} />}

      {mode !== "pcb" &&
        items.map((it) => (
          <g key={it.id} transform={`translate(${it.x * S} ${it.y * S})`}>
            <KeyArt item={it} palette={palette} legends={showLegends} bare={it.kind === "key" ? bare : null} profile={profile} />
          </g>
        ))}

      {mode === "case" && <UsbMarker res={res} uid={uid} highlight={highlightUsb} />}
    </svg>
  );
}
