import { useState, useEffect } from 'react'
import { BookOpen, FileText, CheckSquare, Settings, Menu, Search, X } from 'lucide-react'
import { useAppStore, type Section } from '../store/app.ts'

interface Collection {
    url:          string
    display_name: string | null
    color:        string | null
}

type NavItem = { section: Section; label: string; Icon: React.ElementType }

const NAV_ITEMS: NavItem[] = [
    { section: 'journals', label: 'Journals', Icon: BookOpen      },
    { section: 'notes',    label: 'Notes',    Icon: FileText      },
    { section: 'todos',    label: 'Tasks',    Icon: CheckSquare   },
]

export function Sidebar() {
    const {
        activeSection, setActiveSection,
        searchQuery, setSearchQuery,
        sidebarCollapsed, setSidebarCollapsed,
        filterCollection, setFilterCollection,
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

    const openEasing  = 'cubic-bezier(0.4, 0, 0.2, 1)'
    const closeEasing = 'ease-in-out'
    // Open: content fades in after sidebar is mostly open
    // Close: content fades out in sync with the collapsing width (no blink, no empty sidebar)
    const sidebarTransition = sidebarCollapsed
        ? `width 0.28s ${closeEasing}`
        : `width 0.25s ${openEasing}`
    const contentTransition = sidebarCollapsed
        ? `opacity 0.22s ${closeEasing}`
        : `opacity 0.18s ease 0.14s`
    const labelTransition = sidebarCollapsed
        ? `opacity 0.22s ${closeEasing}, max-width 0.28s ${closeEasing}`
        : `opacity 0.18s ease 0.14s, max-width 0.25s ${openEasing}`
    // Animate padding-left and gap so icons don't jump to center instantly
    const buttonTransition = sidebarCollapsed
        ? `background 0.15s, color 0.15s, padding-left 0.28s ${closeEasing}, gap 0.28s ${closeEasing}`
        : `background 0.15s, color 0.15s, padding-left 0.25s ${openEasing}, gap 0.25s ${openEasing}`

    return (
        <aside style={{
            width:         sidebarCollapsed ? '50px' : 'var(--sidebar-width)',
            minWidth:      sidebarCollapsed ? '50px' : 'var(--sidebar-width)',
            background:    'var(--bg-surface)',
            display:       'flex',
            flexDirection: 'column',
            padding:       '16px 0 12px',
            borderRight:   '1px solid var(--border)',
            transition:    sidebarTransition,
            overflow:      'hidden',
        }}>
            {/* Header: hamburger + app title */}
            <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                padding:      sidebarCollapsed ? '0 0 16px 12px' : '0 16px 16px',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border)',
                transition:   sidebarCollapsed
                    ? `padding-left 0.28s ${closeEasing}`
                    : `padding-left 0.25s ${openEasing}`,
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
                    <Menu size={18} />
                </button>
                <div style={{
                    opacity:       sidebarCollapsed ? 0 : 1,
                    maxWidth:      sidebarCollapsed ? '0px' : '160px',
                    overflow:      'hidden',
                    transition:    labelTransition,
                    whiteSpace:    'nowrap',
                    pointerEvents: sidebarCollapsed ? 'none' : 'auto',
                }}>
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
            </div>

            {/* Search */}
            <div style={{ padding: '0 8px 12px', position: 'relative' }}>
                {/* Collapsed: standalone icon, mirrors nav-item alignment */}
                <div style={{
                    position:      'absolute',
                    inset:         0,
                    display:       'flex',
                    alignItems:    'center',
                    paddingLeft:   '16px',
                    opacity:       sidebarCollapsed ? 0.45 : 0,
                    transition:    contentTransition,
                    pointerEvents: 'none',
                }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* Expanded: input with icon inside */}
                <div style={{
                    opacity:       sidebarCollapsed ? 0 : 1,
                    transition:    contentTransition,
                    pointerEvents: sidebarCollapsed ? 'none' : 'auto',
                }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} aria-hidden="true" style={{
                            position:      'absolute',
                            left:          '9px',
                            top:           '50%',
                            transform:     'translateY(-50%)',
                            color:         'var(--text-muted)',
                            opacity:       0.5,
                            pointerEvents: 'none',
                        }} />
                        <input
                            type="text"
                            placeholder="Search…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            tabIndex={sidebarCollapsed ? -1 : 0}
                            style={{
                                width:        '100%',
                                background:   'var(--bg-raised)',
                                border:       '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color:        'var(--text-primary)',
                                fontFamily:   'var(--font-ui)',
                                fontSize:     '12px',
                                padding:      '7px 28px 7px 28px',
                                outline:      'none',
                                boxSizing:    'border-box',
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                tabIndex={-1}
                                aria-label="Clear search"
                                style={{
                                    position:    'absolute',
                                    right:       '7px',
                                    top:         '50%',
                                    transform:   'translateY(-50%)',
                                    background:  'none',
                                    border:      'none',
                                    padding:     '2px',
                                    cursor:      'pointer',
                                    color:       'var(--text-muted)',
                                    display:     'flex',
                                    alignItems:  'center',
                                    lineHeight:  1,
                                }}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    {searchQuery && (
                        <div style={{
                            fontSize:      '10px',
                            color:         'var(--text-muted)',
                            padding:       '3px 2px 0',
                            letterSpacing: '0.03em',
                        }}>
                            Searching in {
                                activeSection === 'journals' ? 'Journals' :
                                activeSection === 'notes'    ? 'Notes'    : 'Tasks'
                        }
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '0 8px' }}>
                {NAV_ITEMS.map(({ section, label, Icon }) => {
                    const isActive = activeSection === section
                    return (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            aria-current={isActive ? 'page' : undefined}
                            style={{
                                width:         '100%',
                                display:       'flex',
                                alignItems:    'center',
                                gap:           sidebarCollapsed ? 0 : '10px',
                                paddingTop:    '9px',
                                paddingBottom: '9px',
                                paddingLeft:   sidebarCollapsed ? '7px' : '12px',
                                paddingRight:  0,
                                borderRadius:  'var(--radius-md)',
                                border:        'none',
                                background:    isActive ? 'var(--bg-active)' : 'transparent',
                                color:         isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize:      '13px',
                                fontFamily:    'var(--font-ui)',
                                fontWeight:    isActive ? 500 : 400,
                                cursor:        'pointer',
                                textAlign:     'left',
                                marginBottom:  '2px',
                                transition:    buttonTransition,
                                borderLeft:    isActive
                                    ? '2px solid var(--accent)'
                                    : '2px solid transparent',
                            }}
                        >
                            <Icon aria-hidden="true" size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                            <span style={{
                                opacity:    sidebarCollapsed ? 0 : 1,
                                maxWidth:   sidebarCollapsed ? '0px' : '160px',
                                overflow:   'hidden',
                                transition: labelTransition,
                                whiteSpace: 'nowrap',
                            }}>
                                {label}
                            </span>
                        </button>
                    )
                })}
            </nav>

            {/* Collections */}
            {collections.length > 0 && (
                <div style={{
                    opacity:       sidebarCollapsed ? 0 : 1,
                    transition:    contentTransition,
                    pointerEvents: sidebarCollapsed ? 'none' : 'auto',
                    padding:       '0 8px',
                    marginBottom:  '4px',
                }}>
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
                    {collections.map(c => {
                        const isActive = filterCollection === c.url
                        return (
                            <button
                                key={c.url}
                                title={isActive ? 'Click to clear filter' : `Filter by ${c.display_name ?? c.url}`}
                                onClick={() => setFilterCollection(isActive ? null : c.url)}
                                style={{
                                    display:      'flex',
                                    alignItems:   'center',
                                    gap:          '7px',
                                    padding:      '5px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize:     '12px',
                                    color:        isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    overflow:     'hidden',
                                    width:        '100%',
                                    textAlign:    'left',
                                    background:   isActive ? 'var(--bg-active)' : 'transparent',
                                    border:       'none',
                                    cursor:       'pointer',
                                    borderLeft:   isActive ? '2px solid var(--accent)' : '2px solid transparent',
                                    transition:   'background 0.12s',
                                    fontFamily:   'var(--font-ui)',
                                }}
                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                            >
                                <span style={{
                                    width:        '7px',
                                    height:       '7px',
                                    minWidth:     '7px',
                                    borderRadius: '50%',
                                    background:   c.color ?? 'var(--accent)',
                                    opacity:      isActive ? 1 : 0.8,
                                    flexShrink:   0,
                                }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.display_name ?? c.url}
                                </span>
                            </button>
                        )
                    })}
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
                        width:         '100%',
                        display:       'flex',
                        alignItems:    'center',
                        gap:           sidebarCollapsed ? 0 : '10px',
                        paddingTop:    '9px',
                        paddingBottom: '9px',
                        paddingLeft:   sidebarCollapsed ? '7px' : '12px',
                        paddingRight:  0,
                        borderRadius:  'var(--radius-md)',
                        border:        'none',
                        background:    activeSection === 'settings' ? 'var(--bg-active)' : 'transparent',
                        color:         activeSection === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize:      '13px',
                        fontFamily:    'var(--font-ui)',
                        cursor:        'pointer',
                        textAlign:     'left',
                        transition:    buttonTransition,
                        borderLeft:    activeSection === 'settings'
                            ? '2px solid var(--accent)'
                            : '2px solid transparent',
                    }}
                >
                    <Settings aria-hidden="true" size={16} style={{ flexShrink: 0, opacity: activeSection === 'settings' ? 1 : 0.6 }} />
                    <span style={{
                        opacity:    sidebarCollapsed ? 0 : 1,
                        maxWidth:   sidebarCollapsed ? '0px' : '160px',
                        overflow:   'hidden',
                        transition: labelTransition,
                        whiteSpace: 'nowrap',
                    }}>
                        Settings
                    </span>
                </button>
            </div>
        </aside>
    )
}
