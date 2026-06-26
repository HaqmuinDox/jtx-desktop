import { useEffect } from 'react'
import { useAppStore } from './store/app.ts'
import { Sidebar } from './components/Sidebar'
import { JournalsView } from './components/JournalsView'
import { NotesView } from './components/NotesView'
import { TodosView } from './components/TodosView'
import { SettingsView } from './components/SettingsView'
import { EntryDetail } from './components/EntryDetail'
import { SyncBar } from './components/SyncBar'
import type { Entry } from '../shared/types'
import './index.css'

// Extend window with our typed API bridge
declare global {
    interface Window {
        api: {
            entries: {
                getAll:   (filters?: { type?: string; collection?: string }) => Promise<Entry[]>
                getById:  (id: string) => Promise<Entry>
                create:   (entry: Record<string, unknown>) => Promise<{ id: string }>
                update:   (id: string, fields: Record<string, unknown>) => Promise<{ ok: boolean }>
                delete:   (id: string) => Promise<{ ok: boolean }>
                touch:    (id: string) => Promise<{ ok: boolean }>
            }
            collections: {
                getAll:  () => Promise<unknown[]>
                upsert:  (col: Record<string, unknown>) => Promise<{ ok: boolean }>
            }
            sync: {
                getStatus:      () => Promise<{ state: string; last_synced_at: string | null; pending_changes: number }>
                now:            () => Promise<{ state: string; last_synced_at: string | null }>
                setCredentials: (creds: Record<string, string>) => Promise<{ ok: boolean }>
                testConnection: (creds: Record<string, string>) => Promise<{ ok: boolean; error?: string }>
                resetCache:     () => Promise<{ ok: boolean }>
                setInterval:     (minutes: number) => Promise<void>
            }
            credentials: {
                save: (creds: Record<string, string>) => Promise<{ ok: boolean }>
                load: () => Promise<{ serverUrl: string; username: string; password: string } | null>
            }
            onMenuAction: (cb: (action: string) => void) => void
        }
    }
}

function startDetailResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX    = e.clientX
    const startWidth = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--detail-width')
    )
    const onMove = (mv: MouseEvent) => {
        const w = Math.max(300, Math.min(700, startWidth - (mv.clientX - startX)))
        document.documentElement.style.setProperty('--detail-width', `${w}px`)
        localStorage.setItem('jtx_detail_width', String(w))
    }
    const onUp = () => {
        document.body.style.cursor    = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup',   onUp)
    }
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
}

function DetailResizeHandle() {
    const normal = 'linear-gradient(to right, transparent 2px, var(--border-strong) 2px, var(--border-strong) 3px, transparent 3px)'
    const hover  = 'linear-gradient(to right, transparent 2px, var(--accent-dim)    2px, var(--accent-dim)    3px, transparent 3px)'
    return (
        <div
            onMouseDown={startDetailResize}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = hover}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = normal}
            style={{ width: '5px', flexShrink: 0, cursor: 'col-resize', background: normal }}
        />
    )
}

export default function App() {
    const { activeSection, selectedEntry, creatingType, setEntries, setDeviceLocation, setActiveSection, setCreatingType, setSelectedEntry, setIsSyncing, setLastSynced } = useAppStore()

    // Restore persisted detail panel width
    useEffect(() => {
        const dw = localStorage.getItem('jtx_detail_width')
        if (dw) document.documentElement.style.setProperty('--detail-width', `${dw}px`)
    }, [])

    // Load all entries on mount
    useEffect(() => {
        window.api.entries.getAll().then(setEntries)
    }, [setEntries])

    // Load user-configured default location from localStorage into the store
    useEffect(() => {
        try {
            const raw = localStorage.getItem('jtx_default_location')
            if (!raw) return
            const loc = JSON.parse(raw) as { lat?: string; lon?: string; name?: string }
            if (loc.lat && loc.lon) setDeviceLocation({ lat: loc.lat, lon: loc.lon, name: loc.name ?? null })
        } catch { /* ignore */ }
    }, [setDeviceLocation])

    // Native menu actions and global keyboard shortcuts
    useEffect(() => {
        // Native menu actions from main process
        window.api.onMenuAction((action: string) => {
            if (action === 'new-journal') { setActiveSection('journals'); setCreatingType('journal') }
            if (action === 'new-note')    { setActiveSection('notes');    setCreatingType('note') }
            if (action === 'new-task')    { setActiveSection('todos');    setCreatingType('todo') }
            if (action === 'sync-now') {
                setIsSyncing(true)
                window.api.sync.now()
                    .then(result => {
                        if (result.last_synced_at) setLastSynced(result.last_synced_at)
                        return window.api.entries.getAll()
                    })
                    .then(setEntries)
                    .finally(() => setIsSyncing(false))
            }
        })

        // Keyboard shortcuts
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '1') { e.preventDefault(); setActiveSection('journals') }
            if (e.ctrlKey && e.key === '2') { e.preventDefault(); setActiveSection('notes') }
            if (e.ctrlKey && e.key === '3') { e.preventDefault(); setActiveSection('todos') }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault()
                const section = useAppStore.getState().activeSection
                if (section === 'journals') setCreatingType('journal')
                else if (section === 'notes') setCreatingType('note')
                else if (section === 'todos') setCreatingType('todo')
            }
            if (e.key === 'Escape') {
                setSelectedEntry(null)
                setCreatingType(null)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const mainContent = () => {
        switch (activeSection) {
            case 'journals':  return <JournalsView />
            case 'notes':     return <NotesView />
            case 'todos':     return <TodosView />
            case 'settings':  return <SettingsView />
        }
    }

    return (
        <div style={{
            display:       'flex',
            flexDirection: 'column',
            width:         '100%',
            height:        '100%',
            background:    'var(--bg-base)',
        }}>
            {/* Main area: sidebar + content + detail */}
            <div style={{
                display:  'flex',
                flex:     1,
                overflow: 'hidden',
            }}>
                <Sidebar />

                <main style={{
                    flex:       1,
                    overflow:   'hidden',
                    display:    'flex',
                    flexDirection: 'column',
                    borderLeft: '1px solid var(--border)',
                }}>
                    {mainContent()}
                </main>

                {(selectedEntry || creatingType) && (
                    <>
                        <DetailResizeHandle />
                        <EntryDetail />
                    </>
                )}
            </div>

            {/* Status bar at bottom */}
            <SyncBar />
        </div>
    )
}