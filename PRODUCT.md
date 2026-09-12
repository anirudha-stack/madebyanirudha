# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (TypeScript, Tailwind v4, MDX content collections, `@fontsource` fonts,
Astro `<Image>` for build-time optimisation, Biome). Interactive islands
(React/Svelte) only where a component genuinely needs client JS — gallery
lightbox, cart. Decided 12 Sept 2026 over Next.js because the site is content,
not an app; do not reopen.

Deploys as static assets on Cloudflare Workers (`wrangler.jsonc`, GitHub
Actions). When the store needs server routes, `@astrojs/cloudflare` runs only
those routes as a Worker. See `how_to_deploy_website.md`.

## Users

**Primary: fellow makers and hobbyists.** People who want to build what
Anirudha built. They arrive from a search, a forum link, or a video, land on a
guide or build log, and want to know: what was made, exactly how, what broke,
and whether they can get the parts or files. When a page must choose between
audiences, this one wins.

**Secondary: recruiters and collaborators.** Engineers, hiring managers, and
potential co-founders evaluating Anirudha's ability. They arrive at the home
page or a project, skim, and need to see breadth and depth quickly — real
hardware, real firmware, real software, finished.

**Tertiary: buyers.** People who found a specific thing Anirudha makes and want
to purchase it. The store serves them, but the site is not store-first.

## Product Purpose

madebyanirudha.in is a portfolio of who Anirudha is as a maker, in four parts:

1. **Home / about** — who Anirudha is and what they build.
2. **How-to guides** — step-by-step instructions to reproduce a build.
3. **Day-in-my-life blog** — build logs and notes: what was made, how it went,
   what broke.
4. **Store** — a real shop for the things Anirudha makes.

Success: a maker leaves able to build the thing (or buys the kit/files to);
a recruiter leaves convinced of the skill; the site stays free to run and
"add a post = add a file" easy to maintain.

## Positioning

**Full stack of the object.** One person designs the circuit board, the
enclosure, the firmware, and the software — the whole device, not one layer of
it. Every project on the site is evidence for that claim, and the guides and
store exist because the whole stack is available: gerbers, STLs, firmware, and
the assembled thing itself.

## Operating Context

- Content is photography-first and text-heavy: guides and logs are long-form
  with many images.
- Content authoring is file-based: MDX files in content collections, validated
  at build time.
- Store fulfilment: physical goods ship to the buyer; digital files are
  downloads. Payments run through a hosted checkout (Razorpay or Stripe);
  large downloads (STL, gerber, PDF) are served from Cloudflare R2 so a
  popular file never generates a bill.
- Hosting must remain free: static assets are unmetered; only Worker-executed
  routes count against the 100k req/day free limit.
- Launch is 14 September 2026 (a coming-soon page with a countdown is live
  today at `public/index.html`).

## Capabilities and Constraints

Confirmed:

- Four sections as above; all content in Astro content collections.
- Store sells **physical things Anirudha makes** (assembled PCBs, printed
  parts, finished devices), **kits** (parts + instructions), and **digital
  files** (STL, gerbers, firmware, PDFs).
- Dark mode from day one; view transitions; small interactive islands only
  (lightbox, cart).
- Free-tier constraints: 10 ms CPU per Worker request; no image processing,
  PDF generation, or CAD manipulation server-side.
- Canonical domain: `madebyanirudha.in` (`www` to be 301'd once a Worker
  script exists).

Undecided (record, do not invent):

- Which checkout provider (Razorpay vs Stripe).
- Which database when one is needed (D1 vs Neon).
- Specific products, prices, and shipping regions.
- Social profile links (GitHub, LinkedIn placeholders are commented out in the
  coming-soon page).

Terminology: "guide" (how-to, reproducible), "log" / "build log" (blog entry,
narrative), "project" (a finished thing, may have both), "store".

## Brand Commitments

- Name: **madebyanirudha** / "made by Anirudha". Domain `madebyanirudha.in`.
- Contact: gaikwadaniruddha17@gmail.com (public on the site).
- **Nothing visual from the coming-soon page is binding.** The green accent,
  PCB-trace motif, and monospace voice were placeholders; the real site starts
  fresh.
- **Standing visual preference: the category standard, played straight**
  (chosen 12 Sept 2026 in the home direction round after re-rolling past
  kit-box, exploded-view, printed-scope-capture, and layered-papercut
  directions). Anirudha wants the site to read as a senior engineer's: modest,
  modern, intriguing through precision rather than metaphor. No concept
  costume (no PCB motif, no instrument chrome, no arc-reactor rings). The
  craft bar is the combination of: senior-engineer personal sites (rauno.me,
  paco.me, brianlovin.com, rsms.me: typographic restraint, small exact
  interactions), product-company marketing sites (linear.app, vercel.com,
  raycast.com: grid polish, whitespace, crisp imagery), maker community sites
  (hackaday.io, adafruit learn: content density, practicality), and
  photography-first portfolios (teenage.engineering, tomsachs.com: the object
  leads). Future direction rounds start from this commitment rather than
  re-offering foreign worlds.

## Evidence on Hand

Exists (not yet in the repo — Anirudha will supply):

- Project photographs of finished builds and work in progress.
- Written build logs and notes, drafted elsewhere.
- Completed projects with files (repos, CAD, PCB) that can be linked or
  published.

Absent — do not fabricate:

- Testimonials, customer quotes, press, sales numbers, download counts.
- Product listings and prices.

## Product Principles

1. **The build is the proof.** Show the real thing — photos, files, code —
   before describing it. Every claim of capability points at a project.
2. **Reproducible over impressive.** A guide succeeds when someone else
   builds it. Precision, part lists, and failure notes outrank polish.
3. **Whole device, one maker.** Present PCB, enclosure, firmware, and software
   as one object, not four disciplines.
4. **Adding content must stay trivial.** One file per post; no design work
   required to publish.
5. **Free to run, forever.** No architecture or feature may introduce a
   usage-based bill.
