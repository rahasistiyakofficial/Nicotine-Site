-- One row per day (Asia/Dhaka). The total is SUM(count).
-- Run once:  npx wrangler d1 execute nicotine-downloads --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS downloads (
  day   TEXT PRIMARY KEY,           -- 'YYYY-MM-DD'
  count INTEGER NOT NULL DEFAULT 0
);
