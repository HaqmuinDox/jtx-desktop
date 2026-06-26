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
            }
            credentials: {
                save: (creds: Record<string, string>) => Promise<{ ok: boolean }>
                load: () => Promise<{ serverUrl: string; username: string; password: string } | null>
            }
        }
    }
}

export default function App() {
    const { activeSection, selectedEntry, creatingType, setEntries, setDeviceLocation } = useAppStore()

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
            width:         '100vw',
            height:        '100vh',
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
                    <EntryDetail />
                )}
            </div>

            {/* Status bar at bottom */}
            <SyncBar />
        </div>
    )
}