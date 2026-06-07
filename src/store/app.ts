import { create } from 'zustand'
import type { Entry } from '../../shared/types'

export type Section      = 'journals' | 'notes' | 'todos' | 'settings'
export type CreatingType = 'journal'  | 'note'  | 'todo'

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

    isSyncing:    boolean
    setIsSyncing: (v: boolean) => void
    lastSynced:   string | null
    setLastSynced:(v: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
    activeSection:    'journals',
    setActiveSection: (activeSection) => set({ activeSection, selectedEntry: null, creatingType: null }),

    entries:    [],
    setEntries: (entries) => set({ entries }),
    addEntry:   (entry)   => set(state => ({ entries: [entry, ...state.entries] })),

    selectedEntry:    null,
    setSelectedEntry: (selectedEntry) => set({ selectedEntry, creatingType: null }),

    creatingType:    null,
    setCreatingType: (creatingType) => set({ creatingType, selectedEntry: null }),

    isSyncing:    false,
    setIsSyncing: (isSyncing) => set({ isSyncing }),
    lastSynced:   null,
    setLastSynced:(lastSynced) => set({ lastSynced }),
}))
