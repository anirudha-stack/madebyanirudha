// Admin-only login for now: one shared password (a Worker secret), exchanged
// for a signed, HttpOnly session cookie. No user table yet; when customer
// accounts arrive this is the file that grows.

const COOKIE = "store_session";
const TTL_S = 60 * 60 * 24 * 14; // two weeks

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Constant-time comparison: hash both sides so lengths never leak. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function checkPassword(given: string, expected: string) {
  return expected.length > 0 && safeEqual(given, expected);
}

export async function sessionCookie(secret: string, secure: boolean) {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  const value = `admin.${exp}`;
  const sig = await hmac(secret, value);
  return `${COOKIE}=${value}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_S}${secure ? "; Secure" : ""}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function isSignedIn(request: Request, secret: string): Promise<boolean> {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 3) return false;
  const [who, exp, sig] = parts;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(secret, `${who}.${exp}`));
}
