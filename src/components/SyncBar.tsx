import { useState, useEffect } from 'react'
import { useAppStore } from '../store/app.ts'

export function SyncBar() {
    const { isSyncing, setIsSyncing, lastSynced, setLastSynced } = useAppStore()
    const [pendingChanges, setPendingChanges] = useState(0)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Poll sync status every 30 seconds
        const check = async () => {
            try {
                const status = await window.api.sync.getStatus()
                setPendingChanges(status.pending_changes)
                if (status.last_synced_at) setLastSynced(status.last_synced_at)
            } catch (_e) {
                // silently ignore — no credentials set yet
            }
        }
        check()
        const interval = setInterval(check, 30_000)
        return () => clearInterval(interval)
    }, [setLastSynced])

    const handleSyncNow = async () => {
        setIsSyncing(true)
        setError(null)
        try {
            const result = await window.api.sync.now()
            if (result.last_synced_at) setLastSynced(result.last_synced_at)
            const entries = await window.api.entries.getAll()
            useAppStore.getState().setEntries(entries)
            // Refresh pending count immediately after sync
            const status = await window.api.sync.getStatus()
            setPendingChanges(status.pending_changes)
        } catch (_e) {
            setError('Sync failed')
        } finally {
            setIsSyncing(false)
        }
    }

    const formatLastSynced = (iso: string | null) => {
        if (!iso) return 'Never synced'
        const date = new Date(iso)
        const now  = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
        if (diff < 60)   return 'Synced just now'
        if (diff < 3600) return `Synced ${Math.floor(diff / 60)}m ago`
        return `Synced at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }

    return (
        <div style={{
            height:         'var(--statusbar-h)',
            background:     'var(--bg-surface)',
            borderTop:      '1px solid var(--border)',
            display:        'flex',
            alignItems:     'center',
            padding:        '0 16px',
            gap:            '12px',
            fontSize:       '11px',
            color:          'var(--text-muted)',
            flexShrink:     0,
        }}>
            {/* Sync indicator dot */}
            <div style={{
                width:        '6px',
                height:       '6px',
                borderRadius: '50%',
                background:   error
                    ? '#c04040'
                    : isSyncing
                        ? 'var(--accent)'
                        : '#4a7c4a',
                flexShrink:   0,
                boxShadow:    isSyncing ? '0 0 6px var(--accent)' : 'none',
                transition:   'background 0.3s, box-shadow 0.3s',
            }} />

            {/* Status text */}
            <span style={{ flex: 1 }}>
        {error
            ? error
            : isSyncing
                ? 'Syncing…'
                : formatLastSynced(lastSynced)}
      </span>

            {/* Pending changes */}
            {pendingChanges > 0 && !isSyncing && (
                <span style={{ color: 'var(--accent-dim)' }}>
          {pendingChanges} unsynced
        </span>
            )}

            {/* Sync now button */}
            <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                style={{
                    background:    'transparent',
                    border:        '1px solid var(--border-strong)',
                    borderRadius:  'var(--radius-sm)',
                    color:         isSyncing ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize:      '11px',
                    fontFamily:    'var(--font-ui)',
                    padding:       '2px 8px',
                    cursor:        isSyncing ? 'not-allowed' : 'pointer',
                    transition:    'border-color 0.15s, color 0.15s',
                }}
            >
                {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>
        </div>
    )
}