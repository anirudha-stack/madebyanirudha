/// <reference types="@cloudflare/workers-types" />

// API for store.madebyanirudha.in. The React app is static assets; only
// /api/* reaches this Worker (see run_worker_first in wrangler.jsonc).
//
//   POST   /api/login            { password } → session cookie
//   POST   /api/logout
//   GET    /api/me
//   GET    /api/builds           saved drafts, newest first
//   POST   /api/builds           { spec } → { id }
//   GET    /api/builds/:id
//   PUT    /api/builds/:id       { spec }
//   DELETE /api/builds/:id
//   GET    /api/orders
//   POST   /api/orders           { buildId, spec, shipping, method } (payment simulated)
//   GET    /api/orders/:id
//   PATCH  /api/orders/:id       { status }
//   POST   /api/uploads          raw PNG/SVG body, ≤ 1 MB → { key } (stored in D1)
//   GET    /api/uploads/:key

import { quote } from "../shared/pricing";
import type {
  BuildSpec,
  GeneratorJob,
  OrderRecord,
  OrderStatus,
  Shipping,
} from "../shared/types";
import { checkPassword, clearCookie, isSignedIn, sessionCookie } from "./auth";
import { initialJobs, REGISTRY } from "./generators";

export interface Env {
  DB: D1Database;
  /** Generated build files. Optional until R2 is enabled on the account. */
  FILES?: R2Bucket;
  STORE_PASSWORD: string;
  SESSION_SECRET: string;
}

const STATUSES: OrderStatus[] = ["paid", "files", "fabrication", "packing", "shipped", "delivered"];
const UPLOAD_TYPES = ["image/png", "image/svg+xml"];
const UPLOAD_MAX = 1024 * 1024;

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const fail = (status: number, error: string) => json({ error }, { status });

const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** Shallow shape check: enough to refuse garbage, not a full schema. */
function validSpec(s: unknown): s is BuildSpec {
  const v = s as BuildSpec;
  return (
    !!v &&
    v.version === 1 &&
    typeof v.name === "string" &&
    Array.isArray(v.layout?.items) &&
    v.layout.items.length <= 300 &&
    v.layout.items.every(
      (i) =>
        typeof i.x === "number" &&
        typeof i.y === "number" &&
        i.w > 0 &&
        i.h > 0 &&
        ["key", "encoder", "oled"].includes(i.kind),
    ) &&
    typeof v.electronics?.mcu === "string" &&
    typeof v.pcb?.mask === "string" &&
    typeof v.case?.type === "string"
  );
}

function validShipping(s: unknown): s is Shipping {
  const v = s as Shipping;
  return (
    !!v &&
    ["name", "phone", "email", "line1", "city", "state", "pincode"].every(
      (k) => typeof v[k as keyof Shipping] === "string" && v[k as keyof Shipping].trim().length > 0,
    ) &&
    /^\d{6}$/.test(v.pincode)
  );
}

type OrderRow = {
  id: string;
  number: number;
  build_id: string | null;
  spec: string;
  quote: string;
  shipping: string;
  payment: string;
  status: OrderStatus;
  generator: string;
  created_at: number;
  updated_at: number;
};

