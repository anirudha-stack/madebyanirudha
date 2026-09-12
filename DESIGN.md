---
name: made by Anirudha
description: A maker portfolio played straight — one column, hairlines, ink on near-white, and the photograph doing the persuading.
colors:
  paper: "#ffffff"
  ink: "#151517"
  graphite: "#66666c"
  hairline: "#e3e3e6"
  kapton: "#b8780a"
  kapton-wash: "#f3e2b8"
  paper-dark: "#0f0f10"
  ink-dark: "#ececee"
  graphite-dark: "#9a9aa1"
  hairline-dark: "#27272b"
  kapton-dark: "#f0b429"
  kapton-wash-dark: "#4a3a10"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  display-lg:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline-lg:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  title-lg:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  lede-lg:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  prose:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  section-label:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  ledger-term:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  ledger-fact:
    fontFamily: "Schibsted Grotesk Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Cascadia Mono, Menlo, monospace"
    fontSize: "0.875em"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
    fontVariation: "tabular-nums"
rounded:
  none: "0px"
spacing:
  gutter: "20px"
  gutter-lg: "32px"
  ledger-gap: "24px"
  row: "16px"
  row-lg: "20px"
  block: "24px"
  section: "48px"
  section-lg: "64px"
  section-xl: "80px"
  footer-top: "96px"
components:
  link-text:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  link-text-hover:
    textColor: "{colors.ink}"
  link-nav:
    textColor: "{colors.ink}"
    typography: "{typography.section-label}"
  wordmark:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  ledger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ledger-fact}"
    padding: "16px 0 0 0"
  ledger-term:
    textColor: "{colors.graphite}"
    typography: "{typography.ledger-term}"
  post-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "20px 0"
  section-label:
    textColor: "{colors.graphite}"
    typography: "{typography.section-label}"
  code-block:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "16px 20px"
---

# Design System: made by Anirudha

## Overview

**Creative North Star: "The Bench Notebook"**

A senior engineer's personal site played straight: one column of text and hairlines on near-white paper, with a wide photograph slot where the object itself does the persuading. Nothing is dressed up. There are no cards, no panels, no gradients, no shadows; the only ornament is a single kapton-amber accent that appears on marks (a hover rule, a focus ring, an arrow) and never on running text. Ink and paper invert cleanly at night: the dark scheme follows the OS and keeps the same structure, only the surface changes.

Density is editorial rather than dashboard. Sections are separated by space (48–96px) and by 1px rules, never by boxes. Type carries the hierarchy with two weights (400, 500) and tight heading tracking; the home line is deliberately small (24/32px) so the photograph, not the person, leads; JetBrains Mono appears only where a number needs to line up (dates, the footer year). Motion is nearly absent: one authored cross-document view transition carries the flagship photograph from the home page into its project page, and link rules lift on hover. Nothing else enters, fades, or parallaxes.

Confirmed visual rejections: the dark-neon dev portfolio with a repo-card grid, the cream editorial studio page, PCB-trace motifs, terminal or instrument chrome, hero gradients and glows, countdowns, invented numbers, and kicker/eyebrow labels above headings.

**Key Characteristics:**
- One column, 70rem measure, 20/32px gutters, left-aligned throughout.
- Neutrals plus one accent (kapton amber) reserved for interactive marks.
- Light by default, dark by OS `prefers-color-scheme`; same tokens, swapped values.
- Grouping by hairline rules and space; no cards, no fills, no shadows.
- Square corners everywhere; photographs edge-to-edge within the measure, full-bleed on phones.
- Type ramp in Schibsted Grotesk at 400/500/600; mono only for dates and numbers.
- One motion: the flagship cover's view transition. Hover moves the link rule; nothing else moves.

## Colors

Two neutrals and a rule colour form the page; a single warm amber is held back for marks. The dark scheme is a second set of the same six tokens, selected by the OS.

### Primary
- **Kapton Amber** (`{colors.kapton}`; dark `{colors.kapton-dark}`): the only chromatic colour. Used for the focus-visible ring (2px outline, 3px offset), the link underline on hover, and the arrow glyph after "See the build". Never used for text, headings, backgrounds, or icons at rest. In dark mode it brightens to a lighter amber so the mark stays legible on near-black.
- **Kapton Wash** (`{colors.kapton-wash}`; dark `{colors.kapton-wash-dark}`): text-selection background only. A pale tint of the accent so selected text reads as the same material.

