import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'

export function NotesView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType } = useAppStore()

    const notes = entries
        .filter(e => e.type === 'note')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

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
                <NewButton onClick={() => setCreatingType('note')} />
            </div>

            {/* Card grid */}
            <div style={{
                display:               'grid',
                gridTemplateColumns:   'repeat(auto-fill, minmax(220px, 1fr))',
                gap:                   '12px',
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
    const tags = note.categories
        ? JSON.parse(note.categories) as string[]
        : []

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
                minHeight:    '120px',
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
            <div style={{
                fontSize:   '14px',
                fontWeight: 500,
                color:      'var(--text-primary)',
                lineHeight: 1.3,
            }}
                 className="truncate"
            >
                {note.title || 'Untitled'}
            </div>

            {/* Body preview */}
            {preview && (
                <div style={{
                    fontSize:   '12px',
                    color:      'var(--text-muted)',
                    lineHeight: 1.5,
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