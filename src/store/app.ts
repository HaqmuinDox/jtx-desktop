import { create } from 'zustand'
import type { Entry } from '../../shared/types'

export type Section      = 'journals' | 'notes' | 'todos' | 'settings'
export type CreatingType = 'journal'  | 'note'  | 'todo'

export interface DeviceLocation {
    lat:  string
    lon:  string
    name: string | null  // reverse-geocoded address, null if lookup failed
}

interface AppState {
    activeSection:    Section
    setActiveSection: (s: Section) => void

    entries:    Entry[]
    setEntries: (entries: Entry[]) => void
    addEntry:   (entry: Entry) => void

    selectedEntry:    Entry | null
    setSelectedEntry: (e: Entry | null) => void

    creatingType:    CreatingType | null
    setCreatingType: (t: CreatingType | null) => void

    creatingParentUid:        string | null
    setCreatingParentUid:     (uid: string | null) => void
    creatingParentCollection: string | null
    setCreatingParentCollection: (url: string | null) => void

    isSyncing:    boolean
    setIsSyncing: (v: boolean) => void
    lastSynced:   string | null
    setLastSynced:(v: string | null) => void

    deviceLocation:    DeviceLocation | null
    setDeviceLocation: (loc: DeviceLocation | null) => void

    theme:    'dark' | 'light' | 'system'
    setTheme: (t: 'dark' | 'light' | 'system') => void
    fontSize: 'sm' | 'md' | 'lg' | 'xl'
    setFontSize: (s: 'sm' | 'md' | 'lg' | 'xl') => void
    accentColor:    string
    setAccentColor: (c: string) => void

    searchQuery:    string
    setSearchQuery: (q: string) => void

    filterCollection:    string | null
    setFilterCollection: (url: string | null) => void

    sidebarCollapsed:    boolean
    setSidebarCollapsed: (v: boolean) => void
}

// Read persisted theme/fontSize/accent before create() call
const savedTheme = (localStorage.getItem('jtx_theme') as 'dark' | 'light' | 'system' | null) ?? 'dark'
const savedFontSize = (localStorage.getItem('jtx_fontsize') as 'sm' | 'md' | 'lg' | 'xl' | null) ?? 'md'
const savedAccent = localStorage.getItem('jtx_accent') ?? '#c4a35a'

function resolveTheme(t: 'dark' | 'light' | 'system'): 'dark' | 'light' {
    return t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t
}

function rgbToHue(r: number, g: number, b: number): number {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    if (d === 0) return 0
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0)
            : max === g ? (b - r) / d + 2
            :             (r - g) / d + 4
    return h * 60
}

function hsl(h: number, s: number, l: number): string {
    return `hsl(${Math.round(h)}, ${s}%, ${l}%)`
}

function applyTheme(t: 'dark' | 'light' | 'system') {
    document.documentElement.setAttribute('data-theme', resolveTheme(t))
}

function applyFontSize(s: 'sm' | 'md' | 'lg' | 'xl') {
    const scales: Record<string, number> = { sm: 0.875, md: 1, lg: 1.125, xl: 1.25 }
    const z = scales[s]
    const root = document.getElementById('root')
    if (!root) return
    if (z === 1) {
        root.style.transform       = ''
        root.style.transformOrigin = ''
        root.style.width           = ''
        root.style.height          = ''
    } else {
        // Scale the root element, then shrink its own box so it still fills
        // the viewport exactly — prevents content from going off-screen.
        root.style.transformOrigin = 'top left'
        root.style.transform       = `scale(${z})`
        root.style.width           = `${100 / z}vw`
        root.style.height          = `${100 / z}vh`
    }
}

function applyAccent(hex: string, theme: 'dark' | 'light' | 'system') {
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (!m) return
    const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    const h = rgbToHue(r, g, b)
    const dark = resolveTheme(theme) === 'dark'
    const set = (k: string, v: string) => document.documentElement.style.setProperty(k, v)

    set('--accent',      hex)
    set('--accent-dim',  `rgb(${Math.round(r * 0.66)}, ${Math.round(g * 0.66)}, ${Math.round(b * 0.66)})`)
    set('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.12)`)

    // Text palette — tinted with accent hue
    set('--text-primary',   hsl(h, dark ? 15 : 18, dark ? 88 : 10))
    set('--text-secondary', hsl(h, dark ? 10 : 12, dark ? 60 : 27))
    set('--text-muted',     hsl(h, dark ?  8 : 10, dark ? 52 : 43))

    // Backgrounds — light theme gets accent-hued cream; dark stays near-neutral
    set('--bg-base',    dark ? hsl(h, 4, 10) : hsl(h, 28, 95))
    set('--bg-surface', dark ? hsl(h, 4, 13) : hsl(h, 18, 97))
    set('--bg-raised',  dark ? hsl(h, 4, 16) : '#ffffff')
    set('--bg-hover',   dark ? hsl(h, 4, 19) : hsl(h, 20, 92))
    set('--bg-active',  dark ? hsl(h, 5, 20) : hsl(h, 15, 89))

    // Borders
    set('--border',        dark ? hsl(h, 4, 18) : hsl(h, 12, 83))
    set('--border-strong', dark ? hsl(h, 4, 23) : hsl(h,  8, 76))
}

applyTheme(savedTheme)
applyFontSize(savedFontSize)
applyAccent(savedAccent, savedTheme)

export const useAppStore = create<AppState>((set, get) => ({
    activeSection:    'journals',
    setActiveSection: (activeSection) => set({ activeSection, selectedEntry: null, creatingType: null, creatingParentUid: null, creatingParentCollection: null, filterCollection: null }),

    entries:    [],
    setEntries: (entries) => set({ entries }),
    addEntry:   (entry)   => set(state => ({ entries: [entry, ...state.entries] })),

    selectedEntry:    null,
    setSelectedEntry: (selectedEntry) => set({ selectedEntry, creatingType: null }),

    creatingType:    null,
    setCreatingType: (creatingType) => set({ creatingType, selectedEntry: null }),

    creatingParentUid:    null,
    setCreatingParentUid: (creatingParentUid) => set({ creatingParentUid }),

    creatingParentCollection:    null,
    setCreatingParentCollection: (creatingParentCollection) => set({ creatingParentCollection }),

    isSyncing:    false,
    setIsSyncing: (isSyncing) => set({ isSyncing }),
    lastSynced:   null,
    setLastSynced:(lastSynced) => set({ lastSynced }),

    deviceLocation:    null,
    setDeviceLocation: (deviceLocation) => set({ deviceLocation }),

    theme: savedTheme,
    setTheme: (theme) => {
        localStorage.setItem('jtx_theme', theme)
        applyTheme(theme)
        applyAccent(get().accentColor, theme)
        set({ theme })
    },
    fontSize: savedFontSize,
    setFontSize: (fontSize) => {
        localStorage.setItem('jtx_fontsize', fontSize)
        applyFontSize(fontSize)
        set({ fontSize })
    },
    accentColor: savedAccent,
    setAccentColor: (accentColor) => {
        localStorage.setItem('jtx_accent', accentColor)
        applyAccent(accentColor, get().theme)
        set({ accentColor })
    },

    searchQuery:    '',
    setSearchQuery: (searchQuery) => set({ searchQuery }),

    filterCollection:    null,
    setFilterCollection: (filterCollection) => set({ filterCollection }),

    sidebarCollapsed: localStorage.getItem('jtx_sidebar') === 'true',
    setSidebarCollapsed: (sidebarCollapsed) => {
        localStorage.setItem('jtx_sidebar', String(sidebarCollapsed))
        set({ sidebarCollapsed })
    },
}))
