import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../store/app'
import { EntryEditor } from './EntryEditor'
import type { Entry } from '../../shared/types'

export function EntryDetail() {
    const { selectedEntry, setSelectedEntry, entries, setEntries } = useAppStore()
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState('')
    const [editBody,  setEditBody]  = useState('')
    const [saving,    setSaving]    = useState(false)

    if (!selectedEntry) return null

    const subtasks = entries.filter(
        e => e.type === 'todo' && e.parent_uid === selectedEntry.id
    )
    const tags = selectedEntry.categories
        ? JSON.parse(selectedEntry.categories) as string[]
        : []

    const handleEdit = () => {
        setEditTitle(selectedEntry.title ?? '')
        setEditBody(selectedEntry.body   ?? '')
        setIsEditing(true)
    }

    const handleCancel = () => {
        setIsEditing(false)
    }

    const handleSave = async () => {
        setSaving(true)
        await window.api.entries.update(selectedEntry.id, {
            title: editTitle,
            body:  editBody,
        })
        // Refresh entries in store
        const updated = await window.api.entries.getAll()
        setEntries(updated)
        // Update selected entry to reflect changes
        const refreshed = updated.find(e => e.id === selectedEntry.id)
        if (refreshed) setSelectedEntry(refreshed)
        setIsEditing(false)
        setSaving(false)
    }

    return (
        <aside style={{
            width:         'var(--detail-width)',
            minWidth:      'var(--detail-width)',
            background:    'var(--bg-surface)',
            borderLeft:    '1px solid var(--border)',
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding:      '20px 24px 16px',
                borderBottom: '1px solid var(--border)',
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '12px',
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

                    {/* Title — editable or display */}
                    {isEditing ? (
                        <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            style={{
                                width:        '100%',
                                background:   'var(--bg-raised)',
                                border:       '1px solid var(--accent-dim)',
                                borderRadius: 'var(--radius-md)',
                                color:        'var(--text-primary)',
                                fontFamily:   'var(--font-display)',
                                fontSize:     '18px',
                                fontWeight:   400,
                                padding:      '6px 10px',
                                outline:      'none',
                            }}
                            placeholder="Title"
                        />
                    ) : (
                        <h2 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize:   '20px',
                            fontWeight: 400,
                            color:      'var(--text-primary)',
                            lineHeight: 1.3,
                        }}>
                            {selectedEntry.title || 'Untitled'}
                        </h2>
                    )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {isEditing ? (
                        <>
                            <HeaderButton
                                label={saving ? '…' : 'Save'}
                                onClick={handleSave}
                                accent
                            />
                            <HeaderButton label="Cancel" onClick={handleCancel} />
                        </>
                    ) : (
                        <HeaderButton label="Edit" onClick={handleEdit} />
                    )}
                    <HeaderButton label="×" onClick={() => setSelectedEntry(null)} />
                </div>
            </div>

            {/* Scrollable body */}
            <div style={{
                flex:          1,
                overflowY:     'auto',
                padding:       '20px 24px',
                display:       'flex',
                flexDirection: 'column',
                gap:           '20px',
            }}>
                {/* Metadata */}
                {!isEditing && <MetaGrid entry={selectedEntry} />}

                {/* Tags */}
                {tags.length > 0 && !isEditing && (
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

                {/* Progress bar */}
                {selectedEntry.type === 'todo' && selectedEntry.progress != null && !isEditing && (
                    <div>
                        <div style={{
                            display:        'flex',
                            justifyContent: 'space-between',
                            fontSize:       '11px',
                            color:          'var(--text-muted)',
                            marginBottom:   '6px',
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
                            }} />
                        </div>
                    </div>
                )}

                {/* Body — editor or rendered markdown */}
                <div>
                    {!isEditing && <SectionLabel>Notes</SectionLabel>}
                    {isEditing ? (
                        <div style={{
                            background:   'var(--bg-raised)',
                            border:       '1px solid var(--accent-dim)',
                            borderRadius: 'var(--radius-md)',
                            padding:      '12px 14px',
                            minHeight:    '200px',
                            display:      'flex',
                            flexDirection:'column',
                        }}>
                            <EntryEditor
                                content={editBody}
                                onChange={setEditBody}
                            />
                        </div>
                    ) : (
                        selectedEntry.body && (
                            <div
                                className="markdown-body"
                                style={{
                                    fontSize:  '13px',
                                    color:     'var(--text-secondary)',
                                    lineHeight: 1.7,
                                    wordBreak: 'break-word',
                                }}
                            >
                                <ReactMarkdown>{selectedEntry.body}</ReactMarkdown>
                            </div>
                        )
                    )}
                </div>

                {/* Subtasks */}
                {subtasks.length > 0 && !isEditing && (
                    <div>
                        <SectionLabel>
                            Subtasks ({subtasks.filter(s => s.status === 'COMPLETED').length}/{subtasks.length})
                        </SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {subtasks.map(sub => (
                                <SubtaskRow key={sub.id} subtask={sub} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recurrence */}
                {selectedEntry.rrule && !isEditing && (
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

function HeaderButton({
                          label, onClick, accent = false
                      }: {
    label:   string
    onClick: () => void
    accent?: boolean
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background:   accent ? 'rgba(196,163,90,0.15)' : 'transparent',
                border:       accent ? '1px solid var(--accent-dim)' : 'none',
                borderRadius: 'var(--radius-sm)',
                color:        accent ? 'var(--accent)' : 'var(--text-muted)',
                fontSize:     label === '×' ? '18px' : '12px',
                fontFamily:   'var(--font-ui)',
                padding:      '3px 8px',
                cursor:       'pointer',
                lineHeight:   1,
            }}
        >
            {label}
        </button>
    )
}

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
            display:     'flex',
            alignItems:  'center',
            gap:         '10px',
            padding:     '6px 10px',
            borderRadius:'var(--radius-sm)',
            background:  'var(--bg-raised)',
        }}>
            <div style={{
                width:          '14px',
                height:         '14px',
                minWidth:       '14px',
                borderRadius:   '50%',
                border:         `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                background:     isDone ? 'var(--text-muted)' : 'transparent',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '8px',
                color:          'var(--bg-base)',
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