const toOrder = (r: OrderRow): OrderRecord => ({
  id: r.id,
  number: r.number,
  buildId: r.build_id,
  spec: JSON.parse(r.spec),
  quote: JSON.parse(r.quote),
  shipping: JSON.parse(r.shipping),
  payment: JSON.parse(r.payment),
  status: r.status,
  generator: JSON.parse(r.generator),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Run any registered generator modules for an order, after the response. */
async function runGenerators(env: Env, order: OrderRecord) {
  const jobs: GeneratorJob[] = order.generator;
  for (const job of jobs) {
    const gen = REGISTRY[job.generator];
    if (!gen || job.state !== "queued") continue;
    try {
      const out = await gen.run(order.spec, order.id);
      job.files = [];
      for (const f of out.files) {
        const key = `orders/${order.id}/${f.name}`;
        if (!env.FILES) throw new Error("R2 is not enabled, so generated files have nowhere to go.");
        await env.FILES.put(key, f.body, { httpMetadata: { contentType: f.contentType } });
        job.files.push({ name: f.name, key });
      }
      job.state = "done";
      job.note = out.note ?? "";
    } catch (e) {
      job.state = "failed";
      job.note = e instanceof Error ? e.message : String(e);
    }
  }
  await env.DB.prepare("UPDATE orders SET generator = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(jobs), Date.now(), order.id)
    .run();
}

async function api(request: Request, env: Env, ctx: ExecutionContext, path: string[]) {
  const method = request.method;
  const [resource, rid] = path;

  if (resource === "login" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    if (!(await checkPassword(body.password ?? "", env.STORE_PASSWORD))) {
      return fail(401, "That password is not right.");
    }
    const secure = new URL(request.url).protocol === "https:";
    return json({ ok: true }, { headers: { "set-cookie": await sessionCookie(env.SESSION_SECRET, secure) } });
  }

  if (resource === "logout" && method === "POST") {
    return json({ ok: true }, { headers: { "set-cookie": clearCookie } });
  }

  // Everything below needs a session.
  if (!(await isSignedIn(request, env.SESSION_SECRET))) return fail(401, "Sign in first.");

  if (resource === "me") return json({ role: "admin" });

  if (resource === "builds") {
    if (!rid && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, spec, created_at, updated_at FROM builds ORDER BY updated_at DESC LIMIT 100",
      ).all<{ id: string; name: string; spec: string; created_at: number; updated_at: number }>();
      return json(
        results.map((r) => ({
          id: r.id,
          name: r.name,
          spec: JSON.parse(r.spec),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      );
    }
    if (!rid && method === "POST") {
      const { spec } = (await request.json()) as { spec: unknown };
      if (!validSpec(spec)) return fail(400, "That build is malformed.");
      const now = Date.now();
      const bid = id();
      await env.DB.prepare("INSERT INTO builds (id, name, spec, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(bid, spec.name.slice(0, 80), JSON.stringify(spec), now, now)
        .run();
      return json({ id: bid }, { status: 201 });
    }
    if (rid && method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM builds WHERE id = ?").bind(rid).first<{
        id: string;
        name: string;
        spec: string;
        created_at: number;
        updated_at: number;
      }>();
      if (!r) return fail(404, "No build with that id.");
      return json({ id: r.id, name: r.name, spec: JSON.parse(r.spec), createdAt: r.created_at, updatedAt: r.updated_at });
    }
    if (rid && method === "PUT") {
      const { spec } = (await request.json()) as { spec: unknown };
      if (!validSpec(spec)) return fail(400, "That build is malformed.");
      const res = await env.DB.prepare("UPDATE builds SET name = ?, spec = ?, updated_at = ? WHERE id = ?")
        .bind(spec.name.slice(0, 80), JSON.stringify(spec), Date.now(), rid)
        .run();
      if (!res.meta.changes) return fail(404, "No build with that id.");
      return json({ ok: true });
    }
    if (rid && method === "DELETE") {
      await env.DB.prepare("DELETE FROM builds WHERE id = ?").bind(rid).run();
      return json({ ok: true });
    }
  }

  if (resource === "orders") {
    if (!rid && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all<OrderRow>();
      return json(results.map(toOrder));
    }
    if (!rid && method === "POST") {
      const body = (await request.json()) as {
        buildId?: string;
        spec: unknown;
        shipping: unknown;
        method?: string;
      };
      if (!validSpec(body.spec)) return fail(400, "That build is malformed.");
      if (!validShipping(body.shipping)) return fail(400, "The shipping address is incomplete.");
      if (!body.spec.layout.items.some((i) => i.kind === "key")) return fail(400, "A keyboard needs at least one key.");

      const now = Date.now();
      const last = await env.DB.prepare("SELECT MAX(number) AS n FROM orders").first<{ n: number | null }>();
      const order: OrderRecord = {
        id: id(),
        number: (last?.n ?? 1000) + 1,
        buildId: body.buildId ?? null,
        spec: body.spec,
        quote: quote(body.spec), // never trust the client's total
        shipping: body.shipping,
        payment: {
          method: body.method === "card" ? "card" : "upi",
          reference: `SIM-${id().slice(0, 10).toUpperCase()}`,
          simulated: true,
          paidAt: now,
        },
        status: "paid",
        generator: initialJobs(),
        createdAt: now,
        updatedAt: now,
      };
      await env.DB.prepare(
        "INSERT INTO orders (id, number, build_id, spec, quote, shipping, payment, status, generator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          order.id,
          order.number,
          order.buildId,
          JSON.stringify(order.spec),
          JSON.stringify(order.quote),
          JSON.stringify(order.shipping),
          JSON.stringify(order.payment),
          order.status,
          JSON.stringify(order.generator),
          now,
          now,
        )
        .run();
      if (order.generator.some((j) => j.state === "queued")) ctx.waitUntil(runGenerators(env, order));
      return json(order, { status: 201 });
    }
    if (rid && method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(rid).first<OrderRow>();
      return r ? json(toOrder(r)) : fail(404, "No order with that id.");
    }
    if (rid && method === "PATCH") {
      const { status } = (await request.json()) as { status: OrderStatus };
      if (!STATUSES.includes(status)) return fail(400, "Unknown status.");
      await env.DB.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status, Date.now(), rid)
        .run();
      return json({ ok: true });
    }
  }

  if (resource === "uploads") {
    if (!rid && method === "POST") {
      const type = (request.headers.get("content-type") ?? "").split(";")[0];
      if (!UPLOAD_TYPES.includes(type)) return fail(415, "Logos must be PNG or SVG.");
      const body = await request.arrayBuffer();
      if (body.byteLength > UPLOAD_MAX) return fail(413, "Logos must be under 1 MB.");
      const key = `logos/${id()}.${type === "image/png" ? "png" : "svg"}`;
      await env.DB.prepare("INSERT INTO uploads (key, type, body, created_at) VALUES (?, ?, ?, ?)")
        .bind(key, type, body, Date.now())
        .run();
      return json({ key }, { status: 201 });
    }
    if (rid && method === "GET") {
      const key = decodeURIComponent(path.slice(1).join("/"));
      const obj = await env.DB.prepare("SELECT type, body FROM uploads WHERE key = ?")
        .bind(key)
        .first<{ type: string; body: number[] | ArrayBuffer }>();
      if (!obj) return fail(404, "No such file.");
      const bytes = obj.body instanceof ArrayBuffer ? new Uint8Array(obj.body) : new Uint8Array(obj.body);
      return new Response(bytes, {
        headers: {
          "content-type": obj.type,
          "cache-control": "private, max-age=3600",
          // SVG logos are user content: never let them run script.
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
      });
    }
  }

  return fail(404, "Not found.");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname.slice(5).split("/").filter(Boolean);
      try {
        return await api(request, env, ctx, path);
      } catch (e) {
        console.error(e);
        return fail(500, "Something broke on our side. Try again.");
      }
    }
    return fail(404, "Not found.");
  },
} satisfies ExportedHandler<Env>;
