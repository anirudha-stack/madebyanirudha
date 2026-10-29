-- Saved builds: a draft keyboard someone is still configuring.
CREATE TABLE builds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,          -- BuildSpec JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Orders: a frozen copy of the spec and its price at the moment of payment,
-- plus the job ticket state the maker works through.
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  build_id TEXT,
  spec TEXT NOT NULL,          -- BuildSpec JSON, frozen
  quote TEXT NOT NULL,         -- Quote JSON, recomputed server-side
  shipping TEXT NOT NULL,      -- address JSON
  payment TEXT NOT NULL,       -- simulated payment record JSON
  status TEXT NOT NULL,
  generator TEXT NOT NULL,     -- generator job states JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX orders_created ON orders (created_at DESC);
CREATE INDEX builds_updated ON builds (updated_at DESC);
