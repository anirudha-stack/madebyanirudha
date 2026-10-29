import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { quote } from "../../shared/pricing";
import type { BuildRecord, OrderRecord } from "../../shared/types";
import { api } from "../api";
import { linkProps, navigate } from "../router";
import { BoardArt } from "../ui/Board";
import { Shell } from "./Shell";

export const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const inrText = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function Builds() {
  const [builds, setBuilds] = useState<BuildRecord[] | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.builds().then(setBuilds).catch((e) => setError(e.message));
    api.orders().then(setOrders).catch(() => {});
  }, []);

  const remove = async (id: string) => {
    await api.deleteBuild(id);
    setBuilds((b) => b?.filter((x) => x.id !== id) ?? null);
  };

  return (
    <Shell current="builds">
      <main className="page-main">
        <div className="page-head">
          <div>
            <h1>Your builds</h1>
            <p>Every keyboard you've started. They save as you go, so pick up any of them where you left off.</p>
          </div>
          <a className="btn btn-primary btn-lg" {...linkProps("/new")}>
            <Plus size={18} /> New build
          </a>
        </div>

        {error && <div className="notice notice-bad">{error}</div>}

        <div className="card-grid">
          <a className="new-card" {...linkProps("/new")}>
            <span className="new-card-plus">
              <Plus size={22} />
            </span>
            Start a new keyboard
          </a>
          {builds === null && !error && <div className="empty">Loading builds…</div>}
          {builds?.map((b) => (
            <article key={b.id} style={{ position: "relative" }}>
              <button type="button" className="board-card" style={{ width: "100%" }} onClick={() => navigate(`/build/${b.id}`)}>
                <div className="board-card-art">
                  <BoardArt spec={b.spec} mode="case" pad={0.3} className="showpiece" />
                </div>
                <div className="board-card-body">
                  <h3>{b.name || "Untitled build"}</h3>
                  <div className="board-card-meta">
                    <span>
                      {b.spec.layout.items.filter((i) => i.kind === "key").length} keys · {ago(b.updatedAt)}
                    </span>
                    <span className="num" style={{ color: "var(--ink)" }}>
                      {inrText(quote(b.spec).total)}
                    </span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger card-delete"
                onClick={() => remove(b.id)}
                aria-label={`Delete ${b.name}`}
              >
                Delete
              </button>
            </article>
          ))}
        </div>

        {builds?.length === 0 && (
          <p className="muted" style={{ marginTop: 16 }}>
            No builds yet. Start with a two-key copy/paste pad. It takes about a minute.
          </p>
        )}

        {orders.length > 0 && (
          <>
            <h2 className="section-title">Recent orders</h2>
            <div className="panel">
              <table className="table">
                <tbody>
                  {orders.slice(0, 4).map((o) => (
                    <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                      <td className="num">#{o.number}</td>
                      <td>{o.spec.name}</td>
                      <td>
                        <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td className="right num">{inrText(o.quote.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

export const STATUS_LABEL: Record<OrderRecord["status"], string> = {
  paid: "Paid",
  files: "Files",
  fabrication: "Fabrication",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
};
