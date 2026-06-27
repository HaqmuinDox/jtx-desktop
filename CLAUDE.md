# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Rebuild native module for Electron (required after npm install or Node version change)
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3

# Start development server with hot reload
npm run dev

# Build for production (runs tsc + vite build + electron-builder)
npm run build

# Lint (strict — zero warnings allowed)
npm run lint
```

There is no test framework configured.

## Architecture

JTX Desktop is an **Electron + React + SQLite** desktop companion to jtx Board (Android). It manages journals, notes, and tasks locally and syncs them bidirectionally with Nextcloud via CalDAV.

### Process split

```
electron/          ← Main process (Node.js)
  main.ts          — Window creation, app lifecycle, DB init, startup sync
  db.ts            — Opens SQLite at %APPDATA%\jtx-desktop\jtx.db; runs schema migrations
  ipc.ts           — All IPC handlers; the only path from renderer to native APIs
  preload.ts       — contextBridge; exposes window.api to the renderer
  sync/
    engine.ts      — Sync loop: discover → push dirty/deleted → pull changed
    caldav.ts      — tsdav wrapper; hardcoded to Nextcloud's /remote.php/dav endpoint
    ical.ts        — Converts between .ics text and local Entry objects

src/               ← Renderer process (React)
  App.tsx          — Root layout: sidebar + content + detail panel + sync bar
  store/app.ts     — Zustand store (active section, entries list, selected entry, sync status)
  components/      — One component per view (JournalsView, NotesView, TodosView, SettingsView…)

shared/types.ts    — Shared TypeScript types (Entry, Collection, SyncStatus) used by both processes
```

### Key design decisions

**Single entry table, three types.** `type` field discriminates `'journal'` | `'note'` | `'todo'`. Journals have `DTSTART` and appear in a timeline; notes have no date and appear in a grid; todos carry status, priority, and due date.

**Notes and journals share the same iCal component.** Both map to `VJOURNAL` on the wire. The type is determined at parse time: if `DTSTART` is present → `'journal'`; if absent → `'note'`. `serializeEntry` always writes a `VJOURNAL` for both.

**Soft deletes.** `entries:delete` sets `deleted=1, dirty=1`; the sync engine pushes the DELETE to the server before removing the row locally. Never hard-delete without going through this path.

**ETag-based sync.** `fetchEtags()` returns a cheap server snapshot. Engine compares ETags to local records: mismatched ETag → pull, local-only with non-null ETag → server deleted it (delete locally), `dirty=1` → push. Last-write-wins.

**IPC bridge.** Renderer never touches the filesystem, DB, or network directly. All calls go through `window.api` (defined in `preload.ts`). Keep this boundary clean. The four namespaces exposed are:
- `window.api.entries` — `getAll`, `getById`, `create`, `update`, `delete`
- `window.api.collections` — `getAll`, `upsert`
- `window.api.sync` — `getStatus`, `now`, `setCredentials`, `testConnection`, `resetCache`, `getDirtyEntries`
- `window.api.credentials` — `save`, `load`

**Markdown in iCal.** Entry body is stored as Markdown in the iCal `DESCRIPTION` field. The editor (`EntryEditor.tsx`) uses Tiptap with StarterKit, which works in HTML internally. A custom `markdownToHtml` / `htmlToMarkdown` converter (in the same file) bridges the formats. This converter is intentionally simple — it handles the subset of Markdown that jtx Board supports, not the full spec.

**Schema migrations.** New columns are added via `addColumnIfMissing()` in `db.ts`, never via `DROP`/`CREATE`. Always use this pattern to stay backwards-compatible with existing databases.

**`entry_links` table.** Exists in the SQLite schema (tracks PARENT/CHILD/SIBLING relationships) but has no IPC handlers yet. It is not currently exposed to the renderer.

### Data flow

```
React component
  → window.api.entries.*  (IPC)
  → electron/ipc.ts handler
  → SQLite
  → IPC reply
  → Zustand store update
  → React re-render

Sync (engine.ts::syncCollection order):
  1. Push local deletions to server, then hard-delete locally
  2. Push dirty (modified) entries to server, clear dirty flag
  3. Fetch remote ETags snapshot
  4. Detect server deletions: active local entries with a non-null ETag
     that are absent from the remote snapshot → hard-delete locally
  5. Pull entries whose ETag differs or which are new → upsert into SQLite

  SettingsView saves credentials (encrypted via Electron safeStorage)
  → engine.ts::sync()
    → caldav.discoverCollections()
    → syncCollection() per collection (steps 1–5 above)
  → SyncBar polls window.api.sync.getStatus()
```

### Credentials & storage

- Credentials encrypted with Electron `safeStorage` at `%APPDATA%\jtx-desktop\credentials.enc`
- Database at `%APPDATA%\jtx-desktop\jtx.db` (SQLite, WAL mode, foreign keys on)
- Sync interval: 5 minutes default; also fires on startup and app close

### Native module note

`better-sqlite3` is a native Node.js addon. After any `npm install` or Node/Electron version change, run:
```bash
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3
```
Vite externalizes it from the bundle (`vite.config.ts`) so it loads as a native module at runtime.
