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
}

// Read persisted theme/fontSize before create() call
const savedTheme = (localStorage.getItem('jtx_theme') as 'dark' | 'light' | 'system' | null) ?? 'dark'
const savedFontSize = (localStorage.getItem('jtx_fontsize') as 'sm' | 'md' | 'lg' | 'xl' | null) ?? 'md'

// Apply on startup
function applyTheme(t: 'dark' | 'light' | 'system') {
    const resolved = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t
    document.documentElement.setAttribute('data-theme', resolved)
}
function applyFontSize(s: 'sm' | 'md' | 'lg' | 'xl') {
    // zoom scales the entire rendered UI uniformly — the only reliable approach
    // when all component font sizes are hardcoded in px (not rem/em).
    const zooms = { sm: '0.875', md: '1', lg: '1.125', xl: '1.25' }
    document.documentElement.style.zoom = zooms[s]
}
applyTheme(savedTheme)
applyFontSize(savedFontSize)

export const useAppStore = create<AppState>((set) => ({
    activeSection:    'journals',
    setActiveSection: (activeSection) => set({ activeSection, selectedEntry: null, creatingType: null, creatingParentUid: null, creatingParentCollection: null }),

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
        set({ theme })
    },
    fontSize: savedFontSize,
    setFontSize: (fontSize) => {
        localStorage.setItem('jtx_fontsize', fontSize)
        applyFontSize(fontSize)
        set({ fontSize })
    },
}))
