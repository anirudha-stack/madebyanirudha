# How to Deploy This Website

**Audience:** a coding agent working inside this repository.
**Scope:** deployment, infrastructure, CI/CD, and abuse/billing protection.
**Out of scope:** application framework, language, and site content — those are
free choices and nothing here depends on them.

> **Read §2 first.** Every decision below assumes the application honours the
> container contract. If the app violates it, fix the app, not the infra.

---

## 1. Decisions

| Concern | Decision | Rationale | Rejected |
|---|---|---|---|
| Compute | **Google Cloud Run** (service, scale-to-zero) | Runs an arbitrary OCI image with no framework adapter. Perpetual always-free tier. Declarative manifest. Instant traffic-shift rollback. | Cloudflare Workers / Vercel / Netlify (not containers). Managed k8s (control plane costs more than this entire stack). Render / Railway / DO App Platform ($5–7/mo for less). Fly.io (no real free tier). Oracle Always Free (ARM capacity shortages, idle reclamation, account-termination reports). |
| Region | **`asia-south1`** (Mumbai) | Lowest latency for uncached/dynamic requests for an India-based operator. Cached traffic is served globally by the CDN regardless. | `us-central1` — maximises free tier, whose egress allowance is North-America-only. Switch if origin egress ever becomes a real line item. |
| Registry | **Google Artifact Registry**, Docker format, same region | Cloud Run pulls from Artifact Registry. Same-region pulls are fast and not billed as internet egress. | GHCR / Docker Hub — Cloud Run cannot pull from them directly without a remote-repository proxy. |
| Relational data | **Neon — Free plan** (Postgres) | Standard `DATABASE_URL`, wire-protocol Postgres, scales to zero, DB branching for previews. | Supabase Free (pauses after ~7 days idle — disqualifying for a site that sits quiet for weeks). Cloud SQL (no free tier, ~$9/mo floor). |
| Blob storage | **Cloudflare R2** | **Zero egress fees** — decisive when serving STL / gerber / PDF downloads. S3-compatible, so no vendor SDK enters application code. | AWS S3 / GCS (egress billed; one popular download becomes a bill). Local disk (Cloud Run is stateless). |
| Edge / DNS / TLS | **Cloudflare — Free plan** | Caching removes most traffic from the origin, which is simultaneously the performance story and the primary billing defence. Free managed WAF, bot mitigation, one rate-limiting rule. | Bare Cloud Run domain mapping (no cache, no WAF — origin absorbs every request). Google external ALB + Cloud Armor (~$18–25/mo). |
| Secrets | **Google Secret Manager**, injected as env vars | Rotatable without a rebuild; never baked into an image or held in GitHub. | GitHub Secrets → `--set-env-vars` (leaks into revision metadata, visible to anyone with viewer access). `.env` in image (never). |
| CI/CD | **GitHub Actions**, build once → promote digest | The artifact that passed CI is byte-identical to the one serving traffic. | Cloud Build (extra cost and moving parts for no gain). Rebuild-per-environment (ships untested bytes to prod). |
| CI → GCP auth | **Workload Identity Federation** | Short-lived tokens; no long-lived service-account JSON key in GitHub. | SA JSON key in GitHub Secrets — the classic CI credential leak. |
| Manifest style | **Knative `Service` YAML** + `gcloud run services replace` | Declarative, version-controlled, reviewable in a PR. | Kubernetes manifests (needs a control plane). Imperative-only `gcloud run deploy` for prod (config drifts out of the repo). |

**Total fixed cost: the domain only** (~$10–15/yr; Cloudflare Registrar sells at
cost). Everything else sits inside always-free tiers at personal-site traffic.

---

## 2. The container contract

The image is opaque to the platform. It **MUST**:

1. Listen on `$PORT` (Cloud Run injects it; default `8080`). Hard-coding a port
   is the most common first-deploy failure.
2. Bind `0.0.0.0`, never `127.0.0.1`.
3. Read **all** configuration from environment variables. No config files baked
   into the image; no build-time environment branching.
