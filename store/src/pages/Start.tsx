import { Plus } from "lucide-react";
import { useState } from "react";
import { parseKle } from "../../shared/kle";
import { quote } from "../../shared/pricing";
import { newSpec, TEMPLATES, templateItems } from "../../shared/templates";
import type { Item } from "../../shared/types";
import { api } from "../api";
import { navigate } from "../router";
import { BoardArt } from "../ui/Board";
import { inrText } from "./Builds";
import { Shell } from "./Shell";

const PREVIEWS = TEMPLATES.map((t) => ({ t, spec: newSpec(t.name, templateItems(t)) }));

export function Start() {
  const [busy, setBusy] = useState<string | null>(null);
  const [kle, setKle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = async (key: string, name: string, items: Item[]) => {
    setBusy(key);
    setError(null);
    try {
      const { id } = await api.createBuild(newSpec(name, items));
      navigate(`/build/${id}?step=layout`, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the build.");
      setBusy(null);
    }
  };

  const importKle = () => {
    try {
      const r = parseKle(kle);
      create("kle", r.name ?? "Imported layout", r.items);
    } catch (e) {
      setError(`Couldn't read that layout: ${e instanceof Error ? e.message : "unknown format"}`);
    }
  };

  return (
    <Shell current="builds">
      <main className="page-main">
        <div className="page-head">
          <div>
            <h1>What are you building?</h1>
            <p>Start from a shape and make it yours. Every key can move, resize or go; nothing here is fixed.</p>
          </div>
        </div>

        {error && (
          <div className="notice notice-bad" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="start-grid">
          {PREVIEWS.map(({ t, spec }) => (
            <button
              type="button"
              key={t.id}
              className="board-card"
              disabled={!!busy}
              onClick={() => create(t.id, t.name, spec.layout.items)}
            >
              <div className="board-card-art">
                <BoardArt spec={spec} mode="case" pad={0.3} legends className="showpiece" />
              </div>
              <div className="board-card-body">
                <h3>{busy === t.id ? "Setting up…" : t.name}</h3>
                <div className="board-card-meta">
                  <span>{t.blurb}</span>
                </div>
                <div className="board-card-meta">
                  <span>{spec.layout.items.filter((i) => i.kind === "key").length} keys</span>
                  <span className="num">from {inrText(quote(spec).total)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="start-split">
          <button type="button" className="new-card" disabled={!!busy} onClick={() => create("blank", "Untitled build", [])}>
            <span className="new-card-plus" aria-hidden>
              <Plus size={22} />
            </span>
            {busy === "blank" ? "Setting up…" : "Blank grid"}
            <span className="muted" style={{ fontWeight: 400, fontSize: 13.5 }}>
              Place every key yourself.
            </span>
          </button>
          <div className="panel import-panel">
            <div className="group-title">Import from Keyboard Layout Editor</div>
            <textarea
              className="textarea"
              value={kle}
              onChange={(e) => setKle(e.target.value)}
              placeholder={'Paste raw data or the downloaded JSON\n["Esc","F1","F2"],\n[{w:1.5},"Tab","Q"]'}
              aria-label="KLE raw data"
            />
            <button type="button" className="btn" disabled={!kle.trim() || !!busy} onClick={importKle}>
              {busy === "kle" ? "Importing…" : "Import layout"}
            </button>
          </div>
        </div>
      </main>
    </Shell>
  );
}
