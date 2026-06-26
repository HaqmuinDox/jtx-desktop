const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
    {
        group: 'Navigation',
        items: [
            { keys: ['Ctrl', '1'], label: 'Go to Journals' },
            { keys: ['Ctrl', '2'], label: 'Go to Notes' },
            { keys: ['Ctrl', '3'], label: 'Go to Tasks' },
        ],
    },
    {
        group: 'Create',
        items: [
            { keys: ['Ctrl', 'N'], label: 'New entry (current section)' },
            { keys: ['Ctrl', 'Shift', 'J'], label: 'New Journal Entry' },
            { keys: ['Ctrl', 'Shift', 'N'], label: 'New Note' },
            { keys: ['Ctrl', 'Shift', 'T'], label: 'New Task' },
        ],
    },
    {
        group: 'Actions',
        items: [
            { keys: ['Ctrl', 'F'], label: 'Search' },
            { keys: ['Ctrl', 'Shift', 'S'], label: 'Sync Now' },
            { keys: ['Esc'], label: 'Close detail panel' },
            { keys: ['Ctrl', '/'], label: 'Show keyboard shortcuts' },
        ],
    },
    {
        group: 'Text Editing',
        items: [
            { keys: ['Ctrl', 'Z'], label: 'Undo' },
            { keys: ['Ctrl', 'Y'], label: 'Redo' },
            { keys: ['Ctrl', 'B'], label: 'Bold' },
            { keys: ['Ctrl', 'I'], label: 'Italic' },
        ],
    },
]

function Key({ label }: { label: string }) {
    return (
        <kbd style={{
            display:       'inline-flex',
            alignItems:    'center',
            justifyContent: 'center',
            minWidth:      24,
            padding:       '1px 6px',
            background:    'var(--bg-raised)',
            border:        '1px solid var(--border-strong)',
            borderRadius:  4,
            fontFamily:    'var(--font-ui)',
            fontSize:      11,
            color:         'var(--text-secondary)',
            boxShadow:     '0 1px 0 var(--border-strong)',
            whiteSpace:    'nowrap',
        }}>
            {label}
        </kbd>
    )
}

interface Props {
    onClose: () => void
}

export function ShortcutsModal({ onClose }: Props) {
    return (
        <div
            onClick={onClose}
            style={{
                position:       'fixed',
                inset:          0,
                background:     'rgba(0,0,0,0.55)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                zIndex:         1000,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background:   'var(--bg-surface)',
                    border:       '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow:    'var(--shadow-md)',
                    width:        520,
                    maxHeight:    '80vh',
                    overflow:     'auto',
                    padding:      24,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-primary)' }}>
                        Keyboard Shortcuts
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border:     'none',
                            color:      'var(--text-muted)',
                            cursor:     'pointer',
                            fontSize:   18,
                            lineHeight: 1,
                            padding:    '2px 4px',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                    {SHORTCUTS.map(group => (
                        <div key={group.group} style={{ marginBottom: 20 }}>
                            <div style={{
                                fontSize:      11,
                                fontWeight:    600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color:         'var(--text-muted)',
                                marginBottom:  8,
                            }}>
                                {group.group}
                            </div>
                            {group.items.map(item => (
                                <div key={item.label} style={{
                                    display:        'flex',
                                    alignItems:     'center',
                                    justifyContent: 'space-between',
                                    padding:        '5px 0',
                                    borderBottom:   '1px solid var(--border)',
                                    gap:            8,
                                }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                        {item.label}
                                    </span>
                                    <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                        {item.keys.map(k => <Key key={k} label={k} />)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