4. Serve `GET /healthz` → `200`, trivial body, no auth, **no backing-service
   calls**. If the probe touches the DB, a Neon cold start becomes a failed
   deploy.
5. Treat the filesystem as ephemeral and in-memory — writes are lost on
   scale-down and count against the memory limit. Uploads go to R2; sessions go
   to Postgres or a signed cookie.
6. Exit on `SIGTERM` within 10 s.
7. Run as a non-root user.
8. Start fast. Startup latency is paid on every cold start.

It **MUST NOT** assume: a writable disk, a stable hostname, an in-process cache
shared across requests, background timers that outlive a request (CPU is
throttled to near-zero between requests by design), or that two requests reach
the same instance.

---

## 3. Accounts and exact tier names

Free-ness depends on the specific named tier. Use these.

| Service | Exact tier | Allowance that matters here |
|---|---|---|
| Google Cloud Run | **Cloud Run free tier** (always-free, per billing account) | ~2,000,000 requests/mo · ~360,000 GiB-seconds · ~180,000 vCPU-seconds · 1 GiB egress **from North America only** |
| Google Artifact Registry | **Artifact Registry free tier** | 0.5 GB storage/mo |
| Google Secret Manager | **Secret Manager free tier** | 6 active secret versions · 10,000 access operations/mo |
| Google Cloud Logging | **Cloud Logging free tier** | ~50 GiB ingestion/project/mo — a traffic flood inflates log cost too |
| Google Cloud Billing Budgets | Free | Unlimited budgets and alerts |
| Neon | **Neon Free plan** | ~0.5 GiB storage · ~190 compute-hours/mo · scale-to-zero · branching |
| Cloudflare DNS / CDN / WAF | **Cloudflare Free plan** | Unlimited cached bandwidth · free managed WAF ruleset · Bot Fight Mode · **one** rate-limiting rule |
| Cloudflare R2 | **R2 Forever Free tier** | 10 GB-month storage · 1M Class A ops/mo · 10M Class B ops/mo · **zero egress, always** |
| Cloudflare Registrar | At-cost pricing | Domain at wholesale, no renewal markup |
| GitHub Actions | **GitHub Free** | Unlimited minutes on public repos; 2,000 min/mo private |
| Resend (optional mail) | **Resend Free plan** | 3,000 emails/mo, 100/day |

> **These numbers drift.** Verify each against the live pricing page at setup.
> The *relative ordering* of these choices is stable even when absolute limits
> move; do not re-architect because a quota changed 20%.

A **billing account is mandatory** on GCP even to use the free tier. That is
precisely why §7 exists.

---

## 4. One-time infrastructure setup

Ordered — later steps depend on earlier ones.

```bash
export PROJECT_ID=<your-project-id>
export REGION=asia-south1
export SERVICE=website
export AR_REPO=web
export GITHUB_REPO=<owner>/<repo>
```

### 4.1 Project and APIs

```bash
gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"
# Link a billing account here (required even for free tier).
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudbilling.googleapis.com billingbudgets.googleapis.com
```

### 4.2 Artifact Registry (+ cleanup policy)

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker --location="$REGION"
```

Add a cleanup policy so old images do not quietly exceed the 0.5 GB free tier —
keep the 10 most recent versions and delete anything older than 30 days. Write
the policy to `cleanup.json` and apply with
`gcloud artifacts repositories set-cleanup-policies "$AR_REPO" --location="$REGION" --policy=cleanup.json`:

```json
[
  {"name":"keep-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":10}},
  {"name":"delete-old","action":{"type":"Delete"},"condition":{"olderThan":"30d"}}
]
```

### 4.3 Two service accounts, least privilege

Never use one identity for both. The deployer can change infrastructure; the
runtime identity must not be able to.

```bash
gcloud iam service-accounts create "${SERVICE}-run"    --display-name="Cloud Run runtime"
gcloud iam service-accounts create "${SERVICE}-deploy" --display-name="GitHub Actions deployer"

RUNTIME_SA="${SERVICE}-run@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="${SERVICE}-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA}" --role="$ROLE"
done

