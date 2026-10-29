---
version: 1
slug: "store-src-app-tsx"
primary_target: "store/src/App.tsx"
related_targets: ["store/index.html"]
---

# Store: keyboard kit configurator (store.madebyanirudha.in)

Scope: the whole store app: login, builds dashboard, configurator (layout editor → electronics → PCB → case → review with 3D), fake checkout, orders and the admin job queue. Visitor mode: **Operate**. A separate product from madebyanirudha.in, which means the main site's DESIGN.md does not apply here.

Audience: people who want a custom keyboard or macropad but lack the PCB/CAD/sourcing skills, plus makers who want to skip that work. They use a desktop for 10–30 minutes in a lit room in the evening. Job: arrange keys, pick parts, see the price, order a DIY kit. Proof: the board they drew, lit and turning, with an itemised BOM. Constraints: desktop-only v1, INR, fake payment, admin-only password login.

## Direction contract

THESIS: Your keyboard stands lit in the middle of a quiet studio while the choices stack calmly beside it. It refuses the product-grid-plus-cart shop and the dark RGB gamer store.

OWN-WORLD: Studio-grey sweep (#ECECEA → #E2E2DF floor) holding white option panels; ink #141416, graphite #74747A; one hot "solder orange" #FF5A1F reserved for the primary action and live price change. 14px-radius tiles with soft, offset studio shadows; Geist for UI text and Geist Mono only for measurements (u, mm, ₹). Keys are drawn as real keycaps, with top-face highlight and a floor shadow.

STORY: The visitor picks a starting shape and sees it lit. Keys snap together like bricks. They step through Electronics, PCB and Case while the price ticks. On Review the board turns in 3D, and they pay (simulated) and get a kit order.

FIRST VIEWPORT: a 56px top bar (wordmark left, five step tabs centred, live price right). The stage takes about 70% of the width: the board centred on the grey sweep with its floor shadow and the editor grid faint underneath. A 380px white right rail holds the grouped options for the current step, with a sticky Continue (orange) and price at the rail foot.

SIGNATURE INTERACTION: the key snap. While dragging, a dashed ghost shows on the 0.25u grid; on release the key settles with a 140ms overshoot and its shadow lands. The price rolls in tabular digits.

FORM: Showroom Configurator, #1 on my ordered list (IMPECCABLE’S PICK), seed key 1899e199.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Real generator module (PCB company API), case STL/DXF generator.
- Real payment provider (Razorpay later).
