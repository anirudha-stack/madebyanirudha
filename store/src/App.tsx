import { useEffect, useState } from "react";
import { api, SIGNED_OUT } from "./api";
import { Configurator, STEPS, type StepId } from "./config/Configurator";
import { Builds } from "./pages/Builds";
import { Checkout } from "./pages/Checkout";
import { Login } from "./pages/Login";
import { OrderDetail, Orders } from "./pages/Orders";
import { Start } from "./pages/Start";
import { match, useLocation } from "./router";

type Auth = "checking" | "in" | "out";

export function App() {
  const [auth, setAuth] = useState<Auth>("checking");
  const { path, query } = useLocation();

  useEffect(() => {
    api
      .me()
      .then(() => setAuth("in"))
      .catch(() => setAuth("out"));
    const out = () => setAuth("out");
    window.addEventListener(SIGNED_OUT, out);
    return () => window.removeEventListener(SIGNED_OUT, out);
  }, []);

  if (auth === "checking") return <div className="loading-screen studio" />;
  if (auth === "out") return <Login onSignedIn={() => setAuth("in")} />;

  let page: React.ReactNode;
  let m: Record<string, string> | null;
  if (path === "/" || path === "") page = <Builds />;
  else if (path === "/new") page = <Start />;
  else if ((m = match("/build/:id", path))) {
    const s = query.get("step") as StepId | null;
    const step = s && STEPS.some((x) => x.id === s) ? s : "layout";
    page = <Configurator key={m.id} id={m.id} step={step} />;
  } else if ((m = match("/checkout/:id", path))) page = <Checkout id={m.id} />;
  else if (path === "/orders") page = <Orders />;
  else if ((m = match("/orders/:id", path))) page = <OrderDetail id={m.id} placed={query.get("placed") === "1"} />;
  else
    page = (
      <div className="loading-screen studio">
        <div className="empty">
          <b>Nothing here</b>
          <a href="/">Back to your builds</a>
        </div>
      </div>
    );

  return (
    <>
      {page}
      <div className="narrow-warning" role="alert">
        <div>
          <b>Best on a bigger screen</b>
          <span className="muted">The keyboard editor needs a desktop or laptop for now.</span>
        </div>
      </div>
    </>
  );
}
