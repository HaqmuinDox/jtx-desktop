import { useEffect, useState } from 'react'
import { ShortcutsModal } from './ShortcutsModal'

function IconMinimize() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
        </svg>
    )
}

function IconMaximize() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
        </svg>
    )
}

function IconRestore() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="var(--bg-surface)" />
            <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="var(--bg-surface)" />
        </svg>
    )
}

function IconClose() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    )
}

export function TitleBar() {
    const [maximized, setMaximized] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)

    useEffect(() => {
        window.api.window.isMaximized().then(setMaximized)
        window.api.window.onMaximizedChange(setMaximized)

        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowShortcuts(s => !s) }
            if (e.key === 'Escape') setShowShortcuts(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const btnBase = {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          46,
        height:         '100%',
        border:         'none',
        background:     'transparent',
        color:          'var(--text-secondary)',
        cursor:         'pointer',
        WebkitAppRegion: 'no-drag',
        flexShrink:     0,
        transition:     'background 0.1s, color 0.1s',
    } as React.CSSProperties

    return (
        <>
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        <div style={{
            height:          'var(--titlebar-h)',
            display:         'flex',
            alignItems:      'center',
            background:      'var(--bg-surface)',
            borderBottom:    '1px solid var(--border)',
            WebkitAppRegion: 'drag',
            flexShrink:      0,
            userSelect:      'none',
        } as React.CSSProperties}>
            <span style={{
                paddingLeft:  12,
                fontSize:     12,
                fontFamily:   'var(--font-ui)',
                color:        'var(--text-muted)',
                letterSpacing: '0.03em',
                flex:         1,
            }}>
                JTX Desktop
            </span>

            <button
                style={{ ...btnBase, width: 32, fontSize: 12, color: 'var(--text-muted)' }}
                onClick={() => setShowShortcuts(s => !s)}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                title="Keyboard shortcuts (Ctrl+/)"
            >
                ?
            </button>

            <button
                style={btnBase}
                onClick={() => window.api.window.minimize()}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                title="Minimize"
            >
                <IconMinimize />
            </button>

            <button
                style={btnBase}
                onClick={() => window.api.window.maximize()}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                title={maximized ? 'Restore' : 'Maximize'}
            >
                {maximized ? <IconRestore /> : <IconMaximize />}
            </button>

            <button
                style={{ ...btnBase, borderRadius: 0 }}
                onClick={() => window.api.window.close()}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c42b1c'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                title="Close"
            >
                <IconClose />
            </button>
        </div>
        </>
    )
}
