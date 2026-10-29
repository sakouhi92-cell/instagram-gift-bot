-- D1 database for the DM bot. Run once: npx wrangler d1 execute dm-bot --remote --file=schema.sql

-- One row per person who asked for the gift
CREATE TABLE IF NOT EXISTS users (
  igsid         TEXT PRIMARY KEY,          -- Instagram-scoped user id
  username      TEXT,
  status        TEXT NOT NULL DEFAULT 'asked', -- asked | gift_sent
  asked_at      INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,          -- last message/click from them (24h window)
  gift_sent_at  INTEGER,
  gift_count    INTEGER NOT NULL DEFAULT 0,
  gift          TEXT,                      -- gift id from messages.js GIFTS (last one asked)
  gifts_sent    TEXT                       -- every gift id already delivered, like ",claude,client,"
);

-- Every comment the bot looked at (stops double replies)
CREATE TABLE IF NOT EXISTS comments (
  comment_id  TEXT PRIMARY KEY,
  igsid       TEXT,
  username    TEXT,
  media_id    TEXT,
  text        TEXT,
  matched     INTEGER NOT NULL DEFAULT 0,  -- 1 = it was PM
  source      TEXT NOT NULL,               -- webhook | cron
  handled_at  INTEGER NOT NULL
);

-- Messages waiting to be sent or retried
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,               -- dm | comment_reply
  target      TEXT NOT NULL,               -- igsid, or comment id
  payload     TEXT NOT NULL,               -- JSON body
  attempts    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | sent | dead
  last_error  TEXT,
  next_at     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox (status, next_at);

-- Extra spellings of PM the bot learned by itself
CREATE TABLE IF NOT EXISTS keywords (
  word      TEXT PRIMARY KEY,
  source    TEXT NOT NULL,                 -- learned | manual
  added_at  INTEGER NOT NULL,
  gift      TEXT NOT NULL DEFAULT 'claude' -- gift id this spelling belongs to
);

-- Unknown comments, used for learning
CREATE TABLE IF NOT EXISTS unknown_words (
  word     TEXT NOT NULL,
  igsid    TEXT NOT NULL,
  seen_at  INTEGER NOT NULL,
  hit      INTEGER NOT NULL DEFAULT 0,     -- 1 = this person wrote PM within 10 minutes after
  PRIMARY KEY (word, igsid)
);

-- Webhook events already handled (Meta sometimes sends the same event twice)
CREATE TABLE IF NOT EXISTS events_seen (
  id  TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);

-- Connection to Instagram, filled by /setup (page token never shown anywhere)
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Silent log (no alerts)
CREATE TABLE IF NOT EXISTS log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  kind    TEXT NOT NULL,
  detail  TEXT
);
