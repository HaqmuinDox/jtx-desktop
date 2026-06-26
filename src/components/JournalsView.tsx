import { useState } from 'react'
import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'

export function JournalsView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType, searchQuery } = useAppStore()
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

    const journals = entries
        .filter(e => e.type === 'journal')
        .sort((a, b) => {
            const dateA = a.start_date ?? a.created_at
            const dateB = b.start_date ?? b.created_at
            return sortOrder === 'newest'
                ? dateB.localeCompare(dateA)
                : dateA.localeCompare(dateB)
        })

    const filteredJournals = searchQuery
        ? journals.filter(e =>
            (e.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.body  ?? '').toLowerCase().includes(searchQuery.toLowerCase())
          )
        : journals

    // Group by month
    const groups = filteredJournals.reduce<Record<string, Entry[]>>((acc, entry) => {
        const date  = new Date(entry.start_date ?? entry.created_at)
        const key   = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        if (!acc[key]) acc[key] = []
        acc[key].push(entry)
        return acc
    }, {})

    if (journals.length === 0) {
        return (
            <Empty
                icon="📖"
                title="No journal entries yet"
                subtitle="Entries from jtx Board will appear here after syncing"
                onNew={() => setCreatingType('journal')}
            />
        )
    }

    if (filteredJournals.length === 0) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No results for "{searchQuery}"
            </div>
        )
    }

    return (
        <div style={{
            flex:      1,
            overflowY: 'auto',
            padding:   '32px 36px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize:   '26px',
                    fontWeight: 400,
                    color:      'var(--text-primary)',
                    margin:     0,
                }}>
                    Journals
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
                        style={{
                            background:   'var(--bg-raised)',
                            border:       '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color:        'var(--text-secondary)',
                            fontSize:     '12px',
                            fontFamily:   'var(--font-ui)',
                            padding:      '4px 8px',
                            cursor:       'pointer',
                            outline:      'none',
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                    <NewButton onClick={() => setCreatingType('journal')} />
                </div>
            </div>

            {Object.entries(groups).map(([month, monthEntries]) => (
                <div key={month} style={{ marginBottom: '36px' }}>
                    {/* Month header */}
                    <div style={{
                        fontSize:     '11px',
                        color:        'var(--accent)',
                        letterSpacing:'0.1em',
                        textTransform:'uppercase',
                        fontWeight:   500,
                        marginBottom: '12px',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '10px',
                    }}>
                        {month}
                        <div style={{
                            flex:       1,
                            height:     '1px',
                            background: 'var(--border)',
                        }} />
                    </div>

                    {/* Entries */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {monthEntries.map(entry => (
                            <JournalRow
                                key={entry.id}
                                entry={entry}
                                isSelected={selectedEntry?.id === entry.id}
                                onClick={() => setSelectedEntry(
                                    selectedEntry?.id === entry.id ? null : entry
                                )}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function JournalRow({
                        entry, isSelected, onClick
                    }: {
    entry:      Entry
    isSelected: boolean
    onClick:    () => void
}) {
    const date    = new Date(entry.start_date ?? entry.created_at)
    const dayNum  = date.toLocaleDateString('en-US', { day: '2-digit' })
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    const tags: string[] = (() => { try { return entry.categories ? JSON.parse(entry.categories) : [] } catch { return [] } })()

    // Determine display title and its style
    let displayTitle: string
    let titleColor: string
    let titleFontStyle: 'normal' | 'italic' = 'normal'

    if (entry.title) {
        displayTitle = entry.title
        titleColor   = 'var(--text-primary)'
    } else {
        const bodyFirstLine = entry.body
            ?.split('\n')
            .find(l => l.trim())
            ?.replace(/^[#*>\-\s`]+/, '')
            .trim()
        if (bodyFirstLine) {
            displayTitle  = bodyFirstLine
            titleColor    = 'var(--text-secondary)'
            titleFontStyle = 'italic'
        } else {
            displayTitle  = 'Untitled'
            titleColor    = 'var(--text-muted)'
            titleFontStyle = 'italic'
        }
    }

    return (
        <div
            onClick={onClick}
            style={{
                display:       'flex',
                alignItems:    'flex-start',
                gap:           '16px',
                padding:       '12px 14px',
                borderRadius:  'var(--radius-md)',
                background:    isSelected ? 'var(--bg-active)' : 'transparent',
                borderLeft:    isSelected
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                cursor:        'pointer',
                transition:    'background 0.12s',
            }}
            onMouseEnter={e => {
                if (!isSelected)
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={e => {
                if (!isSelected)
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
        >
            {/* Date badge */}
            <div style={{
                minWidth:    '36px',
                textAlign:   'center',
                paddingTop:  '1px',
            }}>
                <div style={{
                    fontSize:   '18px',
                    fontFamily: 'var(--font-display)',
                    color:      isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    lineHeight:  1,
                }}>
                    {dayNum}
                </div>
                <div style={{
                    fontSize:      '10px',
                    color:         'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop:     '2px',
                }}>
                    {dayName}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize:     '14px',
                    color:        titleColor,
                    fontWeight:   500,
                    fontStyle:    titleFontStyle,
                    marginBottom: '3px',
                }}
                     className="truncate"
                >
                    {displayTitle}
                </div>

                {entry.body && (
                    <div style={{
                        fontSize:  '12px',
                        color:     'var(--text-muted)',
                        lineHeight: 1.4,
                    }}
                         className="truncate"
                    >
                        {entry.body.replace(/[#*`_]/g, '').slice(0, 120)}
                    </div>
                )}

                {tags.length > 0 && (
                    <div style={{
                        display:   'flex',
                        gap:       '4px',
                        marginTop: '6px',
                        flexWrap:  'wrap',
                    }}>
                        {tags.slice(0, 4).map((tag: string) => (
                            <span key={tag} style={{
                                fontSize:     '10px',
                                color:        'var(--accent-dim)',
                                background:   'var(--accent-glow)',
                                borderRadius: 'var(--radius-sm)',
                                padding:      '1px 6px',
                            }}>
                {tag}
              </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function NewButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            background:   'rgba(196,163,90,0.12)',
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

function Empty({ icon, title, subtitle, onNew }: {
    icon: string; title: string; subtitle: string; onNew?: () => void
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
                    background:   'rgba(196,163,90,0.12)',
                    border:       '1px solid var(--accent-dim)',
                    borderRadius: 'var(--radius-md)',
                    color:        'var(--accent)',
                    fontSize:     '13px',
                    fontFamily:   'var(--font-ui)',
                    padding:      '8px 20px',
                    cursor:       'pointer',
                }}>+ New entry</button>
            )}
        </div>
    )
}
