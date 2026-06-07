import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

const DB_PATH = path.join(app.getPath('userData'), 'jtx.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string,
  defaultVal?: string
) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!info.find(col => col.name === column)) {
    const def = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : ''
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${def}`)
  }
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      url           TEXT PRIMARY KEY,
      display_name  TEXT,
      type          TEXT,
      ctag          TEXT,
      color         TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      title         TEXT,
      body          TEXT,
      start_date    TEXT,
      due_date      TEXT,
      status        TEXT,
      priority      INTEGER,
      progress      INTEGER,
      rrule         TEXT,
      categories    TEXT,
      parent_uid    TEXT,
      collection    TEXT NOT NULL,
      etag          TEXT,
      dirty         INTEGER DEFAULT 1,
      deleted       INTEGER DEFAULT 0,
      created_at    TEXT,
      updated_at    TEXT,
      FOREIGN KEY (collection) REFERENCES collections(url)
    );

    CREATE TABLE IF NOT EXISTS entry_links (
      from_uid      TEXT NOT NULL,
      to_uid        TEXT NOT NULL,
      rel_type      TEXT,
      PRIMARY KEY (from_uid, to_uid)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_type    ON entries(type);
    CREATE INDEX IF NOT EXISTS idx_entries_dirty   ON entries(dirty);
    CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted);
  `)

  // Additive migrations for new fields — safe to run on existing databases
  addColumnIfMissing(db, 'entries', 'completed_date',  'TEXT')
  addColumnIfMissing(db, 'entries', 'location',        'TEXT')
  addColumnIfMissing(db, 'entries', 'url',             'TEXT')
  addColumnIfMissing(db, 'entries', 'classification',  'TEXT')
  addColumnIfMissing(db, 'entries', 'color',           'TEXT')
  addColumnIfMissing(db, 'entries', 'comment',         'TEXT')
  addColumnIfMissing(db, 'entries', 'contact',         'TEXT')
  addColumnIfMissing(db, 'entries', 'geo',             'TEXT')
  addColumnIfMissing(db, 'entries', 'duration',        'TEXT')
  addColumnIfMissing(db, 'entries', 'alarms',          'TEXT')
  addColumnIfMissing(db, 'entries', 'exdate',          'TEXT')
  addColumnIfMissing(db, 'entries', 'sequence',        'INTEGER', '0')
}

export function closeDb() {
  if (db) {
    db.close()
  }
}
