import { app, ipcMain, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
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
function registerIpcHandlers() {
  ipcMain.handle("collections:getAll", () => {
    const db2 = getDb();
    return db2.prepare("SELECT * FROM collections").all();
  });
  ipcMain.handle("collections:upsert", (_event, collection) => {
    const db2 = getDb();
    db2.prepare(`
            INSERT INTO collections (url, display_name, type, ctag, color)
            VALUES (@url, @display_name, @type, @ctag, @color)
                ON CONFLICT(url) DO UPDATE SET
                display_name = excluded.display_name,
                                        type         = excluded.type,
                                        ctag         = excluded.ctag,
                                        color        = excluded.color
        `).run(collection);
    return { ok: true };
  });
  ipcMain.handle("entries:getAll", (_event, filters) => {
    const db2 = getDb();
    let query = "SELECT * FROM entries WHERE deleted = 0";
    const params = {};
    if (filters == null ? void 0 : filters.type) {
      query += " AND type = @type";
      params.type = filters.type;
    }
    if (filters == null ? void 0 : filters.collection) {
      query += " AND collection = @collection";
      params.collection = filters.collection;
    }
    query += " ORDER BY COALESCE(start_date, created_at) DESC";
    return db2.prepare(query).all(params);
  });
  ipcMain.handle("entries:getById", (_event, id) => {
    const db2 = getDb();
    return db2.prepare("SELECT * FROM entries WHERE id = ?").get(id);
  });
  ipcMain.handle("entries:create", (_event, entry) => {
    const db2 = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = entry.id ?? randomUUID();
    db2.prepare(`
      INSERT INTO entries (
        id, type, title, body, start_date, due_date, status,
        priority, progress, rrule, categories, parent_uid,
        collection, etag, dirty, deleted, created_at, updated_at
      ) VALUES (
        @id, @type, @title, @body, @start_date, @due_date, @status,
        @priority, @progress, @rrule, @categories, @parent_uid,
        @collection, @etag, 1, 0, @created_at, @updated_at
      )
    `).run({
      id,
      type: entry.type,
      title: entry.title ?? null,
      body: entry.body ?? null,
      start_date: entry.start_date ?? null,
      due_date: entry.due_date ?? null,
      status: entry.status ?? null,
      priority: entry.priority ?? null,
      progress: entry.progress ?? null,
      rrule: entry.rrule ?? null,
      categories: entry.categories ?? null,
      parent_uid: entry.parent_uid ?? null,
      collection: entry.collection,
      etag: entry.etag ?? null,
      created_at: now,
      updated_at: now
    });
    return { id };
  });
  ipcMain.handle("entries:update", (_event, id, fields) => {
    const db2 = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const allowed = [
      "title",
      "body",
      "start_date",
      "due_date",
      "status",
      "priority",
      "progress",
      "rrule",
      "categories",
      "parent_uid",
      "etag"
    ];
    const updates = Object.keys(fields).filter((k) => allowed.includes(k)).map((k) => `${k} = @${k}`).join(", ");
    if (!updates) return { ok: false, reason: "no valid fields" };
    db2.prepare(`
      UPDATE entries SET ${updates}, updated_at = @updated_at, dirty = 1
      WHERE id = @id
    `).run({ ...fields, updated_at: now, id });
    return { ok: true };
  });
  ipcMain.handle("entries:delete", (_event, id) => {
    const db2 = getDb();
    db2.prepare(`
      UPDATE entries SET deleted = 1, dirty = 1, updated_at = @updated_at
      WHERE id = @id
    `).run({ updated_at: (/* @__PURE__ */ new Date()).toISOString(), id });
    return { ok: true };
  });
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
  registerIpcHandlers();
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