# Deployer must be permitted to run the service AS the runtime identity.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/iam.serviceAccountUser
```

The runtime SA receives **no project-level roles** — only per-secret access
(§4.5).

### 4.4 Workload Identity Federation — no JSON keys

```bash
gcloud iam workload-identity-pools create github --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"
```

**Non-negotiable security requirements:**

- The `--attribute-condition` pinning `assertion.repository` **MUST** be
  present. Without it, *any* GitHub repository on the internet can mint tokens
  for this service account. This is the most dangerous single misconfiguration
  in the whole setup.
- Prefer narrowing production further with `attribute.ref=='refs/heads/main'`,
  and give PR previews a separate, weaker identity.
- Never create a service-account JSON key. If one exists, delete it.

### 4.5 Secret Manager

```bash
printf '%s' "$DATABASE_URL_VALUE"     | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' "$R2_KEY_ID"              | gcloud secrets create S3_ACCESS_KEY_ID --data-file=-
printf '%s' "$R2_SECRET"              | gcloud secrets create S3_SECRET_ACCESS_KEY --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create ORIGIN_SHARED_SECRET --data-file=-

for S in DATABASE_URL S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY ORIGIN_SHARED_SECRET; do
  gcloud secrets add-iam-policy-binding "$S" \
    --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor
done
```

Free tier allows 6 active versions — destroy superseded versions after rotation.

### 4.6 Neon

Create a project on the **Neon Free plan** in the region nearest `$REGION`.

- Use the **pooled** (pgBouncer) connection string. Cloud Run scales
  horizontally and will exhaust direct connections.
- Require TLS: `?sslmode=require`.
- Create a branch named `preview`; the preview service uses **its** connection
  string. Preview deploys must never write production data.

### 4.7 Cloudflare R2

- Buckets: `files` (production) and `files-preview`.
- Create a **scoped R2 API token** limited to those buckets — never an
  account-wide token.
- Endpoint: `https://<accountid>.r2.cloudflarestorage.com`.
- For public downloads, attach a **custom domain** (`files.example.com`) to the
  bucket instead of using the `r2.dev` URL. The custom domain routes through the
  Cloudflare cache, so repeat downloads are served from the edge and never
  consume R2 operation quota.
- Never expose R2 credentials to the browser. Uploads and private downloads use
  short-TTL **presigned URLs** minted server-side (≤ 300 s).

---

## 5. The deployment manifest

Create `deploy/service.yaml`. `${...}` placeholders are filled by `envsubst` in
CI. Every annotation below marked **cost** is a billing control — do not relax
one without reading §7.4.

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${SERVICE_NAME}
  labels:
    cloud.googleapis.com/location: ${REGION}
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"     # cost: scale to zero when idle
        autoscaling.knative.dev/maxScale: "3"     # cost: HARD ceiling on burn rate
    spec:
      serviceAccountName: ${RUNTIME_SA}
      containerConcurrency: 80                    # cost: more req/instance = fewer instances
      timeoutSeconds: 30                          # cost: short timeouts free pinned instances
      containers:
        - image: ${IMAGE}                         # MUST be a digest, never a tag
          ports:
            - name: http1
              containerPort: 8080
          resources:
            limits:
              cpu: "1"                            # cost: do not raise without cause
              memory: 512Mi
          env:
            - name: APP_ENV
              value: production
            - name: S3_ENDPOINT
              value: https://<accountid>.r2.cloudflarestorage.com
            - name: S3_BUCKET
              value: files
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: { name: DATABASE_URL, key: latest }
            - name: S3_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef: { name: S3_ACCESS_KEY_ID, key: latest }
            - name: S3_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef: { name: S3_SECRET_ACCESS_KEY, key: latest }
            - name: ORIGIN_SHARED_SECRET
              valueFrom:
                secretKeyRef: { name: ORIGIN_SHARED_SECRET, key: latest }
          startupProbe:
            httpGet: { path: /healthz }
            periodSeconds: 2
            failureThreshold: 15
  traffic:
    - percent: 100
      latestRevision: true
