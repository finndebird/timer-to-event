import Database from 'better-sqlite3';

export const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS timers (
    id TEXT PRIMARY KEY,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    createdBy TEXT NOT NULL,
    eventTimeMs INTEGER NOT NULL,
    intervalMs INTEGER NOT NULL,
    nextReminderAtMs INTEGER,
    remainingIntervals INTEGER NOT NULL,
    message TEXT,
    createdAtMs INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_due ON timers(nextReminderAtMs);
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_per_channel
    ON timers (guildId, channelId, eventTimeMs);
`);
