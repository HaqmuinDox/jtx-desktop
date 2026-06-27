export function NewButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            background:   'var(--accent-glow)',
            border:       '1px solid var(--accent-dim)',
            borderRadius: 'var(--radius-sm)',
            color:        'var(--accent)',
            fontSize:     '20px',
            lineHeight:   1,
            padding:      '1px 10px 3px',
            cursor:       'pointer',
            fontFamily:   'var(--font-ui)',
        }}>+</button>
    )
}

export function Empty({ icon, title, subtitle, onNew, newLabel = '+ New entry' }: {
    icon:      string
    title:     string
    subtitle:  string
    onNew?:    () => void
    newLabel?: string
}) {
    return (
        <div style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '12px',
            color:          'var(--text-muted)',
            padding:        '60px',
        }}>
            <div style={{ fontSize: '40px', opacity: 0.4 }}>{icon}</div>
            <div style={{
                fontFamily: 'var(--font-display)',
                fontSize:   '18px',
                color:      'var(--text-secondary)',
            }}>
                {title}
            </div>
            <div style={{ fontSize: '13px', textAlign: 'center', maxWidth: '280px' }}>
                {subtitle}
            </div>
            {onNew && (
                <button onClick={onNew} style={{
                    marginTop:    '8px',
                    background:   'var(--accent-glow)',
                    border:       '1px solid var(--accent-dim)',
                    borderRadius: 'var(--radius-md)',
                    color:        'var(--accent)',
                    fontSize:     '13px',
                    fontFamily:   'var(--font-ui)',
                    padding:      '8px 20px',
                    cursor:       'pointer',
                }}>{newLabel}</button>
            )}
        </div>
    )
}