```

**Do not** set CPU to "always allocated" — the default (CPU only during request
processing) is what makes scale-to-zero cheap.

---

## 6. CI/CD

Two workflows. The governing rule is **build once, promote the digest**:
production runs the exact bytes that passed CI. Never rebuild between
environments.

### 6.1 `ci.yml` — on pull request

Jobs:

1. **build** (no cloud credentials required, always runs)
   - `docker build`
   - run the container, poll `GET /healthz` until 200 or fail after 30 s
   - run a vulnerability scan (Trivy is free; Artifact Registry scanning is not)
2. **preview** (only if GCP vars are configured)
   - authenticate via WIF (`permissions: id-token: write`)
   - build and push to Artifact Registry
   - deploy to a **separate** `website-preview` service with
     `--tag pr-<n> --no-traffic --max-instances 1`
   - post/update a single PR comment with the preview URL

Preview isolation is mandatory: separate Cloud Run service, separate Neon branch
(`preview`), separate R2 bucket (`files-preview`). Tagged revisions with
`--no-traffic` are inherently imperative; that is fine — production stays
declarative.

### 6.2 `deploy.yml` — on push to `main`

```
concurrency: { group: deploy-production, cancel-in-progress: false }
```

Never cancel in progress — a half-applied migration is worse than a queue.

Steps, in order:

1. WIF auth → `gcloud auth configure-docker $REGION-docker.pkg.dev`
2. Build and push, tags `sha-<sha>` and `latest`
3. Capture `steps.push.outputs.digest`; every later step uses
   `<region>-docker.pkg.dev/<project>/<repo>/<service>@<digest>`
4. **Migrations** (if the app has them): deploy and execute a Cloud Run **Job**
   from the *same image* with a different `--command`, `--max-retries 0`,
   `--wait`. Same image, different entrypoint — migrations can never run against
   a build other than the one being deployed. Runs *before* new code takes
   traffic.
5. `envsubst` the manifest → `gcloud run services replace`
6. `gcloud run services add-iam-policy-binding --member=allUsers --role=roles/run.invoker`
   (public site; see §7.3 for how the origin is still protected)
7. Smoke check `GET /healthz` on the service URL, with retries
8. **On failure**: shift traffic back to the previous revision —
   `gcloud run revisions list --sort-by=~metadata.creationTimestamp`, take the
   second entry, `gcloud run services update-traffic --to-revisions <prev>=100`

### 6.3 Required GitHub configuration

Repository **variables** (not secrets — none are sensitive):
`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `AR_REPO`,
`SERVICE_NAME`, `PREVIEW_SERVICE_NAME`, `RUN_MIGRATIONS`, `MIGRATE_COMMAND`.

