---
name: madebyanirudha store
description: Showroom configurator. The keyboard stands lit on a grey studio sweep while white option panels stack beside it; one solder-orange action.
colors:
  sweep-top: "#efefec"
  sweep-bottom: "#dfdfdb"
  panel: "#ffffff"
  panel-sunk: "#f5f5f3"
  ink: "#141416"
  graphite: "#66666c"
  muted: "#8d8d93"
  line: "#e5e5e2"
  line-strong: "#d3d3cf"
  accent: "#ff5a1f"
  accent-press: "#ec4a10"
  accent-wash: "#ffe6dc"
  bad: "#c8281e"
  bad-ink: "#8f1d15"
  warn-wash: "#fdf1e1"
  warn-ink: "#8a4507"
  status-progress: "#9a5b00"
  airwire-matrix: "#ffb08f"
  airwire-matrix-legend: "#ff9a70"
  airwire-extra: "#7fd6ff"
  airwire-extra-legend: "#3fb8ff"
  render-ink: "#1b1b1d"
typography:
  ui: "Geist Variable, 15px/1.5, weights 400–600"
  display: "Geist Variable 600, -0.02 to -0.035em, 24–44px"
  measure: "Geist Mono Variable, tabular-nums: prices, mm, u, order numbers only"
rounded:
  micro: "4px"
  key: "5px"
  chip: "8px"
  segment-inner: "11px"
  tile: "9px"
  panel: "14px"
  pill: "999px"
---

# Design System: madebyanirudha store

A separate product from madebyanirudha.in. Do not borrow the main site's DESIGN.md.

## North star: "The Showroom"

The board is the object under the studio lights. Every screen sits on one grey sweep (`.studio`), a light vertical falloff with a soft pool of light at the floor. The build is drawn as a lit object on it: keycaps have a skirt, a lighter top face and a sheen, and a blurred floor shadow sits under the whole board. Options live in white panels with soft, offset studio shadows. Light only, because the scene is a lit desk in the evening.

## Colour rules
- **Solder orange is for action and change only:** the primary button (ink text on orange, never white text on orange, which fails contrast), the selection outline and drag ghost in the editor, the price flash, and accent keycaps (Esc/Enter). Never decorative fills.
- Red (`bad`) marks invalid items only: overlapping keys are struck through and the blocker notice uses it.
- Case, PCB-mask and keycap colours come from `shared/catalog.ts`; the UI never invents product colours.

## Type rules
- Geist does everything. Geist Mono only where a number is measured or priced.
- Headings sit in the rail head (24px) and page heads (34px), with no kickers above them.

## Layout
- Configurator: 60px top bar (wordmark, build name, five step pills, save state, live price) over a stage (1fr) and a 392px white rail. The rail scrolls; its foot (price + Continue) is fixed.
- The stage shows one thing per step: the editor (Layout), the lit 2D render (Electronics, Case), the PCB render (PCB), or the 3D turntable (Review).
- Desktop-only below 960px: a full-screen "Best on a bigger screen" notice.

## Components
- **Tile** (`.tile`): radio/option card; checked = 1px ink ring. Price right-aligned in mono.
- **Swatch** (`.swatch`): 40px colour chip with inner shading; checked = ink ring with a white gap.
- **Segmented** (`.segmented`), **switch** (`.switch`), **chips** (`.chip`, mono, for u-sizes).
- **Price** (`ui/Price.tsx`): per-digit rolling strips; flashes accent-press on change.
- **BoardArt** (`ui/Board.tsx`): the only way a build is drawn in 2D (cards, thumbs, stage, ticket).

## Board views
- **Layout:** the case outline is drawn as a solid ink line with eight handles (orange on hover/drag), the PCB edge as a dashed inset, the size in mm above it. The controller shows as a ghost; it turns red when keys sit on it.
- **Electronics:** the PCB view with keycaps ghosted at 30%, dashed air-wires from the controller (orange for rows/columns, blue for knobs and screen), and the USB-C port glowing orange on the wall with a pill label. Red when the port doesn't reach the edge.
- **PCB / studio 3D:** layers toggle from the stage toolbar (2D/3D, component bodies; case, keycaps). The choice is a per-viewer preference shared by both steps.
- Colours inside renders (mask, case finishes, caps, module boards) come from the catalog or the render constants in `ui/Board.tsx`, not the UI palette.

## Motion
One signature: the key snap. A dragged key lifts (scale 1.035, deeper shadow) and follows the pointer freely while a dashed orange ghost shows its 0.25u landing; on release it settles with a 180ms overshoot. Everything else is small: price roll (520ms ease-out), card lift on hover, the step render fading in. Reduced motion collapses all of it.
