import { Check, Download, FileCode2 } from "lucide-react";
import { useEffect, useState } from "react";
import { wiring } from "../../shared/board";
import { caseByType, finishById, maskById, mcuById, switchById } from "../../shared/catalog";
import { toKle } from "../../shared/kle";
import type { OrderRecord, OrderStatus } from "../../shared/types";
import { api } from "../api";
import { navigate } from "../router";
import { BoardArt } from "../ui/Board";
import { inrText, STATUS_LABEL } from "./Builds";
import { Shell } from "./Shell";

const PIPELINE: { id: OrderStatus; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "files", label: "Files generated" },
  { id: "fabrication", label: "PCB & case made" },
  { id: "packing", label: "Kit packed" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

const date = (t: number) =>
  new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function Orders() {
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  useEffect(() => {
    api.orders().then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <Shell current="orders">
      <main className="page-main">
        <div className="page-head">
          <div>
            <h1>Orders</h1>
            <p>Every paid kit is a job ticket: the frozen build, the pick list and the files it needs.</p>
          </div>
        </div>
        {orders === null ? (
          <div className="empty">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="empty">
            <b>No orders yet</b>
            Finish a build and check out. The first one lands here as #1001.
          </div>
        ) : (
          <div className="panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Board</th>
                  <th>Customer</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="num">#{o.number}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="thumb">
                          <BoardArt spec={o.spec} mode="case" pad={0.1} />
                        </span>
                        {o.spec.name}
                      </div>
                    </td>
                    <td>
                      {o.shipping.name}
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {o.shipping.city}
                      </div>
                    </td>
                    <td className="muted">{date(o.createdAt)}</td>
                    <td>
                      <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="right num">{inrText(o.quote.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}

function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The pick list is a per-viewer convenience: ticks live in this browser only. */
function usePicked(orderId: string) {
  const key = `picked:${orderId}`;
  const [picked, setPicked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* storage blocked: ticks just won't persist */
    }
  };
  return { picked, toggle };
}

export function OrderDetail({ id, placed }: { id: string; placed: boolean }) {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { picked, toggle } = usePicked(id);

  useEffect(() => {
    api.order(id).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <Shell current="orders">
        <main className="page-main">
          <div className="empty">
            <b>That order could not be opened</b>
            {error}
          </div>
        </main>
      </Shell>
    );
  if (!order)
    return (
      <Shell current="orders">
        <div className="loading-screen">Opening the ticket…</div>
      </Shell>
    );

  const idx = PIPELINE.findIndex((p) => p.id === order.status);
  const nextStep = PIPELINE[idx + 1];
  const advance = async () => {
    if (!nextStep) return;
    await api.setStatus(order.id, nextStep.id);
    setOrder({ ...order, status: nextStep.id, updatedAt: Date.now() });
  };

  const s = order.spec;
  const w = wiring(s);
  const kase = caseByType(s.case.type);
  const pickLines = order.quote.lines.filter((l) => l.id !== "files" && l.id !== "packing");

  return (
    <Shell current="orders">
      <main className="page-main">
        {placed && (
          <div className="placed-banner" role="status">
            <span className="check">
              <Check size={20} />
            </span>
            <div>
              <b>Order #{order.number} placed</b>
              <p>
                Payment simulated ({order.payment.reference}). A confirmation would go to {order.shipping.email}.
              </p>
            </div>
          </div>
        )}

        <div className="page-head">
          <div>
            <h1>
              <span className="num">#{order.number}</span> · {s.name}
            </h1>
            <p>
              {order.shipping.name}, {order.shipping.city} · placed {date(order.createdAt)} · {inrText(order.quote.total)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => download(`order-${order.number}-spec.json`, JSON.stringify(s, null, 2))}>
              <Download size={16} /> Build spec
            </button>
            <button type="button" className="btn" onClick={() => download(`order-${order.number}-layout.json`, toKle(s.layout.items, s.name))}>
              <FileCode2 size={16} /> KLE
            </button>
            {nextStep && (
              <button type="button" className="btn btn-primary" onClick={advance}>
                Mark “{nextStep.label}”
              </button>
            )}
          </div>
        </div>

        <div className="panel pipeline" aria-label="Order progress">
          {PIPELINE.map((p, i) => (
            <div key={p.id} className={`pipe-step ${i < idx ? "done" : i === idx ? "current" : ""}`}>
              <span className="pipe-bar" />
              {p.label}
            </div>
          ))}
        </div>

        <div className="ticket" style={{ marginTop: 20 }}>
          <div className="ticket-col">
            <section className="panel ticket-section">
              <div className="summary-art" style={{ height: 260 }}>
                <BoardArt spec={s} mode="case" pad={0.3} legends />
              </div>
              <div className="summary-art" style={{ height: 220 }}>
                <BoardArt spec={s} mode="pcb" pad={0.3} />
              </div>
            </section>

            <section className="panel ticket-section">
              <h2>Build</h2>
              <dl className="kv">
                <dt>MCU</dt>
                <dd>{mcuById(s.electronics.mcu)?.name}</dd>
                <dt>Wiring</dt>
                <dd>
                  {w.wiring.kind === "direct" ? "Direct" : w.wiring.kind === "matrix" ? `${w.wiring.rows} × ${w.wiring.cols} matrix, ${w.diodes} diodes` : "Over pin budget"}
                  {w.encoders ? `, ${w.encoders} encoder${w.encoders > 1 ? "s" : ""}` : ""}
                  {w.oleds ? ", OLED on I²C" : ""}
                </dd>
                <dt>Switches</dt>
                <dd>
                  {switchById(s.electronics.switchId)?.name ?? "Customer's own"} · {s.electronics.switchFamily.toUpperCase()}
                  {s.electronics.hotswap ? ", hotswap" : ", soldered"}
                </dd>
                <dt>Keycaps</dt>
                <dd>{order.quote.lines.find((l) => l.id === "keycaps")?.detail ?? "Customer's own"}</dd>
                <dt>PCB</dt>
                <dd>
                  {maskById(s.pcb.mask)?.name} mask, {s.pcb.silk} silk{s.pcb.logo ? `, logo “${s.pcb.logo.name}”` : ""}
                </dd>
                <dt>Case</dt>
                <dd>
                  {kase?.name}, {finishById(s.case.finish)?.name}
                </dd>
              </dl>
            </section>
          </div>

          <div className="ticket-col">
            <section className="panel ticket-section">
              <h2>Pick list</h2>
              <div className="pick">
                {pickLines.map((l) => (
                  <label key={l.id} className={`pick-row ${picked.has(l.id) ? "checked" : ""}`}>
                    <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} />
                    <span className="pick-name">
                      {l.label}
                      <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                        {l.detail}
                      </span>
                    </span>
                    <span className="num">× {l.qty}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="panel ticket-section">
              <h2>Generated files</h2>
              <div>
                {order.generator.map((j) => (
                  <div className="job" key={j.generator}>
                    <span>{j.label}</span>
                    <span className="job-state" title={j.note}>
                      {j.state === "awaiting-module" ? "Module not connected" : j.state}
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12.5 }}>
                Generator modules plug in later. Until then, make these from the build spec above.
              </p>
            </section>

            <section className="panel ticket-section">
              <h2>Ship to</h2>
              <p style={{ fontSize: 13.5 }}>
                {order.shipping.name}
                <br />
                {order.shipping.line1}
                {order.shipping.line2 && (
                  <>
                    <br />
                    {order.shipping.line2}
                  </>
                )}
                <br />
                {order.shipping.city}, {order.shipping.state} {order.shipping.pincode}
                <br />
                <span className="muted">
                  {order.shipping.phone} · {order.shipping.email}
                </span>
              </p>
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
