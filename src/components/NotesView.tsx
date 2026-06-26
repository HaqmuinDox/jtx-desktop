import { useState } from 'react'
import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'

export function NotesView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType } = useAppStore()
    const [sortOrder, setSortOrder] = useState<'updated' | 'created' | 'alpha'>('updated')
    const [layout, setLayout] = useState<'grid' | 'list'>('grid')

    const notes = entries
        .filter(e => e.type === 'note')
        .sort((a, b) => {
            if (sortOrder === 'updated') return b.updated_at.localeCompare(a.updated_at)
            if (sortOrder === 'created') return b.created_at.localeCompare(a.created_at)
            return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' })
        })

    if (notes.length === 0) {
        return (
            <Empty
                icon="📝"
                title="No notes yet"
                subtitle="Floating notes from jtx Board will appear here after syncing"
                onNew={() => setCreatingType('note')}
            />
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
                    Notes
                    <span style={{
                        fontSize:   '14px',
                        fontFamily: 'var(--font-ui)',
                        color:      'var(--text-muted)',
                        marginLeft: '12px',
                        fontWeight: 300,
                    }}>
                        {notes.length}
                    </span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Layout toggles */}
                    <button
                        onClick={() => setLayout('grid')}
                        style={{
                            background:   layout === 'grid' ? 'var(--bg-active)' : 'transparent',
                            border:       '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color:        'var(--text-secondary)',
                            fontSize:     '14px',
                            padding:      '3px 7px',
                            cursor:       'pointer',
                        }}
                        title="Grid view"
                    >⊞</button>
                    <button
                        onClick={() => setLayout('list')}
                        style={{
                            background:   layout === 'list' ? 'var(--bg-active)' : 'transparent',
                            border:       '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color:        'var(--text-secondary)',
                            fontSize:     '14px',
                            padding:      '3px 7px',
                            cursor:       'pointer',
                        }}
                        title="List view"
                    >≡</button>
                    {/* Sort select */}
                    <select
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as 'updated' | 'created' | 'alpha')}
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
                        <option value="updated">Last updated</option>
                        <option value="created">Created</option>
                        <option value="alpha">A → Z</option>
                    </select>
                    <NewButton onClick={() => setCreatingType('note')} />
                </div>
            </div>

            {layout === 'grid' ? (
                /* Card grid */
                <div style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap:                 '12px',
                }}>
                    {notes.map(note => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            isSelected={selectedEntry?.id === note.id}
                            onClick={() => setSelectedEntry(
                                selectedEntry?.id === note.id ? null : note
                            )}
                        />
                    ))}
                </div>
            ) : (
                /* List */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {notes.map(note => (
                        <NoteListRow
                            key={note.id}
                            note={note}
                            isSelected={selectedEntry?.id === note.id}
                            onClick={() => setSelectedEntry(
                                selectedEntry?.id === note.id ? null : note
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function NoteCard({
                      note, isSelected, onClick
                  }: {
    note:       Entry
    isSelected: boolean
    onClick:    () => void
}) {
    const tags: string[] = (() => { try { return note.categories ? JSON.parse(note.categories) : [] } catch { return [] } })()

    const preview = note.body
        ? note.body.replace(/[#*`_]/g, '').slice(0, 180)
        : null

    const date = new Date(note.updated_at)
    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
    })

    return (
        <div
            onClick={onClick}
            style={{
                background:   isSelected ? 'var(--bg-active)' : 'var(--bg-raised)',
                border:       isSelected
                    ? '1px solid var(--accent-dim)'
                    : '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding:      '16px',
                cursor:       'pointer',
                transition:   'border-color 0.12s, background 0.12s, transform 0.12s',
                display:      'flex',
                flexDirection:'column',
                gap:          '8px',
            }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                if (!isSelected) {
                    el.style.borderColor = 'var(--border-strong)'
                    el.style.transform   = 'translateY(-1px)'
                }
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                if (!isSelected) {
                    el.style.borderColor = 'var(--border)'
                    el.style.transform   = 'translateY(0)'
                }
            }}
        >
            {/* Title */}
            {note.title && (
                <div style={{
                    fontSize:   '14px',
                    fontWeight: 500,
                    color:      'var(--text-primary)',
                    lineHeight: 1.3,
                }}
                     className="truncate"
                >
                    {note.title}
                </div>
            )}

            {/* Body preview */}
            {preview && (
                <div style={{
                    fontSize:   '13px',
                    color:      'var(--text-secondary)',
                    lineHeight: 1.6,
                    flex:       1,
                    overflow:   'hidden',
                    display:    '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                }}>
                    {preview}
                </div>
            )}

            {/* Footer: tags + date */}
            <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
                marginTop:  'auto',
            }}>
                {tags.slice(0, 2).map((tag: string) => (
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
                <span style={{
                    fontSize:  '10px',
                    color:     'var(--text-muted)',
                    marginLeft:'auto',
                }}>
          {dateStr}
        </span>
            </div>
        </div>
    )
}

function NoteListRow({
                         note, isSelected, onClick
                     }: {
    note:       Entry
    isSelected: boolean
    onClick:    () => void
}) {
    const tags: string[] = (() => { try { return note.categories ? JSON.parse(note.categories) : [] } catch { return [] } })()

    // 3-tier title fallback: real title → first body line → 'Untitled'
    let displayTitle: string
    let titleColor: string
    let titleFontStyle: 'normal' | 'italic' = 'normal'
    let bodyPreview: string | null = null

    if (note.title) {
        displayTitle = note.title
        titleColor   = 'var(--text-primary)'
        bodyPreview  = note.body ? note.body.replace(/[#*`_]/g, '').slice(0, 180) : null
    } else {
        const bodyFirstLine = note.body
            ?.split('\n')
            .find(l => l.trim())
            ?.replace(/^[#*>\-\s`]+/, '')
            .trim()
        if (bodyFirstLine) {
            displayTitle  = bodyFirstLine
            titleColor    = 'var(--text-secondary)'
            titleFontStyle = 'italic'
            // skip preview — the title already comes from the body
        } else {
            displayTitle  = 'Untitled'
            titleColor    = 'var(--text-muted)'
            titleFontStyle = 'italic'
        }
    }

    const date   = new Date(note.updated_at)
    const dayNum = date.toLocaleDateString('en-US', { day: '2-digit' })
    const month  = date.toLocaleDateString('en-US', { month: 'short' })

    return (
        <div
            onClick={onClick}
            style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '16px',
                padding:      '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor:       'pointer',
                borderLeft:   isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                background:   isSelected ? 'var(--bg-active)' : 'transparent',
                transition:   'background 0.12s',
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
                minWidth:   '36px',
                textAlign:  'center',
                paddingTop: '1px',
            }}>
                <div style={{
                    fontSize:   '18px',
                    fontFamily: 'var(--font-display)',
                    color:      isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    lineHeight: 1,
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
                    {month}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize:     '14px',
                    fontWeight:   500,
                    color:        titleColor,
                    fontStyle:    titleFontStyle,
                    marginBottom: '3px',
                }}
                     className="truncate"
                >
                    {displayTitle}
                </div>
                {bodyPreview && (
                    <div style={{
                        fontSize:  '12px',
                        color:     'var(--text-muted)',
                        lineHeight: 1.4,
                    }}
                         className="truncate"
                    >
                        {bodyPreview}
                    </div>
                )}
                {tags.length > 0 && (
                    <div style={{
                        display:  'flex',
                        gap:      '4px',
                        marginTop:'6px',
                        flexWrap: 'wrap',
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
                }}>+ New note</button>
            )}
        </div>
    )
}
