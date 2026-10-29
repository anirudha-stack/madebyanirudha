import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { TEMPLATES, newSpec, templateItems } from "../../shared/templates";
import { api } from "../api";
import { BoardArt } from "../ui/Board";

// The showpiece on the login stage: a 75% with legend caps in a silver CNC case.
const SHOWPIECE = (() => {
  const t = TEMPLATES.find((x) => x.id === "ansi-75") ?? TEMPLATES[0];
  const s = newSpec(t.name, templateItems(t));
  s.keycaps = { profile: "cherry", legends: true, colorway: "classic" };
  s.case = { type: "cnc", finish: "cnc-silver" };
  return s;
})();

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-stage studio" aria-hidden>
        <BoardArt spec={SHOWPIECE} mode="case" className="showpiece showpiece-enter" title="A 75% keyboard" />
        <div className="login-copy">
          <h1>Design the keyboard. We make the kit.</h1>
          <p>Arrange the keys, choose the parts, see it turn in 3D. The PCB, the case and the files are made for your exact layout.</p>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="wordmark">
            madebyanirudha <span className="wordmark-store">store</span>
          </div>
          <h2>Sign in</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            The store is in private preview. Admins only for now.
          </p>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && (
              <span className="error-text" id="login-error" role="alert">
                {error}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !password}>
            {busy ? "Signing in…" : "Sign in"} <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}
