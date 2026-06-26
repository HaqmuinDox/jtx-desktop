import { useAppStore, type Section } from '../store/app.ts'

const NAV_ITEMS: { section: Section; label: string; icon: string }[] = [
    { section: 'journals', label: 'Journals', icon: '📖' },
    { section: 'notes',    label: 'Notes',    icon: '📝' },
    { section: 'todos',    label: 'Tasks',    icon: '✓'  },
]

export function Sidebar() {
    const { activeSection, setActiveSection } = useAppStore()

    return (
        <aside style={{
            width:          'var(--sidebar-width)',
            minWidth:       'var(--sidebar-width)',
            background:     'var(--bg-surface)',
            display:        'flex',
            flexDirection:  'column',
            padding:        '24px 0 12px',
            borderRight:    '1px solid var(--border)',
        }}>
            {/* App title */}
            <div style={{
                padding:      '0 20px 28px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '12px',
            }}>
                <div style={{
                    fontFamily:  'var(--font-display)',
                    fontSize:    '20px',
                    color:       'var(--text-primary)',
                    lineHeight:  1.2,
                }}>
                    jtx
                </div>
                <div style={{
                    fontSize:  '11px',
                    color:     'var(--text-muted)',
                    marginTop: '2px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                }}>
                    desktop
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '0 8px' }}>
                {NAV_ITEMS.map(({ section, label, icon }) => {
                    const isActive = activeSection === section
                    return (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            aria-current={isActive ? 'page' : undefined}
                            style={{
                                width:          '100%',
                                display:        'flex',
                                alignItems:     'center',
                                gap:            '10px',
                                padding:        '9px 12px',
                                borderRadius:   'var(--radius-md)',
                                border:         'none',
                                background:     isActive ? 'var(--bg-active)' : 'transparent',
                                color:          isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize:       '13px',
                                fontFamily:     'var(--font-ui)',
                                fontWeight:     isActive ? 500 : 400,
                                cursor:         'pointer',
                                textAlign:      'left',
                                marginBottom:   '2px',
                                transition:     'background 0.15s, color 0.15s',
                                borderLeft:     isActive
                                    ? '2px solid var(--accent)'
                                    : '2px solid transparent',
                            }}
                        >
              <span aria-hidden="true" style={{ fontSize: '14px', opacity: isActive ? 1 : 0.6 }}>
                {icon}
              </span>
                            {label}
                        </button>
                    )
                })}
            </nav>

            {/* Settings at bottom */}
            <div style={{ padding: '0 8px' }}>
                <div style={{
                    height:       '1px',
                    background:   'var(--border)',
                    margin:       '8px 4px 10px',
                }} />
                <button
                    onClick={() => setActiveSection('settings')}
                    aria-current={activeSection === 'settings' ? 'page' : undefined}
                    aria-label="Settings"
                    style={{
                        width:        '100%',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '10px',
                        padding:      '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border:       'none',
                        background:   activeSection === 'settings' ? 'var(--bg-active)' : 'transparent',
                        color:        activeSection === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize:     '13px',
                        fontFamily:   'var(--font-ui)',
                        cursor:       'pointer',
                        textAlign:    'left',
                        transition:   'background 0.15s, color 0.15s',
                        borderLeft:   activeSection === 'settings'
                            ? '2px solid var(--accent)'
                            : '2px solid transparent',
                    }}
                >
                    <span aria-hidden="true" style={{ fontSize: '14px', opacity: 0.6 }}>⚙</span>
                    Settings
                </button>
            </div>
        </aside>
    )
}