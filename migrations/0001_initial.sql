CREATE TABLE assignments (
  token_hash TEXT PRIMARY KEY,
  giver TEXT NOT NULL,
  recipient TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