### Neutral
- **Paper** (`{colors.paper}`; dark `{colors.paper-dark}`): the page background. Pure white by day, near-black at night. There is no second surface colour: every region sits on the same paper.
- **Ink** (`{colors.ink}`; dark `{colors.ink-dark}`): all headings, body text, the wordmark, ledger facts, and the "Stand-in" flag. Also the underline colour for the current nav item.
- **Graphite** (`{colors.graphite}`; dark `{colors.graphite-dark}`): secondary text. Ledes, summaries, dates, section labels, ledger terms, the footer year line, descriptions in lists. Reads as a quieter voice, never as disabled.
- **Hairline** (`{colors.hairline}`; dark `{colors.hairline-dark}`): every 1px rule (ledger top, list rows, footer top, code-block border), the resting link underline, and the scrollbar thumb. This is the structural colour of the site.

### Named Rules
**The Marks-Only Rule.** Kapton amber appears only on interactive marks: the hover underline, the focus ring, the arrow after a primary link. It is never the colour of a word, a heading, a background, or a decorative shape. If a screen shows amber at rest with nothing to hover or focus, it is wrong.

**The One Surface Rule.** The whole page is one background. There are no tinted panels, no card fills, no alternating bands. Regions are told apart by a hairline and by space.

**The Scheme Follows the OS Rule.** Dark mode is `prefers-color-scheme` on the same six tokens; there is no toggle and no third theme. Every new colour must be authored as a light/dark pair or not at all.

## Typography

**Display Font:** Schibsted Grotesk Variable (with system-ui, Segoe UI, sans-serif)
**Body Font:** Schibsted Grotesk Variable (same family)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, Cascadia Mono, Menlo, monospace)

**Character:** One grotesk at three weights does everything; the mono is a measuring instrument, not a voice. Display sizes are tracked tight (-0.03em) and set at weight 600 so the identity line reads as a statement; every other heading drops to 500 and -0.02em to -0.03em. Body is 16px at 1.5 line-height with `text-wrap: pretty`; headings use `text-wrap: balance`.

### Hierarchy
- **Display** (500, 24px phone / 32px desktop, 1.2, -0.02em): the home line only, "Software for money. Hardware for heart." One line; modest by intent, never a job title at billboard size.
- **Headline** (500, 32px phone / 44px desktop, 1.08, -0.03em): page titles on project, log, guide, and index pages.
- **Title** (500, 24px phone / 28px desktop, -0.02em): the flagship project name under its photograph. Also `.prose` h2 at 24px.
- **Subtitle** (500, 18px): supporting-project titles on the home page and `.prose` h3.
- **Lede** (400, 18px phone / 20px desktop, 1.5, graphite): the paragraph under the identity line (max 58ch) and page descriptions (18px, max 60ch).
- **Body** (400, 16px, 1.5): list rows, summaries, defaults. Long-form `.prose` is 17px at 1.6 in a 68ch measure with 1.25em paragraph spacing.
- **Section label** (400, 15px, graphite): "Also built", "Build logs", "How-to guides". A plain h2 in the muted colour, no caps, no tracking, no kicker.
- **Ledger** (term 400, 13px, graphite / fact 500, 15px, 1.375, ink): the four-layer caption.
- **Small** (400, 13–14px, graphite): the "Stand-in" note, project date lines, "All logs" links.
- **Mono** (400, 0.875em of parent, tabular-nums, 0 tracking): `<time>` elements and `.num`; `.prose` code and 14px `pre` blocks.

### Named Rules
**The Two Weights Rule.** 400 for text, 500 for headings, the wordmark and emphasised facts. No 300, no 600+, no italics as hierarchy; size and colour do the rest.

**The Mono Measures Rule.** JetBrains Mono is for dates, years, numbers, and code. It is never a heading, a label, or a stylistic voice.

**The No-Kicker Rule.** Nothing sits above a heading. No uppercase eyebrow, no category tag, no tracked-out label. A section is named by a 15px graphite h2 and nothing else.

