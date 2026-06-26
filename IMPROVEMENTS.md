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

## Low Priority

- [x] **ARIA labels and focus indicators** — `:focus-visible` outline in CSS; `aria-current` + `aria-label` on all sidebar nav items *(Agent 7)*
- [ ] **Contrast at small sizes** — `--text-muted` at 10px still borderline against both bg-surface values; not yet addressed *(Agent 7)*
- [x] **Word count / reading time** — Shown below editor; reading time appears at 200+ words *(Agent 1)*
- [x] **Placeholder text in editor** — "Start writing…" via Tiptap Placeholder extension *(Agent 1)*
- [x] **Journal "Untitled" fallback** — 3-tier fallback in both journals and notes: title → first body line (italic) → "Untitled" (muted italic) *(Agent 4)*
- [ ] **Resizable panels** — Sidebar (220px) and detail panel (420px) are fixed-width
- [ ] **Collections in sidebar** — Nextcloud collections not visible in navigation
- [x] **About / version info** — About section at the bottom of Settings; shows app name, version (from package.json), and author
- [ ] **Autosave + inline editing** — Hard Edit/Save/Cancel cycle; professional apps autosave
- [ ] **Custom window titlebar** — Electron default titlebar breaks visual unity on Windows

---

## Not in scope (this iteration)

- Autosave / inline editing (requires rearchitecting EntryDetail)
- Resizable panel drag handles (complex drag-to-resize logic)
- Collections tree in sidebar (needs IPC handlers for `entry_links` table first)
- Custom frameless titlebar (Windows-specific drag-region complexity)
