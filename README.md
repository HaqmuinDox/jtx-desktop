# JTX Desktop — Journals, Notes & Tasks for Desktop

> A local-first desktop companion to [jtx Board](https://jtx.techbee.at/), built with Electron + React + SQLite. Syncs bidirectionally with Nextcloud over CalDAV using the iCalendar standard.

---

## Project Goal

Build a **desktop application** that mirrors the core functionality of jtx Board — managing Journals, Notes, and ToDos — in a way that is **fully interoperable** with jtx Board on Android. An entry created on this desktop app must be readable, editable, and deletable from jtx Board, and vice versa. Nextcloud acts as the sync server.

---

## Core Principles

- **Local-first**: All data is stored in a local SQLite database. The app works fully offline.
- **CalDAV sync**: When online, the app syncs with a Nextcloud server over CalDAV using the iCalendar standard (RFC 5545).
- **jtx Board compatible**: This app must produce and consume the exact same `VJOURNAL` and `VTODO` iCal components that jtx Board uses. No proprietary formats.
- **No vendor lock-in**: Because the data format is open (iCalendar), the user is free to change apps, servers, or clients at any time.

---

## Tech Stack

| Layer            | Technology                        | Reason                                                                                     |
|------------------|-----------------------------------|--------------------------------------------------------------------------------------------|
| Desktop shell    | **Electron**                      | Cross-platform (Windows, Mac, Linux), full filesystem access, offline-capable              |
| UI framework     | **React**                         | Component-based, large ecosystem, well-supported in Electron                               |
| Local database   | **SQLite** via `better-sqlite3`   | Fast, serverless, file-based local persistence                                             |
| CalDAV client    | **tsdav** (TypeScript/JS)         | Handles CalDAV discovery, ETag diffing, and sync with Nextcloud                            |
| iCal parser      | **ical.js**                       | Parses and serializes `.ics` data (VJOURNAL, VTODO components)                             |
| Rich text editor | **TipTap** (built on ProseMirror) | Supports both rich text and Markdown; content stored as Markdown in iCal DESCRIPTION field |
| Language         | **TypeScript**                    | Type safety across the entire stack                                                        |

---

## The Three Entry Types

The app manages three types of content, directly mirroring jtx Board and the iCalendar standard:

### 1. Journal (`VJOURNAL` with `DTSTART`)
- A date-stamped entry: diary entries, meeting minutes, daily logs
- Has a start date (autopopulated)
- Displayed in a chronological timeline view
- Can be linked to ToDos

### 2. Note (`VJOURNAL` without `DTSTART`)
- A floating, undated entry: ideas, references, snippets
- No required fields beyond a title/body
- Displayed in a grid or list view
- Supports pinning/starring

### 3. ToDo (`VTODO`)
- A task with optional due date, priority, and status
- Status: `open → in-progress → done`
- Supports **subtasks** (via `RELATED-TO` with `CHILD` relationship)
- Supports **recurring tasks** (iCal `RRULE`)
- Progress tracking (0–100%)
- Displayed in list and kanban views

---

## iCalendar Compatibility (Critical)

This is the foundation of jtx Board interoperability. Every rule here must be respected.

### Component Mapping

| App concept | iCal component | Distinguishing rule     |
|-------------|----------------|-------------------------|
| Journal     | `VJOURNAL`     | Has `DTSTART` field set |
| Note        | `VJOURNAL`     | `DTSTART` is absent     |
| ToDo        | `VTODO`        | Separate component type |

### Key iCal Fields Used

**VJOURNAL (Journals & Notes):**
- `UID` — globally unique ID, never changes, used for sync identity
- `SUMMARY` — the title
- `DESCRIPTION` — the body content (stored as Markdown)
- `DTSTART` — date of the journal entry (absent for notes)
- `CATEGORIES` — tags
- `RELATED-TO` — links to other entries
- `LAST-MODIFIED` — used for conflict detection during sync
- `X-APPLE-SORT-ORDER` or similar `X-` properties — app-specific metadata

**VTODO (Tasks):**
- `UID` — unique ID
- `SUMMARY` — task title
- `DESCRIPTION` — notes on the task (Markdown)
- `DTSTART` — when the task starts
- `DUE` — due date
- `STATUS` — `NEEDS-ACTION`, `IN-PROCESS`, `COMPLETED`, `CANCELLED`
- `PRIORITY` — 1 (highest) to 9 (lowest)
- `PERCENT-COMPLETE` — 0 to 100
- `RRULE` — recurrence rule (e.g. `FREQ=WEEKLY`)
- `RELATED-TO;RELTYPE=PARENT` — for subtasks, references the parent UID
- `CATEGORIES` — tags

### Rich Text Storage
The iCal `DESCRIPTION` field is plain text by the spec. Rich content is stored as **Markdown** inside `DESCRIPTION`. Both jtx Board and this app will render Markdown in the editor. This ensures content is readable as plain text on any CalDAV client, and renders properly in both apps.

---

## Data Architecture

### Local SQLite Schema

```sql
-- All three entry types share one table, distinguished by `type`
CREATE TABLE entries (
  id            TEXT PRIMARY KEY,   -- same as iCal UID
  type          TEXT NOT NULL,      -- 'journal' | 'note' | 'todo'
  title         TEXT,
  body          TEXT,               -- Markdown content
  start_date    TEXT,               -- ISO 8601, NULL for notes
  due_date      TEXT,               -- VTODO only
  status        TEXT,               -- VTODO only
  priority      INTEGER,            -- VTODO only
  progress      INTEGER,            -- VTODO only (0-100)
  rrule         TEXT,               -- recurrence rule string
  categories    TEXT,               -- JSON array of tag strings
  parent_uid    TEXT,               -- for subtasks
  collection    TEXT NOT NULL,      -- CalDAV collection URL this belongs to
  etag          TEXT,               -- last known ETag from server
  dirty         INTEGER DEFAULT 1,  -- 1 = has local changes not yet synced
  deleted       INTEGER DEFAULT 0,  -- 1 = marked for deletion on next sync
  created_at    TEXT,
  updated_at    TEXT,
  FOREIGN KEY (collection) REFERENCES collections(url)
);

-- Links between entries (RELATED-TO in iCal)
CREATE TABLE entry_links (
  from_uid      TEXT NOT NULL,
  to_uid        TEXT NOT NULL,
  rel_type      TEXT,               -- 'CHILD', 'PARENT', 'SIBLING'
  PRIMARY KEY (from_uid, to_uid)
);

-- CalDAV collections (Nextcloud calendars/journals)
CREATE TABLE collections (
  url           TEXT PRIMARY KEY,
  display_name  TEXT,
  type          TEXT,               -- 'journal' | 'todo' | 'mixed'
  ctag          TEXT,               -- collection-level change token
  color         TEXT
);

-- Indexes for sync performance
CREATE INDEX idx_entries_type    ON entries(type);
CREATE INDEX idx_entries_dirty   ON entries(dirty);
CREATE INDEX idx_entries_deleted ON entries(deleted);
```

**Database location on Windows:** `%APPDATA%\jtx-desktop\jtx.db`

---

## CalDAV Sync Engine

The sync engine is the most critical and complex part of the app. It must handle:

### Auth & Discovery
1. Accept a Nextcloud URL + username + password
2. Perform CalDAV discovery (`/.well-known/caldav`) to find the principal URL
3. List all collections (calendars/journals) available to the user
4. Let the user choose which collections to sync

### Sync Algorithm (ETag-based)
1. Fetch the collection's `CTag` (a collection-level hash)
2. If `CTag` unchanged → nothing to do
3. If `CTag` changed → fetch all entry ETags from server
4. Compare server ETags to locally stored ETags:
    - Server ETag differs from local → pull and update local
    - Entry exists locally but not on server → server deleted it; delete locally
    - Local entry is marked `dirty=1` → push to server; update stored ETag
    - Entry exists locally but never pushed → PUT to server as new
5. Handle deletions: if local `deleted=1`, send `DELETE` to server, then remove locally

### Conflict Resolution
- Default: **last-write-wins** based on `LAST-MODIFIED`
- Stretch goal: flag conflicts and show a diff UI for the user to resolve manually

### Sync Triggers
- On app startup (if online)
- On a configurable interval (e.g. every 5 minutes)
- On manual "Sync Now" action
- On app close (flush any dirty entries)

---

## UI / Views

### Main Layout
Three top-level sections, accessible via a sidebar or tab bar:
- **Journals** — chronological timeline of dated journal entries
- **Notes** — grid or list of floating notes
- **ToDos** — list view with status grouping + optional kanban board

### Per-Section Views
- **Journal**: Timeline (grouped by date), detail pane with rich text editor
- **Notes**: Card grid or flat list, quick-capture input at top
- **ToDos**: List grouped by status; kanban columns (Open / In Progress / Done); subtask tree inside each task

### Cross-cutting UI
- **Search bar** — full-text search across all entry types and collections
- **Tag/category filter** — filter any view by tag
- **Entry detail panel** — opens to the right (or full-screen); shows editor + linked entries
- **Link panel** — shows and manages `RELATED-TO` links between entries
- **Sync status bar** — shows last sync time, online/offline indicator, sync progress
- **Settings screen** — Nextcloud credentials, collection selection, sync interval, theme

---

## Authentication & Credentials

- User provides: **Nextcloud URL**, **username**, **password** (or app password)
- Credentials stored securely using Electron's `safeStorage` API (OS keychain)
- No accounts, no cloud dependency beyond the user's own Nextcloud instance
- App works fully without credentials (local-only mode)

---

## Offline Behaviour

- All reads always come from local SQLite — the app never blocks on network
- Writes go to SQLite first, entry is marked `dirty=1`
- When network becomes available, dirty entries are synced automatically
- A status indicator shows: `Online — last synced 2 min ago` or `Offline — 3 unsynced changes`

---

## What This App Does NOT Do

- It does not replace jtx Board — it is a desktop companion to it
- It does not implement its own sync server — Nextcloud is required for sync
- It does not support CalDAV servers other than Nextcloud in v1 (though the protocol is standard and others may work)
- It does not support the `VEVENT` (calendar event) iCal component — only `VJOURNAL` and `VTODO`

---

## Project Structure

```
jtx-desktop/
├── electron/               # Electron main process
│   ├── main.ts             # App entry point, window creation, db init
│   ├── db.ts               # ✅ SQLite setup, schema migrations
│   ├── ipc.ts              # ✅ IPC handlers (bridge to renderer)
│   ├── preload.ts          # ✅ Exposes window.api to renderer via contextBridge
│   └── sync/               # CalDAV sync engine
│       ├── caldav.ts       # ✅ tsdav wrapper, auth, discovery
│       ├── ical.ts         # ✅ ical.js wrappers, VJOURNAL/VTODO serialization
│       └── engine.ts       # ✅ ETag diffing, conflict resolution, sync loop
├── src/                    # React renderer process
│   ├── components/
│   │   ├── editor/         # ✅ Entry detail panel with full body display
│   │   ├── journals/       # ✅ Journal timeline view
│   │   ├── notes/          # ✅ Notes grid/list view
│   │   ├── todos/          # ✅ ToDo list and kanban view
│   │   └── shared/         # ✅ Sidebar, sync bar, settings
│   ├── store/              # ✅ State management (Zustand)
│   └── db/                 # ✅ SQLite access layer (via IPC to main process)
├── shared/                 # Types and constants shared between main and renderer
│   └── types.ts            # ✅ Entry, Collection, SyncStatus types
├── vite.config.ts          # ✅ Vite config (better-sqlite3 externalised)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Setup

**Prerequisites:**
- Node.js v22+ LTS
- npm v11+
- Git
- Windows 11 (primary dev environment)

**First-time setup:**
```bash
git clone <repo>
cd jtx-desktop
npm install
npm approve-scripts electron esbuild better-sqlite3
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3
npm run dev
```

**Subsequent runs:**
```bash
npm run dev
```

**Build for distribution:**
```bash
npm run build     # compiles TypeScript
npm run package   # packages with electron-builder into an installer
```

---

## Build Progress

### ✅ Phase 1 — Project scaffold (complete)
- Electron + React + TypeScript project created with `electron-vite`
- All core dependencies installed and approved:
  `better-sqlite3`, `tsdav`, `ical.js`, `@tiptap/react`, `@tiptap/starter-kit`, `zustand`
- `better-sqlite3` recompiled for Electron's internal Node version using `@electron/rebuild`
- `vite.config.ts` updated to externalise `better-sqlite3` from the bundle

### ✅ Phase 2 — Database layer (complete)
- `electron/db.ts` created: opens SQLite at `%APPDATA%\jtx-desktop\jtx.db`
- Full schema created on first run via `runMigrations()`:
    - `collections` table — stores CalDAV collections from Nextcloud
    - `entries` table — stores all journals, notes, and todos in one unified table
    - `entry_links` table — stores `RELATED-TO` links between entries
    - Indexes on `type`, `dirty`, and `deleted` for sync performance
- `electron/main.ts` updated: database opens on app ready, closes cleanly on quit
- Database file confirmed present at `%APPDATA%\jtx-desktop\jtx.db` on Windows

### ✅ Phase 3 — IPC bridge (complete)
- `electron/ipc.ts` — all CRUD handlers registered via `registerIpcHandlers()`:
    - `collections:getAll` — fetch all collections
    - `collections:upsert` — insert or update a collection
    - `entries:getAll` — fetch all entries, optionally filtered by `type` or `collection`
    - `entries:getById` — fetch a single entry by id
    - `entries:create` — insert a new entry; auto-generates UUID, sets `dirty=1`, timestamps
    - `entries:update` — update allowed fields on an existing entry, marks `dirty=1`
    - `entries:delete` — soft delete: sets `deleted=1`, `dirty=1` (sync engine handles server deletion)
- `electron/preload.ts` — replaced scaffold with typed `window.api` exposed via `contextBridge`:
    - `window.api.entries.getAll/getById/create/update/delete`
    - `window.api.collections.getAll/upsert`
- `electron/main.ts` — `registerIpcHandlers()` called on app ready
- Verified end-to-end in Electron DevTools console: create and read confirmed working

### ✅ Phase 4 — Shared types (complete)
- `shared/types.ts` — TypeScript interfaces covering the entire data model:
    - `Entry` — full interface for all three entry types (journal, note, todo)
    - `EntryType`, `TodoStatus`, `LinkRelType` — string union types for constrained fields
    - `CreateEntryInput` / `UpdateEntryInput` — scoped types for create and update operations
    - `Collection` — CalDAV collection shape
    - `EntryLink` — RELATED-TO link between two entries
    - `SyncStatus` / `SyncState` — used by the sync engine and the UI status bar


### ✅ Phase 5 — CalDAV sync engine (complete)
- `electron/sync/caldav.ts` — tsdav wrapper; `makeClient()` uses explicit `/remote.php/dav` path (Nextcloud auto-discovery does not work); `discoverCollections()`, `fetchEtags()`, `fetchObjects()`, `pushObject()`, `deleteObject()`, `testConnection()`
- `electron/sync/ical.ts` — `parseIcs()` converts raw .ics to local Entry; `serializeEntry()` converts Entry back to .ics; handles VJOURNAL (journal/note) and VTODO including categories, RRULE, subtask parent UID
- `electron/sync/engine.ts` — full sync loop: discovers collections, pushes local deletions, pushes dirty entries, fetches remote ETags, detects server deletions, pulls changed/new entries; `fetchEtags()` uses explicit VJOURNAL comp-filter (tsdav defaults to VEVENT only)
- IPC handlers: `sync:now`, `sync:getStatus`, `sync:setCredentials`, `sync:testConnection`
- Verified: 85 entries pulled from Nextcloud (56 todos, 23 journals, 6 notes)

### ✅ Phase 6 — React UI (complete)
- `src/index.css` — global reset, CSS variables (dark editorial theme: charcoal backgrounds, warm off-white text, amber/gold accents), Playfair Display + IBM Plex Sans fonts
- `src/store/app.ts` — Zustand store: active section, entries list, selected entry, sync state
- `src/App.tsx` — app shell: sidebar + main content panel + detail panel + sync bar; `window.api` typed globally; entries loaded on mount
- `src/components/Sidebar.tsx` — navigation (Journals / Notes / Tasks / Settings) with active state indicator and accent border
- `src/components/JournalsView.tsx` — chronological timeline grouped by month; date badge, title, body preview, tags per entry
- `src/components/NotesView.tsx` — responsive card grid; title, body preview, tags, date per card; hover lift animation
- `src/components/TodosView.tsx` — list grouped by status (Open / In Progress / Completed / Cancelled); priority dot, due date, progress bar, subtask count per row
- `src/components/EntryDetail.tsx` — right-side detail panel; metadata grid, tags, progress bar, full body, subtask list with completion state, recurrence rule display
- `src/components/SyncBar.tsx` — bottom status bar; sync indicator dot, last synced time, pending changes count, Sync Now button; polls status every 30s
- `src/components/SettingsView.tsx` — Nextcloud credentials form (URL, username, password); Test Connection and Save & Sync buttons with status feedback

### ✅ Credential Persistence (complete)
- `electron/ipc.ts` — two new handlers:
    - `credentials:save` — encrypts credentials using Electron `safeStorage` (OS keychain on Windows) and writes to `%APPDATA%\jtx-desktop\credentials.enc`
    - `credentials:load` — decrypts and returns saved credentials; returns null if none saved
- `electron/main.ts` — on app ready, loads saved credentials automatically, calls `setCredentials()` and `startSyncInterval()`, then triggers a sync after window finishes loading
- `electron/preload.ts` — exposes `window.api.credentials.save/load` to renderer
- `src/components/SettingsView.tsx` — pre-fills form with saved credentials on mount via `useEffect`; calls `credentials:save` before syncing; `isSyncing` state wired to sync bar so it pulses during Save & Sync
- Verified: credentials survive app restarts; auto-sync triggers on startup; sync bar reflects sync state from both Settings and the Sync Now button

### ✅ Phase 7 — UI/UX improvements (complete)

**High priority**
- `src/components/Sidebar.tsx` + `src/components/SearchBar.tsx` — global full-text search across all entry types; Ctrl+F triggers sidebar search input
- `electron/main.ts` + `src/components/KeyboardShortcuts.tsx` — Ctrl+N (new entry), Ctrl+1/2/3 (section switch), Escape (close panel); native Electron menu bar with File / Edit / View / Help menus
- `src/components/editor/EntryEditor.tsx` — Tiptap bubble menu for Bold, Italic, H2, H3, Bullet and Ordered lists; word count and reading time displayed below editor; "Start writing…" placeholder via Tiptap Placeholder extension
- `src/components/TodosView.tsx` — inline task complete checkbox in list row; no detail panel required

**Medium priority**
- `src/components/SettingsView.tsx` + `src/index.css` — Dark / Light / System theme toggle (`data-theme` attribute + full CSS variable set); font size sm/md/lg/xl (CSS scale on `#root`); six accent color swatches + custom color picker (full RGB→HSL palette derivation); Appearance and Nextcloud Sync sections
- `src/index.css` — removed Google Fonts `<link>`; falls back to Georgia / Segoe UI offline
- `src/components/Sidebar.tsx` — hamburger toggle; collapses to icon-only rail with smooth animation
- Sort controls — Journals: newest/oldest; Notes: last-updated / created / A→Z; Tasks: priority / due / A→Z / last-updated with asc/desc toggle; all persisted to localStorage
- `src/components/NotesView.tsx` — grid and list-row layout toggle; persisted to localStorage
- `src/components/TodosView.tsx` — multi-select status filter, priority chips (group + individual), due/start date range, tag filter; active count badge; configurable sync interval (5/10/15/30/60 min) in Settings

**Low priority**
- `src/index.css` — `:focus-visible` outline; `aria-current` + `aria-label` on all sidebar nav items
- `src/components/editor/EntryEditor.tsx` — 3-tier title fallback: title → first body line (italic) → "Untitled" (muted italic)
- `src/App.tsx` — detail panel drag-resizable (300–700 px); width persisted to localStorage
- `src/components/Sidebar.tsx` — Nextcloud collections listed with color dot and display name; cached in localStorage for instant startup display
- `src/components/SettingsView.tsx` — About section: app name, version (from package.json), author
- `electron/main.ts` + `src/components/TitleBar.tsx` — frameless window (`frame: false`); 32 px TitleBar with drag region, "JTX Desktop" label, Win11-style min/max/close buttons; maximize state synced via IPC events
- All emoji/Unicode icons replaced with `lucide-react` throughout sidebar and detail panel

---

## Key Dependencies

```json
{
  "electron": "^30.5.1",
  "react": "^18",
  "react-dom": "^18",
  "typescript": "^5",
  "better-sqlite3": "^12.10.0",
  "tsdav": "^2",
  "ical.js": "^2",
  "@tiptap/react": "^2",
  "@tiptap/starter-kit": "^2",
  "zustand": "latest",
  "vite": "^5",
  "vite-plugin-electron": "latest"
}
```

**Dev dependencies:**
```json
{
  "@types/better-sqlite3": "latest",
  "@electron/rebuild": "latest"
}
```

### Important: Native module setup
`better-sqlite3` is a native Node module and must be recompiled for Electron's internal Node version after install or any Electron version change:

```bash
npm approve-scripts better-sqlite3
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3
```

Without this step the app will throw a `NODE_MODULE_VERSION` mismatch error on startup.

### Important: Vite external config
`better-sqlite3` must be declared as external in `vite.config.ts` so Vite does not attempt to bundle it:

```typescript
main: {
  entry: 'electron/main.ts',
  vite: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3'],
      },
    },
  },
},
```

---

## Interoperability Checklist

Before any release, verify the following manually using jtx Board on Android + Nextcloud:

- [x] Entry created in desktop app appears in jtx Board after sync
- [x] Entry created in jtx Board appears in desktop app after sync
- [x] Editing an entry in desktop app reflects in jtx Board after sync
- [x] Editing an entry in jtx Board reflects in desktop app after sync
- [x] Deleting in desktop app removes from jtx Board after sync
- [x] Deleting in jtx Board removes from desktop app after sync
- [x] Subtasks created in desktop app show as subtasks in jtx Board
- [x] Tags/categories sync correctly in both directions
- [ ] General `RELATED-TO` links (non-parent) sync correctly in both directions (`entry_links` table exists but has no IPC handlers; links cannot be created or viewed from the desktop app yet)
- [ ] Recurring tasks behave consistently in both apps (`RRULE` is stored and synced correctly; end-to-end behaviour with jtx Board not yet manually verified)

---

*This README is the canonical reference for any developer or LLM assistant helping to build this project. All architectural decisions, data models, compatibility requirements, and build progress are documented here. Always update the Build Progress section when a phase is completed.*