## Layout

A single centred column with a 70rem (1120px) measure and 20px gutters on phones, 32px from the `sm` breakpoint (640px) up. Header 56px / 64px and footer share the same measure and gutters as `main`, so the wordmark, the left edge of the identity line, the photograph, the ledger, and the footer links all sit on one left edge. Everything is left-aligned; the only right-aligned items are the nav, the "See the build" link, and the footer year, each on the far edge of a justified row.

Vertical rhythm is in 4px steps with a small set of recurring gaps: 4px between a term and its fact, 16–20px between list rows, 24px between a photograph and its ledger, 48/64px above the identity block (now 48/64px, the block itself shorter), 80px between home sections, 96px above the footer. Text blocks are capped by character measure (58–60ch lede, 68ch prose), not by column width; the display line is a single short sentence.

Responsive behaviour is one breakpoint, `sm` (640px). Below it: gutters narrow to 20px, photographs go full-bleed (negative 20px margins) while text stays in the gutter, the ledger stacks 2×2, the two-column log/guide section and the supporting-project grid stack to one column, and post rows stack date under title. Above it: the ledger spreads to four columns with 24px gaps, logs and guides sit side by side in a two-column grid with 48px gap, and the dated post list gains a fixed 136px date column.

Photographs are 16:10, object-fit cover, sized to the measure (1120px) with responsive widths from 640 to 2240px. Gallery images sit in a two-column grid with 24px gaps.

## Elevation & Depth

Flat. There are no box shadows, no drop shadows, no blur, no layered surfaces, and no tonal layering: one paper colour, one ink. Depth is not conveyed at all; hierarchy is conveyed by type size and weight, by the graphite/ink contrast, and by 1px hairline rules that mark where a group starts (rule above the ledger, above each list, above the footer). Photographs sit flush on the page without frame, inset, or shadow. In dark mode a photograph's edge is defined only by its own content against near-black.

### Named Rules
**The No-Shadow Rule.** Nothing casts a shadow, at rest or on hover. A new surface that needs separation gets a hairline, not an elevation.

## Shapes

Square. Every rectangle on the page has 0px radius: photographs, code blocks, the ledger, list rows, the header. There is no pill, chip, tag, or badge. Borders are 1px in the hairline colour and appear only on one edge (top of a group, bottom of a list row) or around a code block; nothing is fully boxed except `pre`. The single exception in the CSS is the focus-visible outline, which carries a 2px radius so the ring does not look sharper than the text it surrounds. Clipping is limited to `overflow-x: auto` on code and `object-fit: cover` on 16:10 photographs.

## Components

The site has no buttons, inputs, chips, or cards. Its components are links, lists, and the ledger.

### Text link (`.link`)
- **Character:** a rule that sits low and lifts to the accent.
- **Shape:** inline text, 1px underline in the hairline colour at 0.2em offset.
- **Hover:** underline colour becomes kapton amber and the offset moves to 0.3em, both over 160ms with a `cubic-bezier(0.2, 0, 0, 1)` ease. The text colour does not change.
- **Focus:** 2px kapton outline, 3px offset, 2px radius (global `:focus-visible`).
- **Current page (nav):** underline in ink instead of hairline.
- **Primary link variant:** "See the build" is a `.link` span followed by a kapton `→` glyph (`aria-hidden`). This is the only place the accent appears at rest, and it is a mark, not a word.
- **Prose links:** same underline and hover, without the offset movement.

### Navigation
- **Header:** 56px (64px from `sm`), flex row, wordmark left at weight 500 with -0.01em tracking, nav list right at 15px with 24px gaps. No logo mark, no background, no bottom rule. Items are plain `.link`s: Guides, Logs (each only when its collection has a non-draft entry), Email. Store is absent until something is purchasable.
- **Footer:** 96px top margin, 1px hairline top, 24px padding above, 15px text. Email plus Instructables, Instagram, YouTube as `.link`s on the left; on the right the year in mono followed by "· made by Anirudha" in graphite. Wraps on phones with 12px row gap.

