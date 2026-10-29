import type { BuildRecord, BuildSpec, OrderRecord, OrderStatus, Shipping } from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fired on any 401 so the app can drop back to the login screen. */
export const SIGNED_OUT = "store:signed-out";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "login") window.dispatchEvent(new Event(SIGNED_OUT));
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Request failed.");
  }
  return data as T;
}

export const api = {
  login: (password: string) => call<{ ok: true }>("POST", "login", { password }),
  logout: () => call<{ ok: true }>("POST", "logout", {}),
  me: () => call<{ role: string }>("GET", "me"),

  builds: () => call<BuildRecord[]>("GET", "builds"),
  build: (id: string) => call<BuildRecord>("GET", `builds/${id}`),
  createBuild: (spec: BuildSpec) => call<{ id: string }>("POST", "builds", { spec }),
  saveBuild: (id: string, spec: BuildSpec) => call<{ ok: true }>("PUT", `builds/${id}`, { spec }),
  deleteBuild: (id: string) => call<{ ok: true }>("DELETE", `builds/${id}`),

  orders: () => call<OrderRecord[]>("GET", "orders"),
  order: (id: string) => call<OrderRecord>("GET", `orders/${id}`),
  placeOrder: (body: { buildId: string; spec: BuildSpec; shipping: Shipping; method: string }) =>
    call<OrderRecord>("POST", "orders", body),
  setStatus: (id: string, status: OrderStatus) => call<{ ok: true }>("PATCH", `orders/${id}`, { status }),

  async upload(file: File): Promise<{ key: string }> {
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": file.type },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Upload failed.");
    return data as { key: string };
  },
};

export const fileUrl = (key: string) => `/api/uploads/${key}`;
