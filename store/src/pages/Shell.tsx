import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { api, SIGNED_OUT } from "../api";
import { linkProps } from "../router";

export function Shell({ children, current }: { children: ReactNode; current?: "builds" | "orders" }) {
  const signOut = async () => {
    await api.logout().catch(() => {});
    window.dispatchEvent(new Event(SIGNED_OUT));
  };
  return (
    <div className="page studio">
      <header className="topbar">
        <div className="topbar-left">
          <a className="wordmark" {...linkProps("/")}>
            madebyanirudha <span className="wordmark-store">store</span>
          </a>
        </div>
        <nav className="steps" aria-label="Main">
          <a className="step" aria-current={current === "builds" ? "step" : undefined} {...linkProps("/")} style={{ textDecoration: "none" }}>
            Builds
          </a>
          <a className="step" aria-current={current === "orders" ? "step" : undefined} {...linkProps("/orders")} style={{ textDecoration: "none" }}>
            Orders
          </a>
        </nav>
        <div className="topbar-right">
          <span className="tag">Admin</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
