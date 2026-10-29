-- Logo uploads live in D1 until R2 is enabled on the account (R2 needs a
-- payment method on file, even on the free tier). Capped at 1 MB by the Worker,
-- well inside D1's 2 MB row limit.
CREATE TABLE uploads (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  body BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
