/*
  Database bootstrap with runtime fallback:
  - Prefer better-sqlite3 (native, fastest)
  - Fallback to sql.js (pure WASM) on platforms where native builds fail (e.g., Termux without NDK)
*/

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';

const DB_FILE = resolve('data.sqlite');

type StatementLike = {
  run: (...args: any[]) => { changes?: number } | void;
  all: (...args: any[]) => any[];
  get?: (...args: any[]) => any | undefined;
};

type DatabaseLike = {
  prepare: (sql: string) => StatementLike;
  exec: (sql: string) => void;
  pragma?: (cmd: string) => void;
};

let db: DatabaseLike;

async function initDb(): Promise<DatabaseLike> {
  try {
    // Try native driver first
    const BetterSqlite3 = (await import('better-sqlite3')).default as any;
    const nativeDb = new BetterSqlite3(DB_FILE);
    if (typeof nativeDb.pragma === 'function') {
      nativeDb.pragma('journal_mode = WAL');
    }
    return nativeDb as DatabaseLike;
  } catch {
    // Fallback: sql.js (WASM)
    const initSqlJs = (await import('sql.js')).default as any;
    const require = createRequire(import.meta.url);
    const wasmPath: string = require.resolve('sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        if (file === 'sql-wasm.wasm') return wasmPath;
        // Fallback to dist path resolution
        return require.resolve(`sql.js/dist/${file}`);
      },
    });
    const fileBuffer = existsSync(DB_FILE)
      ? await readFile(DB_FILE)
      : undefined;
    const wasmDb = new SQL.Database(
      fileBuffer ? new Uint8Array(fileBuffer) : undefined
    );

    async function persist() {
      const data = wasmDb.export();
      await writeFile(DB_FILE, Buffer.from(data));
    }

    const wrapper: DatabaseLike = {
      prepare(sql: string): StatementLike {
        const stmt = wasmDb.prepare(sql);
        const run = (...args: any[]) => {
          stmt.reset();
          if (args.length > 0) stmt.bind(args);
          const before =
            typeof wasmDb.getRowsModified === 'function'
              ? wasmDb.getRowsModified()
              : 0;
          // For INSERT/UPDATE/DELETE, stepping through is enough
          while (stmt.step()) {
            // drain
          }
          const after =
            typeof wasmDb.getRowsModified === 'function'
              ? wasmDb.getRowsModified()
              : before;
          const changes = Math.max(0, Number(after) - Number(before));
          void persist();
          return { changes };
        };
        const all = (...args: any[]) => {
          stmt.reset();
          if (args.length > 0) stmt.bind(args);
          const rows: any[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        };
        const get = (...args: any[]) => {
          const rows = all(...args);
          return rows[0];
        };
        return { run, all, get };
      },
      exec(sql: string) {
        wasmDb.exec(sql);
        void persist();
      },
    };

    return wrapper;
  }
}

// Initialize synchronously for consumers via top-level await
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS top-level await is allowed in ESM/NodeNext
db = await initDb();

export { db };

// Ensure schema exists
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
