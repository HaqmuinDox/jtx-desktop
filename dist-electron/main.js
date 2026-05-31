import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
createRequire(import.meta.url);
const __filename$1 = fileURLToPath(import.meta.url);
path.dirname(__filename$1);
const DB_PATH = path.join(app.getPath("userData"), "jtx.db");
let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
  }
  return db;
}
function runMigrations(db2) {
  db2.exec(`
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
  `);
}
function closeDb() {
  if (db) {
    db.close();
  }
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  getDb();
  createWindow();
});
app.on("before-quit", () => {
  closeDb();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