Repository **secrets**: only for the backup job (§9) —
`DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
Runtime secrets live in Secret Manager and never enter GitHub.

Grant workflows the minimum: `contents: read`, `id-token: write`, and
`pull-requests: write` only on the PR workflow.

### 6.4 Dependency maintenance

Enable Renovate: weekly schedule, group non-major updates, auto-merge patch and
minor on green CI, `pinDigests: true` for Docker base images. Unattended base-image
drift is the real security-maintenance risk for a container that nobody touches
for six months.

---

## 7. Abuse and billing protection

**This is the section that matters most for a public site on usage-based
billing.** Cloud Run charges per request, per vCPU-second and per GiB-second.
Traffic is money, and anyone on the internet can generate traffic.

### 7.1 Threat model

| Vector | Effect |
|---|---|
| Volumetric flood on HTML routes | Spawns instances, burns vCPU-seconds |
| Cache-buster query strings (`?x=random`) | Defeats the CDN, sends every request to origin |
| Expensive endpoints (search, upload, unpaginated queries) | High cost per request |
| **Direct requests to `*.run.app`** | Bypasses Cloudflare entirely — all edge protection becomes moot |
| Slowloris / slow reads | Pins instances for the full request timeout |
| Log flooding | Inflates Cloud Logging past its free tier |
| Large file downloads | Cheap here — R2 egress is free — but only if files are served from R2, never through the container |

**Goal:** make the common case free, and bound worst-case monthly spend to a
number decided in advance.

### 7.2 Layer 1 — Cloudflare edge (free plan)

Apply all of these:

- **Proxied DNS** (orange cloud) on every record that fronts the origin.
- **Cache Rules**: cache HTML, not just assets. Origin sends
  `Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=604800`.
  A portfolio is nearly all cacheable; uncacheable HTML is a *cost bug*.
- **Cache key: ignore query strings** (or allowlist only the params you use).
  This single setting defeats cache-buster floods, the most common way a cached
  site still gets billed.
- **Tiered Cache** on — fewer origin fetches.
- **Bot Fight Mode** on.
- **Cloudflare Free Managed Ruleset** (WAF) on.
- **Rate limiting** — the Free plan includes one rule. Spend it on dynamic
  routes, not static: e.g. `path starts with /api/` → 20 requests/minute per IP
  → *Managed Challenge*. Static routes are already protected by cache.
- **Turnstile** on every form (free).
- **Always Use HTTPS**, **HSTS**, **Minimum TLS 1.2**.
- Keep **Under Attack Mode** in mind as a manual switch (§10.3).

### 7.3 Layer 2 — origin lockdown (the step everyone misses)

The default `https://<service>-<hash>.<region>.run.app` URL is publicly
reachable and **bypasses Cloudflare completely**. If it stays open, §7.2 is
decorative. Apply all three:

1. **Disable the default URL** so the service answers only on the mapped
   domain. Cloud Run supports this (`--no-default-url` / a
   `run.googleapis.com/default-url-disabled` annotation — *verify the current
   flag name*, it has changed). Requires a domain mapping to stay reachable.
2. **Shared-secret header.** Add a Cloudflare **Transform Rule** (Modify Request
   Header — available on Free) injecting `X-Origin-Auth: <ORIGIN_SHARED_SECRET>`.
   The app rejects any request lacking it with a bare `403` **before** touching
   the DB, writing a log line, or doing any other work. This does not make the
   request free — an instance still handles it — but it makes it O(1) and short.
3. **Domain routing.** Prefer a Cloud Run **domain mapping** for the apex/www.
   If domain mapping is unavailable in `$REGION`, use a Cloudflare **Origin
   Rule** to override the Host header to the `run.app` hostname.

**Honest limitation:** without a Google external ALB + Cloud Armor you cannot
IP-allowlist Cloudflare's ranges at the network layer on Cloud Run. Item 2 is
the practical substitute. If real targeted abuse ever occurs, the upgrade path
is ALB + Cloud Armor at roughly **$18–25/mo** — buy it then, not now.

### 7.4 Layer 3 — Cloud Run hard caps

`maxScale` is the single most important cost control in this document. It
converts an unbounded bill into a known maximum burn rate.

With the §5 manifest (`maxScale: 3`, `cpu: 1`, `memory: 512Mi`), the absolute
worst case — all three instances pinned 24/7 — is roughly:

| Resource | Rate | Per day |
|---|---|---|
| vCPU | 3 vCPU-s per second × 86,400 = 259,200 vCPU-s | ~$6.20 |
| Memory | 1.5 GiB-s per second × 86,400 = 129,600 GiB-s | ~$0.33 |
| Requests + egress | varies with payload | ~$1–3 |

**≈ $8–10/day worst case, and only under a sustained 24/7 full-rate flood.**
The monthly free tier (~180,000 vCPU-seconds) is exhausted in well under a day
at that rate, which is exactly why §7.5's kill switch exists rather than relying
on the free tier as a floor.

Also:

- `timeoutSeconds: 30`, not 300 — caps how long a slow client can hold capacity.
- `containerConcurrency: 80` — absorbing more requests per instance means fewer
  instances for the same load. Counter-intuitively, **raising** concurrency
  lowers cost.
