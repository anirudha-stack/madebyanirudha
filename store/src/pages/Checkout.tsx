import { ArrowLeft, CreditCard, FlaskConical, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { quote } from "../../shared/pricing";
import type { BuildSpec, Shipping } from "../../shared/types";
import { api } from "../api";
import { linkProps, navigate } from "../router";
import { BoardArt } from "../ui/Board";
import { inrText } from "./Builds";
import { Shell } from "./Shell";

const EMPTY: Shipping = { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" };

const FIELDS: { k: keyof Shipping; label: string; span?: boolean; auto: string; optional?: boolean; type?: string }[] = [
  { k: "name", label: "Full name", span: true, auto: "name" },
  { k: "phone", label: "Phone", auto: "tel", type: "tel" },
  { k: "email", label: "Email", auto: "email", type: "email" },
  { k: "line1", label: "Address", span: true, auto: "address-line1" },
  { k: "line2", label: "Apartment, landmark", span: true, auto: "address-line2", optional: true },
  { k: "city", label: "City", auto: "address-level2" },
  { k: "state", label: "State", auto: "address-level1" },
  { k: "pincode", label: "PIN code", auto: "postal-code" },
];

function problems(s: Shipping): Partial<Record<keyof Shipping, string>> {
  const p: Partial<Record<keyof Shipping, string>> = {};
  for (const f of FIELDS) if (!f.optional && !s[f.k].trim()) p[f.k] = "Required";
  if (s.pincode && !/^\d{6}$/.test(s.pincode)) p.pincode = "Six digits";
  if (s.phone && !/^[+\d][\d\s-]{9,}$/.test(s.phone)) p.phone = "Ten digits";
  if (s.email && !/^\S+@\S+\.\S+$/.test(s.email)) p.email = "Check the address";
  return p;
}

export function Checkout({ id }: { id: string }) {
  const [spec, setSpec] = useState<BuildSpec | null>(null);
  const [ship, setShip] = useState<Shipping>(EMPTY);
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.build(id).then((b) => setSpec(b.spec)).catch((e) => setError(e.message));
  }, [id]);

  const errs = problems(ship);
  const q = spec ? quote(spec) : null;

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!spec || Object.keys(errs).length) return;
    setPaying(true);
    setError(null);
    // The payment step is simulated: hold for a beat so it feels like a gateway.
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const order = await api.placeOrder({ buildId: id, spec, shipping: ship, method });
      navigate(`/orders/${order.id}?placed=1`, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The order didn't go through.");
      setPaying(false);
    }
  };

  return (
    <Shell>
      <main className="page-main">
        <div className="page-head">
          <div>
            <a className="btn btn-ghost btn-sm" {...linkProps(`/build/${id}?step=review`)} style={{ marginLeft: -12, marginBottom: 8 }}>
              <ArrowLeft size={15} /> Back to review
            </a>
            <h1>Checkout</h1>
          </div>
          <span className="test-chip">
            <FlaskConical size={14} /> Test mode: no money moves
          </span>
        </div>

        {error && (
          <div className="notice notice-bad" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form className="checkout" onSubmit={pay} noValidate>
          <div className="panel checkout-form">
            <section className="group">
              <h2 style={{ fontSize: 17 }}>Where should the kit go?</h2>
              <div className="form-grid">
                {FIELDS.map((f) => (
                  <div className={`field ${f.span ? "span-2" : ""}`} key={f.k}>
                    <label htmlFor={`ship-${f.k}`}>
                      {f.label}
                      {f.optional && <span className="muted"> (optional)</span>}
                    </label>
                    <input
                      id={`ship-${f.k}`}
                      className="input"
                      type={f.type ?? "text"}
                      autoComplete={f.auto}
                      inputMode={f.k === "pincode" ? "numeric" : undefined}
                      value={ship[f.k]}
                      aria-invalid={touched && !!errs[f.k]}
                      onChange={(e) => setShip({ ...ship, [f.k]: e.target.value })}
                    />
                    {touched && errs[f.k] && <span className="error-text">{errs[f.k]}</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className="group">
              <h2 style={{ fontSize: 17 }}>Payment</h2>
              <div className="pay-methods" role="radiogroup">
                <button type="button" role="radio" className="tile" aria-checked={method === "upi"} onClick={() => setMethod("upi")}>
                  <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <Smartphone size={16} /> UPI
                  </span>
                  <span className="tile-sub">GPay, PhonePe, Paytm</span>
                </button>
                <button type="button" role="radio" className="tile" aria-checked={method === "card"} onClick={() => setMethod("card")}>
                  <span className="tile-name" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <CreditCard size={16} /> Card
                  </span>
                  <span className="tile-sub">Visa, Mastercard, RuPay</span>
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>
                In test mode the payment is simulated and marked as such on the order. A real gateway replaces this step at launch.
              </p>
            </section>
          </div>

          <aside className="panel summary" aria-label="Order summary">
            <div className="summary-art">{spec && <BoardArt spec={spec} mode="case" pad={0.3} />}</div>
            <div>
              <h2 style={{ fontSize: 17 }}>{spec?.name ?? "…"}</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                DIY kit · ships in 7–14 days
              </p>
            </div>
            {q && (
              <div className="lines">
                {q.lines
                  .filter((l) => l.total > 0)
                  .map((l) => (
                    <div className="qline" key={l.id}>
                      <span className="qline-label">
                        {l.label}
                        {l.qty > 1 && <span className="muted num"> × {l.qty}</span>}
                      </span>
                      <span className="qline-total">{inrText(l.total)}</span>
                    </div>
                  ))}
                <div className="qline">
                  <span className="qline-label">Shipping</span>
                  <span className="qline-total">{inrText(q.shipping)}</span>
                </div>
              </div>
            )}
            <div className="total-row">
              <span>Total</span>
              <span className="num">{q ? inrText(q.total) : "…"}</span>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!spec || paying}>
              {paying ? (
                <span className="processing">
                  <span className="spinner" /> Processing payment…
                </span>
              ) : (
                `Pay ${q ? inrText(q.total) : ""}`
              )}
            </button>
          </aside>
        </form>
      </main>
    </Shell>
  );
}
