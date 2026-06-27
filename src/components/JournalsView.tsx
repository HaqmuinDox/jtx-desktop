import { useState } from 'react'
import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'
import { NewButton, Empty } from './shared'

const inlineTitleInputStyle: React.CSSProperties = {
    width:        '100%',
    background:   'transparent',
    border:       'none',
    borderBottom: '1px solid var(--accent-dim)',
    outline:      'none',
    fontSize:     'inherit',
    fontFamily:   'inherit',
    fontWeight:   'inherit',
    color:        'var(--text-primary)',
    padding:      '0',
    lineHeight:   'inherit',
}

export function JournalsView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType, searchQuery, setSearchQuery, filterCollections } = useAppStore()
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(
        () => (localStorage.getItem('jtx_journals_sort') as 'newest' | 'oldest' | null) ?? 'newest'
    )

    const journals = entries
        .filter(e => e.type === 'journal' && filterCollections.has(e.collection))
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
                newLabel="+ New entry"
            />
        )
    }

    if (filteredJournals.length === 0) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div>No results for "{searchQuery}"</div>
                <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-ui)', padding: '4px 12px', cursor: 'pointer' }}>
                    Clear search
                </button>
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
                        onChange={e => {
                            const v = e.target.value as 'newest' | 'oldest'
                            localStorage.setItem('jtx_journals_sort', v)
                            setSortOrder(v)
                        }}
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
                                onClick={() => setSelectedEntry(entry)}
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
    const { setEntries } = useAppStore()
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [titleDraft,     setTitleDraft]     = useState('')

    const saveTitle = async () => {
        setIsEditingTitle(false)
        const trimmed = titleDraft.trim()
        if (trimmed === (entry.title ?? '')) return
        await window.api.entries.update(entry.id, { title: trimmed || null })
        setEntries(await window.api.entries.getAll())
    }

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
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
            aria-pressed={isSelected}
            style={{
                display:       'flex',
                alignItems:    'flex-start',
                gap:           '16px',
                padding:       '12px 14px',
                borderRadius:  'var(--radius-md)',
                background:    isSelected ? 'var(--bg-active)' : 'transparent',
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
                <div
                    style={{ fontSize: '14px', fontWeight: 500, marginBottom: '3px' }}
                    onClick={e => { e.stopPropagation(); setTitleDraft(entry.title ?? ''); setIsEditingTitle(true) }}
                >
                    {isEditingTitle ? (
                        <input
                            autoFocus
                            value={titleDraft}
                            onChange={e => setTitleDraft(e.target.value)}
                            onBlur={saveTitle}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                e.stopPropagation()
                                if (e.key === 'Enter')  { e.preventDefault(); saveTitle() }
                                if (e.key === 'Escape') { setIsEditingTitle(false) }
                            }}
                            style={inlineTitleInputStyle}
                        />
                    ) : (
                        <span className="truncate" style={{ color: titleColor, fontStyle: titleFontStyle, cursor: 'text', display: 'block' }}>
                            {displayTitle}
                        </span>
                    )}
                </div>

                {entry.body && (
                    <div style={{
                        fontSize:  '12px',
                        color:     'var(--text-muted)',
                        lineHeight: 1.4,
                    }}
                         className="truncate"
                    >
                        {entry.body.replace(/^#{1,6}\s+/gm, '').replace(/[*`_~[\]()>]/g, '').replace(/^\s*[-*+\d.]+\s+/gm, '').replace(/\n+/g, ' ').trim().slice(0, 120)}
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

