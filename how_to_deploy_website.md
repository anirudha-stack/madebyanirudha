# How to Deploy This Website

**Audience:** a coding agent working inside this repository.
**Scope:** deployment, infrastructure, CI/CD, and abuse/billing protection.
**Out of scope:** site content and visual design.

> **History.** This document previously specified Google Cloud Run. That stack
> was sound but was abandoned before anything was deployed, for one reason: it
> requires a billing account, and usage-based billing means a traffic spike is a
> bill. The current stack cannot bill you. §1 records the full reasoning so the
> decision is not silently re-litigated later.

---

## 1. Decisions

| Concern | Decision | Rationale | Rejected |
|---|---|---|---|
| Compute + hosting | **Cloudflare Workers** with Static Assets | Static-asset requests are free *and unlimited* — they never invoke the Worker. Free plan limits **hard-stop**, they do not bill. The same product serves the full-stack app later with no migration. | **Cloudflare Pages** — Cloudflare now directs new projects to Workers; all investment goes there. Choosing Pages buys a future migration for nothing. |
| | | | **Cloud Run** — excellent, but needs a billing account and a card. Unbounded liability requires a maxScale cap, budget alerts and a kill switch to contain. All that machinery to serve a static page. |
| | | | **Vercel Hobby** — free tier **bans commercial use**. Their definition covers processing payment, carrying ads, and being paid to build the site. A store violates it outright. |
| | | | **Render** free — spins down after 15 min; 30–60 s cold start on the visit that matters. **Koyeb** — free Postgres gets 5 compute-hours/month, and free instances run only in Frankfurt/Washington. |
| DNS / TLS / CDN | **Cloudflare Free** | Already authoritative for the domain. The Worker *is* the edge, so there is no origin to hide or protect. | Bare registrar DNS — no proxy, no WAF, no cache. |
| Relational data (future) | **Neon Free** (Postgres) or **Cloudflare D1** (SQLite) | Neon: real Postgres, scales to zero, no idle pause. D1: native to Workers, zero-config, free, but SQLite and hard-capped. | **Supabase Free** — pauses after **7 days idle**. A portfolio sits quiet for weeks; the database would be asleep exactly when a visitor arrives. Also only 5 GB storage egress/month. |
| Blob storage (future) | **Cloudflare R2** | **Zero egress fees, always.** Decisive for STL / gerber / PDF downloads — one popular file cannot generate a bill. S3-compatible, so no vendor SDK enters application code. | S3 / GCS — egress billed. Streaming large files through the app server — wasteful and slow. |
| Secrets (future) | **Worker secrets** (`wrangler secret put`) | Encrypted at rest, injected as bindings, rotatable without a redeploy. | Anything committed to the repo. Ever. |
| CI/CD | **GitHub Actions** → `wrangler deploy` | Version-controlled and reviewable in a PR. PRs upload a *preview version* that takes no traffic. | Cloudflare **Workers Builds** (dashboard git integration) — fine, and needs no API token, but the deploy logic then lives outside the repo. |

**Total fixed cost: the domain only** (~₹900/yr). Everything else is free at
personal-site traffic, and the free limits stop rather than bill.

---

## 2. What is deployed today

A single static page. `wrangler.jsonc` has **no `main` entry point**, so
Cloudflare serves `./public` straight off the edge — the Worker is never
invoked, nothing is billable, and there is no request cap.

```
public/index.html   the page
public/_headers     cache + security headers
wrangler.jsonc      the entire infrastructure definition
```

That is the whole deployment. There is no container, no server, no origin.

---

## 3. Accounts and exact tier names

| Service | Exact tier | Allowance that matters here |
|---|---|---|
| Cloudflare Workers | **Workers Free** | 100,000 **Worker script** requests/day · 10 ms CPU per request · **static assets are free and unlimited** |
| Cloudflare DNS / CDN / WAF | **Cloudflare Free** | Unlimited cached bandwidth · free managed WAF · Bot Fight Mode · one rate-limiting rule |
| Cloudflare R2 (future) | **R2 Forever Free** | 10 GB-month storage · 1M Class A ops · 10M Class B ops · **zero egress, always** |
| Cloudflare D1 (future) | **D1 Free** | 5 GB storage · 5M rows read/day |
| Neon (future) | **Neon Free** | ~0.5 GiB storage · ~190 compute-hours/month · scales to zero, no idle pause |
| GitHub Actions | **GitHub Free** | Unlimited minutes on public repos; 2,000 min/month private |

> **These numbers drift.** Verify against the live pricing page at setup. The
> *relative ordering* of these choices is stable even when absolute limits move.

**Account note:** the Cloudflare zone and the Worker **must live on the same
account** — a Worker can only take a custom domain from a zone it can see. Both
are on `madebyanirudha@gmail.com` (account `311a06c5…`), *not* the personal
Google account. Logging `wrangler` into the wrong account produces a confusing
"zero zones" symptom that looks like the domain was never added.

---

## 4. Deploying

```bash
npm ci
npx wrangler login      # once, as madebyanirudha@gmail.com
npx wrangler deploy
```

`wrangler.jsonc` declares both custom domains. Cloudflare creates and manages
their proxied DNS records itself — including evicting whatever was there before.

Validate a change without deploying:

```bash
npx wrangler deploy --dry-run   # no credentials needed
npx wrangler dev                # local preview on localhost:8787
```

---

## 5. CI/CD

`.github/workflows/ci.yml` — on pull request:

- `validate` — `npm ci`, `wrangler deploy --dry-run`, content assertion.
  **Needs no credentials**, so it is green on a fresh clone.
