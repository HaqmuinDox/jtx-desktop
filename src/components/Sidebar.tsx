import { useState, useEffect } from 'react'
import { useAppStore, type Section } from '../store/app.ts'

interface Collection {
    url:          string
    display_name: string | null
    color:        string | null
}

const NAV_ITEMS: { section: Section; label: string; icon: string }[] = [
    { section: 'journals', label: 'Journals', icon: '📖' },
    { section: 'notes',    label: 'Notes',    icon: '📝' },
    { section: 'todos',    label: 'Tasks',    icon: '✓'  },
]

export function Sidebar() {
    const {
        activeSection, setActiveSection,
        searchQuery, setSearchQuery,
        sidebarCollapsed, setSidebarCollapsed,
    } = useAppStore()

    const [collections, setCollections] = useState<Collection[]>(() => {
        try { return JSON.parse(localStorage.getItem('jtx_collections') ?? '[]') } catch { return [] }
    })

    useEffect(() => {
        window.api.collections.getAll().then(cols => {
            const typed = cols as Collection[]
            setCollections(typed)
            localStorage.setItem('jtx_collections', JSON.stringify(typed))
        })
    }, [])

    return (
        <aside style={{
            width:         sidebarCollapsed ? '48px' : 'var(--sidebar-width)',
            minWidth:      sidebarCollapsed ? '48px' : 'var(--sidebar-width)',
            background:    'var(--bg-surface)',
            display:       'flex',
            flexDirection: 'column',
            padding:       '16px 0 12px',
            borderRight:   '1px solid var(--border)',
            transition:    'width 0.2s ease',
            overflow:      'hidden',
        }}>
            {/* Header: hamburger + app title */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                gap:            '10px',
                padding:        sidebarCollapsed ? '0 0 16px' : '0 16px 16px',
                marginBottom:   '12px',
                borderBottom:   '1px solid var(--border)',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            }}>
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    style={{
                        background: 'transparent',
                        border:     'none',
                        color:      'var(--text-muted)',
                        cursor:     'pointer',
                        fontSize:   '18px',
                        lineHeight: 1,
                        padding:    '2px 4px',
                        flexShrink: 0,
                    }}
                >
                    ☰
                </button>
                {!sidebarCollapsed && (
                    <div>
                        <div style={{
                            fontFamily: 'var(--font-display)',
                            fontSize:   '20px',
                            color:      'var(--text-primary)',
                            lineHeight: 1.2,
                        }}>
                            jtx
                        </div>
                        <div style={{
                            fontSize:      '11px',
                            color:         'var(--text-muted)',
                            marginTop:     '2px',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                        }}>
                            desktop
                        </div>
                    </div>
                )}
            </div>

            {/* Search input */}
            {!sidebarCollapsed && (
                <div style={{ padding: '0 12px 12px' }}>
                    <input
                        type="search"
                        placeholder="Search…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width:        '100%',
                            background:   'var(--bg-raised)',
                            border:       '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            color:        'var(--text-primary)',
                            fontFamily:   'var(--font-ui)',
                            fontSize:     '12px',
                            padding:      '7px 10px',
                            outline:      'none',
                            boxSizing:    'border-box',
                        }}
                    />
                </div>
            )}

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
                                gap:            sidebarCollapsed ? 0 : '10px',
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                padding:        sidebarCollapsed ? '9px 0' : '9px 12px',
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
                            {!sidebarCollapsed && label}
                        </button>
                    )
                })}
            </nav>

            {/* Collections */}
            {!sidebarCollapsed && collections.length > 0 && (
                <div style={{ padding: '0 8px', marginBottom: '4px' }}>
                    <div style={{
                        fontSize:      '10px',
                        color:         'var(--text-muted)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding:       '0 4px',
                        marginBottom:  '4px',
                    }}>
                        Collections
                    </div>
                    {collections.map(c => (
                        <div
                            key={c.url}
                            title={c.url}
                            style={{
                                display:      'flex',
                                alignItems:   'center',
                                gap:          '7px',
                                padding:      '5px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize:     '12px',
                                color:        'var(--text-secondary)',
                                overflow:     'hidden',
                            }}
                        >
                            <span style={{
                                width:        '7px',
                                height:       '7px',
                                minWidth:     '7px',
                                borderRadius: '50%',
                                background:   c.color ?? 'var(--accent)',
                                opacity:      0.8,
                            }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.display_name ?? c.url}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Settings at bottom */}
            <div style={{ padding: '0 8px' }}>
                <div style={{
                    height:     '1px',
                    background: 'var(--border)',
                    margin:     '8px 4px 10px',
                }} />
                <button
                    onClick={() => setActiveSection('settings')}
                    aria-current={activeSection === 'settings' ? 'page' : undefined}
                    aria-label="Settings"
                    style={{
                        width:          '100%',
                        display:        'flex',
                        alignItems:     'center',
                        gap:            sidebarCollapsed ? 0 : '10px',
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        padding:        sidebarCollapsed ? '9px 0' : '9px 12px',
                        borderRadius:   'var(--radius-md)',
                        border:         'none',
                        background:     activeSection === 'settings' ? 'var(--bg-active)' : 'transparent',
                        color:          activeSection === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize:       '13px',
                        fontFamily:     'var(--font-ui)',
                        cursor:         'pointer',
                        textAlign:      'left',
                        transition:     'background 0.15s, color 0.15s',
                        borderLeft:     activeSection === 'settings'
                            ? '2px solid var(--accent)'
                            : '2px solid transparent',
                    }}
                >
                    <span aria-hidden="true" style={{ fontSize: '14px', opacity: 0.6 }}>⚙</span>
                    {!sidebarCollapsed && 'Settings'}
                </button>
            </div>
        </aside>
    )
}
