# UI/UX Improvement Roadmap

Identified gaps vs. professional productivity apps (Bear, Obsidian, Things 3, Linear, Notion).
Items are grouped by priority. Agents assigned in parentheses where applicable.

---

## High Priority

- [x] **Search** — Global search across all entries (Ctrl+F / sidebar input) *(Agent 6)*
- [x] **Keyboard shortcuts** — Ctrl+N, Ctrl+1/2/3, Escape to close panel *(Agent 3)*
- [x] **Formatting toolbar** — Tiptap bubble menu for Bold, Italic, H2, H3, Bullet/Ordered lists *(Agent 1)*
- [x] **Native Electron menu bar** — File / Edit / View / Help menus with keyboard shortcuts *(Agent 3)*
- [x] **Inline task complete** — Check off tasks directly from the list without opening detail panel *(Agent 2)*
- [x] **Wire up missing keyboard shortcuts** — Ctrl+Shift+J/N/T, Ctrl+F (focus search), Ctrl+Shift+S (sync now) wired in App.tsx
- [x] **Replace `window.confirm` delete dialog** — Inline styled confirmation banner in EntryDetail replaces the native OS dialog
- [x] **Collections sidebar: click-to-filter** — Collections are multi-select toggles; toggling a collection includes/excludes its entries; zero selected = show all; selected state shown via filled circle dot (hollow when inactive)
- [x] **List rows: keyboard accessibility** — JournalRow, NoteCard, NoteListRow, TodoRow, SubtaskRow all have `role="button"`, `tabIndex={0}`, and `onKeyDown` Enter/Space handlers
- [x] **FormField: associate labels with inputs** — `FormField` now accepts `htmlFor` and renders a `<label>`; all EditForm fields have matching `id` attributes

## Medium Priority

- [x] **Light/dark/system theme** — Dark/Light/System toggle in Settings; `data-theme` attribute + full CSS variable set for light mode; system mode follows `prefers-color-scheme` *(Agent 5)*
- [x] **Font size setting** — sm/md/lg/xl buttons in Settings; implemented via CSS scale transform on `#root` *(Agent 5)*
- [x] **Accent color setting** — Six swatches + custom color picker in Settings; full RGB→HSL palette derivation tints backgrounds, borders, and text *(Agent 5)*
- [x] **Remove Google Fonts dependency** — No `<link>` in `index.html`; fonts fall back to Georgia / Segoe UI offline *(Agent 5)*
- [x] **Collapsible sidebar** — Hamburger toggle; sidebar collapses to icon-only rail *(Agent 6)*
- [x] **Sort controls** — Journals: newest/oldest. Notes: last-updated/created/A→Z. Tasks: priority/due/A→Z/last-updated with asc/desc toggle. All persisted to localStorage. *(Agents 2, 4)*
- [x] **Notes list/grid toggle** — Grid and list-row layouts with toggle buttons; persisted to localStorage *(Agent 4)*
- [x] **Settings restructure** — Appearance section (theme/accent/font) and Nextcloud Sync section with distinct headings *(Agent 5)*
- [x] **Sync interval setting** — 5/10/15/30/60 min buttons in Settings; persisted and applied live
- [x] **Filter controls for tasks** — Multi-select status, priority (group + individual chips), due/start date range, tag filter; active count badge *(Agent 2)*
- [x] **Raw iCal fields: human-friendly UI** — RRULE replaced with Google Calendar-style editor (interval + freq, weekday toggles for weekly, monthly-on dropdown, Never/On/After end section); exdate replaced with date pickers; view mode shows human-readable recurrence text
- [x] **Search scope indicator** — "Searching in Journals/Notes/Tasks" label appears below the search box whenever a query is active
- [x] **List row click: don't toggle** — Clicking an already-selected row now keeps the detail panel open (removed toggle-deselect behavior from all three views)
- [x] **Priority indicator for all levels in task list** — Priority dot now shown for all 9 levels; size and opacity encode level (6px/full for high, 5px/70% for medium, 4px/45% for low)
- [x] **Fix comment placeholder** — Updated to "Short note or annotation" (removed the inaccurate "visible in list views" claim)
- [x] **Date picker `colorScheme`** — Removed hardcoded `colorScheme: 'dark'` from TodosView date filter; native picker now inherits theme
- [x] **Status badge human-readable labels** — StatusBadge now maps to "Completed", "In Progress", "Needs Action", "Cancelled", "Draft", "Final"

## Low Priority

- [x] **ARIA labels and focus indicators** — `:focus-visible` outline in CSS; `aria-current` + `aria-label` on all sidebar nav items *(Agent 7)*
- [x] **Contrast at small sizes** — Accepted as-is; contrast at small label sizes is not a concern for this app *(Agent 7)*
- [x] **Word count / reading time** — Shown below editor; reading time appears at 200+ words *(Agent 1)*
- [x] **Placeholder text in editor** — "Start writing…" via Tiptap Placeholder extension *(Agent 1)*
- [x] **Journal "Untitled" fallback** — 3-tier fallback in both journals and notes: title → first body line (italic) → "Untitled" (muted italic) *(Agent 4)*
- [x] **Resizable panels** — Detail panel is drag-resizable (300–700px); width persisted to localStorage. Sidebar width is intentionally fixed.
- [x] **Collections in sidebar** — Nextcloud collections listed in sidebar with color dot and display name; cached in localStorage for instant startup display
- [x] **About / version info** — About section at the bottom of Settings; shows app name, version (from package.json), and author
- [ ] **Autosave + inline editing** — Hard Edit/Save/Cancel cycle; professional apps autosave *(moved to Not in scope — requires rearchitecting EntryDetail)*
- [x] **Custom window titlebar** — Frameless window (`frame: false`); custom 32px TitleBar component with drag region, "JTX Desktop" label, and Win11-style min/max/close buttons; maximize state synced via IPC events
- [x] **Detail panel open/close animation** — Panel slides in from the right on open and slides out on close (220ms cubic-bezier), consistent with sidebar transitions
- [x] **Subtask toggle: non-leaf feedback** — Toggle circle on non-leaf subtasks now shows `cursor: default`, 50% opacity, and a tooltip explaining completion is derived from children
- [x] **Body preview: improve markdown strip** — Regex now strips heading markers, brackets, list prefixes, and collapses newlines; preview text is clean prose
- [x] **Hide hex color value in view mode** — Entry color in view mode now shows "Color" label next to the swatch instead of the raw hex string
- [x] **Filter panel animation** — TodosView filter panel expands/collapses with a smooth max-height + opacity transition (240ms)
- [x] **Progress bar ARIA** — Both progress bars now have `role="progressbar"`, `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label`
- [x] **Shared NewButton / Empty components** — Extracted to `src/components/shared.tsx`; all three views import from there; drift eliminated
- [x] **Save/Create loading state** — `minWidth` added to Save/Create `HeaderButton` so width stays stable when label changes to "…"
- [x] **Empty state: add clear action** — "Clear search" and "Clear filters" buttons now appear in all three views when search/filter yields no results
- [x] **Move default location out of sync section** — Default location picker is embedded inside the Nextcloud sync form; it is a general app preference and should be its own section

---

## Not in scope (this iteration)

- [x] Resizable panel drag handles (complex drag-to-resize logic)
- [x] Collections tree in sidebar (needs IPC handlers for `entry_links` table first)
- [x] Custom frameless titlebar (Windows-specific drag-region complexity)
