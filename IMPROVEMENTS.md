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

- [ ] **Light/dark/system theme** — Currently dark-only; needs Appearance settings *(Agent 5)*
- [ ] **Font size setting** — No way to scale text up or down *(Agent 5)*
- [ ] **Accent color setting** — Gold (#c4a35a) is hardcoded *(Agent 5)*
- [ ] **Remove Google Fonts dependency** — Fails offline; use system font fallbacks *(Agent 5)*
- [x] **Collapsible sidebar** — Hamburger toggle; sidebar collapses to icon-only rail *(Agent 6)*
- [x] **Sort controls** — Tasks: priority / due date / A→Z / last-updated sort with asc/desc toggle; notes and journals still static *(Agents 2, 4)*
- [ ] **Notes list/grid toggle** — Grid is the only layout option *(Agent 4)*
- [ ] **Settings restructure** — Flat scrolling page; needs Appearance / Sync / Account sections *(Agent 5)*
- [x] **Sync interval setting** — Configurable interval in Settings (default 5 min)
- [x] **Filter controls for tasks** — Multi-select status, priority (group + individual chips), due/start date range, tag filter *(Agent 2)*

## Low Priority

- [ ] **ARIA labels and focus indicators** — Accessibility: aria-label, aria-current, focus-visible *(Agent 7)*
- [ ] **Contrast at small sizes** — text-muted (#605850) on bg-surface (#222222) fails WCAG AA *(Agent 7)*
- [x] **Word count / reading time** — Shown below editor; reading time appears at 200+ words *(Agent 1)*
- [x] **Placeholder text in editor** — "Start writing…" via Tiptap Placeholder extension *(Agent 1)*
- [ ] **Journal "Untitled" fallback** — Show first line of body instead of generic placeholder *(Agent 4)*
- [ ] **Resizable panels** — Sidebar (220px) and detail panel (420px) are fixed-width
- [ ] **Collections in sidebar** — Nextcloud collections not visible in navigation
- [ ] **About / version info** — No way to see installed version
- [ ] **Autosave + inline editing** — Hard Edit/Save/Cancel cycle; professional apps autosave
- [ ] **Custom window titlebar** — Electron default titlebar breaks visual unity on Windows

---

## Not in scope (this iteration)

- Autosave / inline editing (requires rearchitecting EntryDetail)
- Resizable panel drag handles (complex drag-to-resize logic)
- Collections tree in sidebar (needs IPC handlers for `entry_links` table first)
- Custom frameless titlebar (Windows-specific drag-region complexity)