- Never enable "CPU always allocated".
- Consider lowering the per-region Cloud Run instance quota in
  *IAM & Admin → Quotas* as a second ceiling below `maxScale`.

### 7.5 Layer 4 — budget alerts and an automatic kill switch

**Budgets alert; they do not stop spending.** Anyone who believes otherwise
finds out during the incident. Do both:

1. Create a budget (e.g. **$5/month**) with alert thresholds at 50%, 90%, 100%,
   and forecasted 100%.
2. Attach a **Pub/Sub topic** to the budget and subscribe a Cloud Function that
   automatically disarms the service.

The kill switch should **remove `allUsers` from `roles/run.invoker`**:

```bash
gcloud run services remove-iam-policy-binding "$SERVICE" \
  --region="$REGION" --member=allUsers --role=roles/run.invoker
```

The site returns 403, spend stops immediately, and it is reversible with one
command. Prefer this over `PATCH`ing the billing account off, which also kills
the kill-switch function itself and anything else in the project.

Add a Cloud Monitoring alert on Cloud Run **request count** with a threshold
around 10× normal, delivered to email — spend alerts lag, request-rate alerts
are immediate.

### 7.6 Layer 5 — application level

- Check `X-Origin-Auth` **first**, before logging, DB access, or parsing.
- Per-IP token bucket in-process as defence in depth (note: it is per-instance,
  not global — treat it as a speed bump, not a control).
- Reject oversized request bodies early; cap upload size explicitly.
- Paginate everything. No unbounded queries.
- Serve files by **redirecting to a presigned R2 URL**, never by streaming bytes
  through the container. Streaming converts free R2 egress into billed Cloud Run
  egress *and* pins an instance for the duration.
- Return 404/403 without a database lookup.
- Set `Cache-Control` on every response.
- Do not log request bodies or per-request debug output in production.

### 7.7 Verification checklist

Run this after any infrastructure change:

- [ ] `curl https://<service>-<hash>.<region>.run.app/` → refused or 403, **not** 200
- [ ] `curl https://example.com/` without the Cloudflare path → cannot reach origin
- [ ] `curl -I https://example.com/` → shows `cf-cache-status: HIT` on a repeat request
- [ ] `curl 'https://example.com/?cachebust=123'` → still `HIT` (query strings ignored)
- [ ] `gcloud run services describe $SERVICE --region $REGION` → `maxScale` is 3
- [ ] Budget exists, Pub/Sub topic attached, kill-switch function deployed and tested
- [ ] Kill switch tested end-to-end at least once, deliberately
- [ ] No service-account JSON key exists: `gcloud iam service-accounts keys list --iam-account=$DEPLOY_SA`
- [ ] WIF provider has an `attribute-condition` pinning the repository
- [ ] Rate-limiting rule active on dynamic routes
- [ ] R2 bucket is not publicly listable; downloads go through the custom domain

---

## 8. Secrets rules

1. Runtime secrets live in **Secret Manager** only, referenced by
   `secretKeyRef`. Never `--set-env-vars`, which persists them in revision
   metadata.
2. Never bake a secret into an image. Images are pullable by anyone with
   registry read access, and layers are permanent.
3. GitHub holds only WIF configuration (public identifiers) plus the three
   backup secrets.
4. All tokens are **scoped**: R2 token limited to specific buckets; runtime SA
   limited to specific secrets; WIF limited to one repository.
5. Rotate `ORIGIN_SHARED_SECRET` if the Cloudflare account is ever compromised.
   Rotating is: add a secret version, redeploy, update the Transform Rule,
   destroy the old version.
6. If a secret leaks, rotate first and investigate second.

---

## 9. Backups

Free tiers do not back you up. Assume nothing.

- **Postgres**: weekly GitHub Actions cron → `pg_dump --no-owner --no-privileges`
  → gzip → upload to R2 (`s3://<backup-bucket>/postgres/db-<timestamp>.sql.gz`)
  via the S3 API with `--endpoint-url`. Verify each dump with `gunzip -t` and
  assert the header string is present — an unverified backup is not a backup.
