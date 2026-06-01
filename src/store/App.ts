import { create } from 'zustand'
import type { Entry } from '../../shared/types'

export type Section = 'journals' | 'notes' | 'todos' | 'settings'

interface AppState {
    // Navigation
    activeSection:    Section
    setActiveSection: (s: Section) => void

    // Entry list
    entries:     Entry[]
    setEntries:  (entries: Entry[]) => void

    // Selected entry (detail panel)
    selectedEntry:    Entry | null
    setSelectedEntry: (e: Entry | null) => void

    // Sync
    isSyncing:    boolean
    setIsSyncing: (v: boolean) => void
    lastSynced:   string | null
    setLastSynced:(v: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
    activeSection:    'journals',
    setActiveSection: (activeSection) => set({ activeSection, selectedEntry: null }),

    entries:    [],
    setEntries: (entries) => set({ entries }),

    selectedEntry:    null,
    setSelectedEntry: (selectedEntry) => set({ selectedEntry }),

    isSyncing:    false,
    setIsSyncing: (isSyncing) => set({ isSyncing }),
    lastSynced:   null,
    setLastSynced:(lastSynced) => set({ lastSynced }),
}))