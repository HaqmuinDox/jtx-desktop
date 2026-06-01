import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'

export function EntryDetail() {
    const { selectedEntry, setSelectedEntry, entries } = useAppStore()

    if (!selectedEntry) return null

    const subtasks = entries.filter(
        e => e.type === 'todo' && e.parent_uid === selectedEntry.id
    )

    const tags = selectedEntry.categories
        ? JSON.parse(selectedEntry.categories) as string[]
        : []

    return (
        <aside style={{
            width:        'var(--detail-width)',
            minWidth:     'var(--detail-width)',
            background:   'var(--bg-surface)',
            borderLeft:   '1px solid var(--border)',
            display:      'flex',
            flexDirection:'column',
            overflow:     'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding:       '20px 24px 16px',
                borderBottom:  '1px solid var(--border)',
                display:       'flex',
                alignItems:    'flex-start',
                gap:           '12px',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize:      '11px',
                        color:         'var(--accent)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom:  '6px',
                    }}>
                        {selectedEntry.type === 'journal'
                            ? '📖 Journal'
                            : selectedEntry.type === 'note'
                                ? '📝 Note'
                                : '✓ Task'}
                    </div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize:   '20px',
                        fontWeight: 400,
                        color:      'var(--text-primary)',
                        lineHeight: 1.3,
                    }}>
                        {selectedEntry.title || 'Untitled'}
                    </h2>
                </div>

                {/* Close button */}
                <button
                    onClick={() => setSelectedEntry(null)}
                    style={{
                        background:   'transparent',
                        border:       'none',
                        color:        'var(--text-muted)',
                        fontSize:     '18px',
                        cursor:       'pointer',
                        padding:      '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        lineHeight:   1,
                        flexShrink:   0,
                    }}
                >
                    ×
                </button>
            </div>

            {/* Scrollable body */}
            <div style={{
                flex:      1,
                overflowY: 'auto',
                padding:   '20px 24px',
                display:   'flex',
                flexDirection: 'column',
                gap:       '20px',
            }}>

                {/* Metadata */}
                <MetaGrid entry={selectedEntry} />

                {/* Tags */}
                {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {tags.map((tag: string) => (
                            <span key={tag} style={{
                                fontSize:     '11px',
                                color:        'var(--accent)',
                                background:   'var(--accent-glow)',
                                border:       '1px solid var(--accent-dim)',
                                borderRadius: 'var(--radius-sm)',
                                padding:      '2px 8px',
                            }}>
                {tag}
              </span>
                        ))}
                    </div>
                )}

                {/* Progress bar for todos */}
                {selectedEntry.type === 'todo' && selectedEntry.progress != null && (
                    <div>
                        <div style={{
                            display:       'flex',
                            justifyContent:'space-between',
                            fontSize:      '11px',
                            color:         'var(--text-muted)',
                            marginBottom:  '6px',
                        }}>
                            <span>Progress</span>
                            <span>{selectedEntry.progress}%</span>
                        </div>
                        <div style={{
                            height:       '4px',
                            background:   'var(--border)',
                            borderRadius: '2px',
                            overflow:     'hidden',
                        }}>
                            <div style={{
                                height:       '100%',
                                width:        `${selectedEntry.progress}%`,
                                background:   'var(--accent)',
                                borderRadius: '2px',
                                transition:   'width 0.3s',
                            }} />
                        </div>
                    </div>
                )}

                {/* Body / description */}
                {selectedEntry.body && (
                    <div>
                        <SectionLabel>Notes</SectionLabel>
                        <div style={{
                            fontSize:   '13px',
                            color:      'var(--text-secondary)',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            wordBreak:  'break-word',
                        }}>
                            {selectedEntry.body}
                        </div>
                    </div>
                )}

                {/* Subtasks */}
                {subtasks.length > 0 && (
                    <div>
                        <SectionLabel>
                            Subtasks ({subtasks.filter(s => s.status === 'COMPLETED').length}/{subtasks.length})
                        </SectionLabel>
                        <div style={{
                            display:       'flex',
                            flexDirection: 'column',
                            gap:           '4px',
                        }}>
                            {subtasks.map(sub => (
                                <SubtaskRow key={sub.id} subtask={sub} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recurrence */}
                {selectedEntry.rrule && (
                    <div>
                        <SectionLabel>Recurrence</SectionLabel>
                        <div style={{
                            fontSize:     '12px',
                            color:        'var(--text-muted)',
                            background:   'var(--bg-raised)',
                            borderRadius: 'var(--radius-sm)',
                            padding:      '6px 10px',
                            fontFamily:   'monospace',
                        }}>
                            {selectedEntry.rrule}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaGrid({ entry }: { entry: Entry }) {
    const rows: { label: string; value: string }[] = []

    if (entry.start_date)
        rows.push({
            label: 'Date',
            value: new Date(entry.start_date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
        })

    if (entry.due_date)
        rows.push({
            label: 'Due',
            value: new Date(entry.due_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            })
        })

    if (entry.status)
        rows.push({ label: 'Status', value: entry.status })

    if (entry.priority)
        rows.push({
            label: 'Priority',
            value: entry.priority <= 3 ? '🔴 High' : entry.priority <= 6 ? '🟡 Medium' : '🟢 Low'
        })

    if (entry.updated_at)
        rows.push({
            label: 'Updated',
            value: new Date(entry.updated_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            })
        })

    if (rows.length === 0) return null

    return (
        <div style={{
            display:             'grid',
            gridTemplateColumns: 'auto 1fr',
            gap:                 '6px 16px',
            fontSize:            '12px',
        }}>
            {rows.map(({ label, value }) => (
                <>
                    <span key={`${label}-l`} style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span key={`${label}-v`} style={{ color: 'var(--text-secondary)' }}>{value}</span>
                </>
            ))}
        </div>
    )
}

function SubtaskRow({ subtask }: { subtask: Entry }) {
    const isDone = subtask.status === 'COMPLETED' || subtask.status === 'CANCELLED'
    return (
        <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '10px',
            padding:    '6px 10px',
            borderRadius:'var(--radius-sm)',
            background: 'var(--bg-raised)',
        }}>
            <div style={{
                width:        '14px',
                height:       '14px',
                minWidth:     '14px',
                borderRadius: '50%',
                border:       `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                background:   isDone ? 'var(--text-muted)' : 'transparent',
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                fontSize:     '8px',
                color:        'var(--bg-base)',
            }}>
                {isDone && '✓'}
            </div>
            <span style={{
                fontSize:       '13px',
                color:          isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                textDecoration: isDone ? 'line-through' : 'none',
                flex:           1,
            }}
                  className="truncate"
            >
        {subtask.title || 'Untitled'}
      </span>
        </div>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize:      '11px',
            color:         'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom:  '8px',
        }}>
            {children}
        </div>
    )
}