- `preview` — uploads a version that takes **no traffic** and comments the
  preview URL on the PR. Skipped until `CLOUDFLARE_ACCOUNT_ID` is set.

`.github/workflows/deploy.yml` — on push to `main`: `wrangler deploy`, then a
smoke check against the live domain.

**Required GitHub configuration:**

| Kind | Name | Value |
|---|---|---|
| Variable | `CLOUDFLARE_ACCOUNT_ID` | `311a06c55b14b28fc6782b10e6f301a2` (not sensitive) |
| Secret | `CLOUDFLARE_API_TOKEN` | Create from the **Edit Cloudflare Workers** template |

Both workflows are gated on `vars.CLOUDFLARE_ACCOUNT_ID != ''`, so they skip
rather than fail red before setup is complete. **Set the variable last** — with
the variable set but the secret missing, the deploy job runs and fails.

---

## 6. Growing into the full site

This is the migration that was designed for, and it is deliberately small.

**Step 1 — add a Worker script.** In `wrangler.jsonc`:

```jsonc
"main": "src/index.ts",
"assets": { "directory": "./public", "binding": "ASSETS" }
```

Static requests still bypass the Worker and stay free. Only routes your code
actually handles count against the 100k/day limit.

**Step 2 — pick a database.** D1 if SQLite suffices (zero config, native
binding). Neon if you want real Postgres. Both scale to zero; neither pauses.

**Step 3 — R2 for downloadable files.** STL, gerber, PDF. Serve them from R2
directly, never by streaming through the Worker — R2 egress is free, Worker CPU
is not.

**Step 4 — canonicalise.** `www` and the apex currently serve identical content,
which search engines read as duplicate. Once a Worker script exists, 301
`www` → apex.

**The 10 ms CPU limit is the real constraint** on the free plan. Rendering a
page and querying a database fits comfortably. Image processing, PDF generation
and CAD manipulation do not — those need the $5/mo Workers Paid plan (which also
unlocks Containers), or a separate service.

---

## 7. Abuse and billing protection

**This section is short now, and that is the point.** The previous stack needed
five layers of defence because the origin was billable and directly reachable.
Here:

- **There is no origin.** The Worker platform *is* the edge. Nothing sits behind
  it to be flooded, and there is no `*.run.app`-style URL that bypasses the CDN.
- **Static assets are free and unlimited.** A volumetric flood against the
  current site costs nothing.
- **Free-plan limits hard-stop.** Past 100k Worker requests/day you get HTTP 429,
  not an invoice. No budget alert or kill switch is required.
- **No credit card is attached.** The worst case is downtime, never a bill.

Still worth enabling — all free, all one-time:

- **Always Use HTTPS**, **HSTS**, **Minimum TLS 1.2**
- **Bot Fight Mode** and the **Free Managed WAF ruleset**
- **Rate limiting** — the free plan includes one rule. Spend it on dynamic
  routes (`/api/*`) once they exist, not on static ones.
- **Turnstile** on every form (free).

**This calculus changes the moment you upgrade to Workers Paid.** That plan
bills for usage beyond its included allowance, which reintroduces exactly the
liability this stack was chosen to avoid. Re-read this section before upgrading.

---

## 8. Secrets rules

- Never commit a secret. `.gitignore` covers `.env*`.
- Runtime secrets go in Worker secrets: `npx wrangler secret put NAME`.
- CI secrets go in GitHub repository secrets — never in `wrangler.jsonc`.
- `wrangler.jsonc` is committed, so it holds **configuration only**, never
  credentials.
- Rotate the Cloudflare API token immediately if it is ever pasted somewhere it
  should not be — a chat log, a screenshot, a commit.

---

## 9. Backups

Nothing to back up today — the site is source-controlled, and the deployed
artifact is reproducible from `git` alone.

Once a database exists: schedule `pg_dump` (Neon) or `wrangler d1 export` (D1)
to R2 on a weekly GitHub Actions cron. **An untested backup is not a backup** —
restore one deliberately, at least once.

---

## 10. Runbooks

**Normal deploy** — merge to `main`. CI deploys and smoke-checks.

**Rollback** — Cloudflare keeps every version:

```bash
npx wrangler deployments list
npx wrangler rollback [<version-id>]
```

Instant, and it does not require a git revert. Revert the commit afterwards so
the repo matches production.

**Site is down** — check https://www.cloudflarestatus.com, then
`npx wrangler tail` for live logs, then the Workers dashboard for errors.

**Domain stops resolving** — confirm the zone's nameservers still match what the
registrar has, and that the custom domains are still attached
(`npx wrangler deployments list`, or the Worker's Settings → Domains).

**Under attack** — enable **Under Attack Mode** in the Cloudflare dashboard.
With no billable origin this is a UX decision, not a financial one.

---

## 11. Cost model

| Scenario | Cost |
|---|---|
| Today — static page, any traffic volume | **₹0** |
| Full site, Worker + D1, under 100k req/day | **₹0** |
| Sustained above 100k Worker req/day | HTTP 429 — still ₹0, but visitors see errors |
| Upgrading to Workers Paid | $5/mo, and usage-based billing resumes — see §7 |
| Domain renewal | ~₹900/yr — **the only fixed cost** |

---

## 12. Verify before trusting

These drift and must be confirmed at setup rather than taken from this document:

- Every free-tier quota in §3.
- That static-asset requests are still free and unlimited — this is the single
  assumption the entire cost model rests on.
- Whether the Cloudflare Free plan still includes one rate-limiting rule.
- D1 and R2 free-tier limits, before committing to either.

The architecture does not depend on any of these specifics. The *cost profile*
does.
