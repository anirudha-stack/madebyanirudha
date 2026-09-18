/// <reference types="@cloudflare/workers-types" />

// First-party visitor counter for madebyanirudha.in.
//
// The site is otherwise a static bundle served straight off Cloudflare's edge.
// This Worker adds exactly one dynamic route — /api/views — and hands every
// other request to the static assets untouched, so the pages stay prerendered
// and free and only the counter route ever runs code.
//
// The count lives in a single Durable Object. All access to one object is
// serialised, so a read-increment-write can never race two visitors against
// each other and lose a count — the correct primitive for a shared counter,
// and strongly consistent where Workers KV would only be eventually consistent.

export interface Env {
  // Binding to the prerendered ./dist bundle (see wrangler.jsonc).
  ASSETS: Fetcher;
  // The Durable Object namespace that holds the running total.
  COUNTER: DurableObjectNamespace;
}

// Small helper: a JSON response the browser must not cache, since the whole
// point is a live number.
function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/views") {
      // One well-known object holds the global total for the whole site.
      const stub = env.COUNTER.get(env.COUNTER.idFromName("global"));
      return stub.fetch(request);
    }

    // Anything else is a prerendered page or a static asset.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

// The single source of truth for the running total. Requests to one Durable
// Object are handled one at a time, so the increment below is atomic.
export class Counter implements DurableObject {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    let total = (await this.storage.get<number>("total")) ?? 0;

    // GET reads the total for display; POST records exactly one new visit.
    if (request.method === "POST") {
      total += 1;
      await this.storage.put("total", total);
    }

    return json({ total });
  }
}