- **R2**: enable object versioning and a lifecycle rule; periodically copy
  critical files off Cloudflare so no single vendor account holds the only copy.
- **Code and manifests**: already in git, which is the second copy.
- **Restore drill**: restore a dump into a Neon branch at least once. A backup
  you have never restored is a hypothesis.

---

## 10. Runbooks

### 10.1 Normal deploy
Merge to `main`. Pipeline builds, migrates, replaces the service, smoke-checks.
No manual step.

### 10.2 Rollback
```bash
gcloud run revisions list --service "$SERVICE" --region "$REGION" \
  --sort-by=~metadata.creationTimestamp
gcloud run services update-traffic "$SERVICE" --region "$REGION" \
  --to-revisions <previous-revision>=100
```
Instant, no rebuild. Then revert the commit so git matches reality.

### 10.3 Under attack / bill spiking
1. Cloudflare → **Under Attack Mode** on.
2. If it continues, run the §7.5 kill switch to take the origin offline.
3. Check `cf-cache-status` on the flooded path — a low HIT rate means the cache
   rules are wrong, which is usually the actual root cause.
4. Inspect Cloud Run request metrics by path; add a rate-limiting rule or a WAF
   custom rule for the abused pattern.
5. Restore `allUsers` invoker when it subsides.

### 10.4 Restore the database
Download the latest dump from R2, create a Neon branch, restore into it, verify,
then repoint `DATABASE_URL` and redeploy.

### 10.5 Rotate a secret
Add a version → redeploy (the container reads secrets at start) → verify →
destroy the old version (the free tier allows only 6 active).

---

## 11. Store (future) — infrastructure notes

Adding a store changes **no** infrastructure decision above.

- `products` / `orders` tables in the Postgres that already exists.
- A webhook route in the app — it is a normal HTTP server, nothing special.
- Gated digital downloads: verify the purchase, then issue a short-TTL presigned
  R2 URL. Never stream the file through the container.
- **Use hosted checkout. Never touch card data** — it puts the site in PCI
  scope. For digital goods prefer a *merchant of record* (they remit VAT/GST);
  for physical goods a normal PSP is usually the better fit because shipping
  suits MoR platforms poorly.
- Fixed cost stays $0; payment providers charge per transaction.
- Webhook endpoints **must** verify the provider's signature and be idempotent
  (providers retry). Exclude them from the rate-limiting rule.
- If the store outgrows the site, deploy it as a second Cloud Run service rather
  than complicating this one.

---

## 12. Cost model

| Line | Normal | Notes |
|---|---|---|
| Domain | ~$10–15/yr | The only guaranteed cost |
| Cloud Run | $0 | Within always-free tier at personal-site traffic |
| Artifact Registry | $0 | With the cleanup policy in §4.2 |
| Neon Free plan | $0 | 0.5 GiB ceiling |
| R2 Forever Free | $0 | 10 GB; zero egress at any volume |
| Cloudflare Free plan | $0 | |
| GitHub Actions | $0 | Unlimited on a public repo |
| **Total** | **~$1/mo** | Amortised domain |

**What actually breaks the free tier:** sustained traffic above the Cloud Run
allowance (unlikely for a portfolio, and largely absorbed by CDN caching);
storage past 10 GB on R2 (then ~$0.015/GB-month — 100 GB ≈ $1.35/mo); the Neon
0.5 GiB limit; and abuse, which §7 is designed to bound.

---

## 13. Verify before trusting

These drift and must be confirmed at setup rather than taken from this document:

- Every free-tier quota in §3.
- The Cloud Run flag/annotation for disabling the default URL (§7.3) — the name
  has changed at least once.
- Cloud Run **domain mapping availability in `asia-south1`** — if unavailable,
  use the Cloudflare Origin Rule fallback in §7.3.
- Whether the Cloudflare Free plan still includes one rate-limiting rule.
- Current Cloud Run per-unit pricing, if the §7.4 worst-case math is being used
  to size a budget.

The architecture does not depend on any of these specifics. The *cost profile*
does.
