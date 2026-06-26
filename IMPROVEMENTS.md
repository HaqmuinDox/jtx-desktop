# UI/UX Improvement Roadmap

Identified gaps vs. professional productivity apps (Bear, Obsidian, Things 3, Linear, Notion).
Items are grouped by priority. Agents assigned in parentheses where applicable.

---

## High Priority

- [ ] **Search** — Global search across all entries (Ctrl+F / sidebar input) *(Agent 6)*
- [ ] **Keyboard shortcuts** — Ctrl+N, Ctrl+1/2/3, Escape to close panel *(Agent 3)*
- [ ] **Formatting toolbar** — Tiptap bubble menu for Bold, Italic, H2, Bullet/Ordered lists *(Agent 1)*
- [ ] **Native Electron menu bar** — File / Edit / View / Help menus with keyboard shortcuts *(Agent 3)*
- [ ] **Inline task complete** — Check off tasks directly from the list without opening detail panel *(Agent 2)*

## Medium Priority

- [ ] **Light/dark/system theme** — Currently dark-only; needs Appearance settings *(Agent 5)*
- [ ] **Font size setting** — No way to scale text up or down *(Agent 5)*
- [ ] **Accent color setting** — Gold (#c4a35a) is hardcoded *(Agent 5)*
- [ ] **Remove Google Fonts dependency** — Fails offline; use system font fallbacks *(Agent 5)*
- [ ] **Collapsible sidebar** — No way to hide sidebar for more writing space *(Agent 6)*
- [ ] **Sort controls** — Notes, journals, and tasks have hardcoded sort order *(Agents 2, 4)*
- [ ] **Notes list/grid toggle** — Grid is the only layout option *(Agent 4)*
- [ ] **Settings restructure** — Flat scrolling page; needs Appearance / Sync / Account sections *(Agent 5)*
- [ ] **Sync interval setting** — 5-minute interval is invisible and hardcoded
- [ ] **Filter controls for tasks** — No way to filter by tag, priority, or hide completed *(Agent 2)*

## Low Priority

- [ ] **ARIA labels and focus indicators** — Accessibility: aria-label, aria-current, focus-visible *(Agent 7)*
- [ ] **Contrast at small sizes** — text-muted (#605850) on bg-surface (#222222) fails WCAG AA *(Agent 7)*
- [ ] **Word count / reading time** — Common in Bear, Craft, iA Writer *(Agent 1)*
- [ ] **Placeholder text in editor** — Empty body shows nothing; needs "Start writing…" *(Agent 1)*
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