### Ledger (signature component)
- **Character:** the four layers of a device stated as facts. This is the site's recognisable component and the proof of "one person, whole device".
- **Structure:** a `<dl>` with a 1px hairline above and 16px padding-top. Four `<div>`s each holding a `<dt>` (PCB, Enclosure, Firmware, Software) and a `<dd>`.
- **Grid:** 2×2 on phones (24px column gap, 20px row gap), four columns from `sm`.
- **Type:** term 13px graphite weight 400; fact 15px ink weight 500, line-height 1.375, 4px below the term.
- **Placement:** 24px below the photograph it captions, on both the home page and the project page.

### Dated post list
- **Character:** a ledger of entries, not cards.
- **Structure:** `<ul>` with a hairline top; each `<li>` has a hairline bottom and 16px (home) or 20px (index) vertical padding. The whole row is one `<a>`.
- **Index variant (`PostList`):** two columns from `sm`: 136px mono date in graphite, then title (17px `.link`) with a 15px graphite description beneath.
- **Home variant:** title as `.link` on the left, mono date in graphite on the right, stacked on phones.

### Photograph slot
- **Shape:** 16:10, object-fit cover, full measure (1120px) on desktop, full-bleed on phones via negative gutter margins.
- **Home flagship:** eager, high-priority, the whole image is a link to the project route, with `view-transition-name: flagship-cover`.
- **Project page:** same slot, same transition name, so the cross-document `@view-transition { navigation: auto }` carries the photograph from home into the project. Disabled under `prefers-reduced-motion`.
- **Supporting projects:** 16:10 in a two-column grid with 40px gap, title 18px `.link` beneath, 15px graphite summary.

### Section label
- **Style:** a 15px h2 in graphite at weight 400, with an optional 14px `.link` ("All logs") on the same baseline at the right. A hairline and 16px of space separate it from the list below.

### Code block (`.prose pre`)
- **Style:** 1px hairline border, square corners, 16px 20px padding, 14px mono at 1.55, horizontal scroll. No background fill.

## Do's and Don'ts

### Do:
- **Do** keep everything on one paper surface and separate groups with a 1px hairline in `{colors.hairline}` or with space (48/64/80/96px), never with a fill.
- **Do** reserve kapton amber for the hover underline, the focus ring, and the arrow after a primary link.
- **Do** author every colour as a light/dark pair on the six tokens (`--bg`, `--fg`, `--muted`, `--rule`, `--accent`, `--selection`) and let `prefers-color-scheme` select it.
- **Do** set headings, the home line and the wordmark at 500 with -0.02em to -0.03em tracking and text at 400; stop at those two weights.
- **Do** put dates, years, and numbers in JetBrains Mono with tabular figures at 0.875em, and leave every word in Schibsted Grotesk.
- **Do** run photographs edge-to-edge at 16:10 within the 70rem measure, full-bleed on phones, square, unframed.
- **Do** caption a device with the Ledger: hairline above, four terms over four facts, 2×2 on phones.
- **Do** cap text by measure (58–60ch lede, 68ch prose) rather than stretching it to the column.
- **Do** supply flagship photographs shot or cropped on a mid-grey or dark surface, since the slot has no inset or hairline in dark mode.

### Don't:
- **Don't** put a kicker, eyebrow, uppercase tag, or tracked-out label above any heading.
- **Don't** draw PCB traces, circuit motifs, instrument chrome, terminal windows, or any concept costume.
- **Don't** use gradients, glows, blurs, or box shadows anywhere, at rest or on hover.
- **Don't** wrap content in cards, tiles, or panels; no repo-card grids, no bordered boxes except `pre`.
- **Don't** round a corner; the only radius in the system is the 2px on the focus ring.
- **Don't** add a countdown, a metric, a testimonial, a logo wall, or any number that is not a fact about a build.
- **Don't** use amber for text, headings, backgrounds, or icons at rest.
- **Don't** add motion beyond the flagship cover's view transition and the link-rule hover; nothing fades in, slides, or parallaxes.
- **Don't** show a nav item for an empty section, and don't add Store until a product is purchasable.
- **Don't** use a system display face, glyph icons, or an icon font; the arrow after "See the build" is a text glyph and the site has no other icons.
