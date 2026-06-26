import { useAppStore } from '../store/app.ts'
import type { Entry } from '../../shared/types'

const STATUS_PROGRESS: Record<string, number> = {
    'NEEDS-ACTION': 0,
    'IN-PROCESS':   50,
    'COMPLETED':    100,
    'CANCELLED':    100,
}

function computeProgress(status: string | null, subtasks: Entry[]): number {
    if (subtasks.length > 0) {
        const sum = subtasks.reduce((acc, s) => acc + (STATUS_PROGRESS[s.status ?? ''] ?? 0), 0)
        return Math.round(sum / subtasks.length)
    }
    return STATUS_PROGRESS[status ?? ''] ?? 0
}

const STATUS_GROUPS = [
    { status: 'NEEDS-ACTION', label: 'Open',        color: '#a09880' },
    { status: 'IN-PROCESS',   label: 'In Progress', color: '#c4a35a' },
    { status: 'COMPLETED',    label: 'Completed',   color: '#4a7c4a' },
    { status: 'CANCELLED',    label: 'Cancelled',   color: '#605850' },
]

export function TodosView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType } = useAppStore()

    const todos = entries
        .filter(e => e.type === 'todo' && !e.parent_uid)
        .sort((a, b) => {
            const pa = a.priority ?? 9
            const pb = b.priority ?? 9
            if (pa !== pb) return pa - pb
            return b.updated_at.localeCompare(a.updated_at)
        })

    const subtasks = entries.filter(e => e.type === 'todo' && e.parent_uid)

    if (todos.length === 0) {
        return (
            <Empty
                icon="✓"
                title="No tasks yet"
                subtitle="Tasks from jtx Board will appear here after syncing"
                onNew={() => setCreatingType('todo')}
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
                    Tasks
                    <span style={{
                        fontSize:   '14px',
                        fontFamily: 'var(--font-ui)',
                        color:      'var(--text-muted)',
                        marginLeft: '12px',
                        fontWeight: 300,
                    }}>
                        {todos.length}
                    </span>
                </h1>
                <NewButton onClick={() => setCreatingType('todo')} />
            </div>

            {STATUS_GROUPS.map(({ status, label, color }) => {
                const group = todos.filter(e => (e.status ?? 'NEEDS-ACTION') === status)
                if (group.length === 0) return null
                return (
                    <div key={status} style={{ marginBottom: '32px' }}>
                        {/* Group header */}
                        <div style={{
                            display:      'flex',
                            alignItems:   'center',
                            gap:          '8px',
                            marginBottom: '8px',
                        }}>
                            <div style={{
                                width:        '8px',
                                height:       '8px',
                                borderRadius: '50%',
                                background:   color,
                                flexShrink:   0,
                            }} />
                            <span style={{
                                fontSize:      '11px',
                                color:         color,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                fontWeight:    500,
                            }}>
                {label}
              </span>
                            <span style={{
                                fontSize: '11px',
                                color:    'var(--text-muted)',
                            }}>
                {group.length}
              </span>
                            <div style={{
                                flex:       1,
                                height:     '1px',
                                background: 'var(--border)',
                            }} />
                        </div>

                        {/* Todo rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {group.map(entry => (
                                <TodoRow
                                    key={entry.id}
                                    entry={entry}
                                    isSelected={selectedEntry?.id === entry.id}
                                    onClick={() => setSelectedEntry(
                                        selectedEntry?.id === entry.id ? null : entry
                                    )}
                                    subtasks={subtasks.filter(s => s.parent_uid === entry.id)}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function TodoRow({
                     entry, isSelected, onClick, subtasks
                 }: {
    entry:     Entry
    isSelected:boolean
    onClick:   () => void
    subtasks:  Entry[]
}) {
    const tags: string[] = (() => { try { return entry.categories ? JSON.parse(entry.categories) : [] } catch { return [] } })()
    const isDone  = entry.status === 'COMPLETED' || entry.status === 'CANCELLED'
    const dueDate = entry.due_date
        ? new Date(entry.due_date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        })
        : null
    const isOverdue = entry.due_date
        && new Date(entry.due_date) < new Date()
        && !isDone

    return (
        <div
            onClick={onClick}
            style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '12px',
                padding:      '10px 14px',
                borderRadius: 'var(--radius-md)',
                background:   isSelected ? 'var(--bg-active)' : 'transparent',
                borderLeft:   isSelected
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                cursor:       'pointer',
                transition:   'background 0.12s',
                opacity:      isDone ? 0.5 : 1,
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
            {/* Checkbox circle */}
            <div style={{
                width:        '16px',
                height:       '16px',
                minWidth:     '16px',
                borderRadius: '50%',
                border:       `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                background:   isDone ? 'var(--text-muted)' : 'transparent',
                marginTop:    '1px',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                fontSize:     '9px',
                color:        'var(--bg-base)',
            }}>
                {isDone && '✓'}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '8px',
                    marginBottom: subtasks.length > 0 || tags.length > 0 ? '4px' : 0,
                }}>
          <span style={{
              fontSize:        '14px',
              color:           'var(--text-primary)',
              fontWeight:      500,
              textDecoration:  isDone ? 'line-through' : 'none',
              flex:            1,
          }}
                className="truncate"
          >
            {entry.title || 'Untitled'}
          </span>

                    {/* Priority dot */}
                    {entry.priority && entry.priority <= 3 && !isDone && (
                        <div style={{
                            width:        '6px',
                            height:       '6px',
                            borderRadius: '50%',
                            background:   entry.priority === 1
                                ? '#c04040'
                                : entry.priority === 2
                                    ? '#c08040'
                                    : 'var(--accent)',
                            flexShrink:   0,
                        }} />
                    )}

                    {/* Due date */}
                    {dueDate && (
                        <span style={{
                            fontSize:  '11px',
                            color:     isOverdue ? '#e07070' : 'var(--text-muted)',
                            flexShrink: 0,
                        }}>
              {dueDate}
            </span>
                    )}
                </div>

                {/* Progress bar */}
                {(() => {
                    const pct = computeProgress(entry.status, subtasks)
                    return pct > 0 ? (
                        <div style={{
                            height:       '2px',
                            background:   'var(--border)',
                            borderRadius: '1px',
                            marginBottom: '6px',
                            overflow:     'hidden',
                        }}>
                            <div style={{
                                height:     '100%',
                                width:      `${pct}%`,
                                background: 'var(--accent)',
                                borderRadius: '1px',
                            }} />
                        </div>
                    ) : null
                })()}

                {/* Subtasks count + tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {subtasks.length > 0 && (
                        <span style={{
                            fontSize: '11px',
                            color:    'var(--text-muted)',
                        }}>
              {subtasks.filter(s => s.status === 'COMPLETED').length}/{subtasks.length} subtasks
            </span>
                    )}
                    {tags.slice(0, 3).map((tag: string) => (
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
                }}>+ New task</button>
            )}
        </div>
    )
}