import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../store/app'
import { EntryEditor } from './EntryEditor'
import type { Entry, AlarmObject } from '../../shared/types'

// ── Edit state ────────────────────────────────────────────────────────────────

interface EditState {
    title:          string
    body:           string
    status:         string
    classification: string
    color:          string
    start_date:     string
    due_date:       string
    completed_date: string
    priority:       string
    progress:       string
    rrule:          string
    exdate:         string   // comma-separated ISO dates
    categories:     string   // comma-separated tags
    location:       string
    url:            string
    comment:        string
    contact:        string
    geo_lat:        string
    geo_lon:        string
    duration:       string
    alarms:         AlarmObject[]
}

function toDatetimeLocal(iso: string): string {
    const d   = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function initEditState(entry: Entry): EditState {
    const geoParts = entry.geo?.split(';') ?? ['', '']
    const parsedAlarms: AlarmObject[] = (() => {
        try { return entry.alarms ? JSON.parse(entry.alarms) : [] }
        catch { return [] }
    })()
    const parsedExdates: string[] = (() => {
        try { return entry.exdate ? JSON.parse(entry.exdate) : [] }
        catch { return [] }
    })()
    const parsedCats: string[] = (() => {
        try { return entry.categories ? JSON.parse(entry.categories) : [] }
        catch { return [] }
    })()
    return {
        title:          entry.title          ?? '',
        body:           entry.body           ?? '',
        status:         entry.status         ?? '',
        classification: entry.classification ?? '',
        color:          entry.color?.startsWith('#') ? entry.color : '#c4a35a',
        start_date:     entry.start_date     ? toDatetimeLocal(entry.start_date)     : '',
        due_date:       entry.due_date       ? toDatetimeLocal(entry.due_date)       : '',
        completed_date: entry.completed_date ? toDatetimeLocal(entry.completed_date) : '',
        priority:       entry.priority != null ? String(entry.priority) : '0',
        progress:       entry.progress != null ? String(entry.progress) : '0',
        rrule:          entry.rrule          ?? '',
        exdate:         parsedExdates.join(', '),
        categories:     parsedCats.join(', '),
        location:       entry.location       ?? '',
        url:            entry.url            ?? '',
        comment:        entry.comment        ?? '',
        contact:        entry.contact        ?? '',
        geo_lat:        geoParts[0]          ?? '',
        geo_lon:        geoParts[1]          ?? '',
        duration:       entry.duration       ?? '',
        alarms:         parsedAlarms,
    }
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntryDetail() {
    const { selectedEntry, setSelectedEntry, entries, setEntries } = useAppStore()
    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState<EditState | null>(null)
    const [saving,    setSaving]    = useState(false)

    if (!selectedEntry) return null

    const subtasks = entries.filter(
        e => e.type === 'todo' && e.parent_uid === selectedEntry.id
    )

    const handleEdit = () => {
        setEditState(initEditState(selectedEntry))
        setIsEditing(true)
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEditState(null)
    }

    const set = (field: keyof EditState) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setEditState(prev => prev ? { ...prev, [field]: e.target.value } : prev)

    const handleSave = async () => {
        if (!editState) return
        setSaving(true)

        const categories = editState.categories.trim()
            ? JSON.stringify(editState.categories.split(',').map(t => t.trim()).filter(Boolean))
            : null
        const exdate = editState.exdate.trim()
            ? JSON.stringify(editState.exdate.split(',').map(d => d.trim()).filter(Boolean))
            : null
        const geo = (editState.geo_lat.trim() && editState.geo_lon.trim())
            ? `${editState.geo_lat.trim()};${editState.geo_lon.trim()}`
            : null
        const alarms = editState.alarms.length > 0
            ? JSON.stringify(editState.alarms)
            : null
        const priority = parseInt(editState.priority)
        const progress = parseInt(editState.progress)

        await window.api.entries.update(selectedEntry.id, {
            title:          editState.title          || null,
            body:           editState.body           || null,
            status:         editState.status         || null,
            classification: editState.classification || null,
            color:          editState.color          || null,
            start_date:     editState.start_date     ? new Date(editState.start_date).toISOString()     : null,
            due_date:       editState.due_date       ? new Date(editState.due_date).toISOString()       : null,
            completed_date: editState.completed_date ? new Date(editState.completed_date).toISOString() : null,
            priority:       isNaN(priority) || priority === 0 ? null : priority,
            progress:       isNaN(progress) ? null : progress,
            rrule:          editState.rrule    || null,
            exdate,
            categories,
            location:       editState.location || null,
            url:            editState.url      || null,
            comment:        editState.comment  || null,
            contact:        editState.contact  || null,
            geo,
            duration:       editState.duration || null,
            alarms,
        })

        const updated  = await window.api.entries.getAll()
        setEntries(updated)
        const refreshed = updated.find(e => e.id === selectedEntry.id)
        if (refreshed) setSelectedEntry(refreshed)
        setIsEditing(false)
        setEditState(null)
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
            {/* Color accent bar */}
            {selectedEntry.color && !isEditing && (
                <div style={{ height: '3px', background: selectedEntry.color, flexShrink: 0 }} />
            )}

            {/* Header */}
            <div style={{
                padding:      '14px 20px 12px',
                borderBottom: '1px solid var(--border)',
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '10px',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Type + status badges */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: '10px', color: 'var(--accent)',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                            {selectedEntry.type === 'journal' ? 'Journal'
                                : selectedEntry.type === 'note' ? 'Note' : 'Task'}
                        </span>
                        {!isEditing && selectedEntry.status && (
                            <StatusBadge status={selectedEntry.status} />
                        )}
                        {!isEditing && selectedEntry.classification && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {selectedEntry.classification}
                            </span>
                        )}
                    </div>

                    {isEditing && editState ? (
                        <input
                            value={editState.title}
                            onChange={set('title')}
                            placeholder="Title"
                            style={{ ...inputStyle, fontSize: '15px', fontFamily: 'var(--font-display)' }}
                        />
                    ) : (
                        <h2 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize:   '20px',
                            fontWeight: 400,
                            color:      'var(--text-primary)',
                            lineHeight: 1.3,
                            margin:     0,
                        }}>
                            {selectedEntry.title || 'Untitled'}
                        </h2>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {isEditing ? (
                        <>
                            <HeaderButton label={saving ? '…' : 'Save'} onClick={handleSave} accent />
                            <HeaderButton label="Cancel" onClick={handleCancel} />
                        </>
                    ) : (
                        <HeaderButton label="Edit" onClick={handleEdit} />
                    )}
                    <HeaderButton label="×" onClick={() => setSelectedEntry(null)} />
                </div>
            </div>

            {/* Body */}
            <div style={{
                flex:          1,
                overflowY:     'auto',
                padding:       '16px 20px',
                display:       'flex',
                flexDirection: 'column',
                gap:           '16px',
            }}>
                {isEditing && editState ? (
                    <EditForm
                        entry={selectedEntry}
                        state={editState}
                        onChange={next => setEditState(next)}
                        set={set}
                    />
                ) : (
                    <ViewMode entry={selectedEntry} subtasks={subtasks} />
                )}
            </div>
        </aside>
    )
}

// ── View mode ────────────────────────────────────────────────────────────────

function ViewMode({ entry, subtasks }: { entry: Entry; subtasks: Entry[] }) {
    const tags: string[] = (() => {
        try { return entry.categories ? JSON.parse(entry.categories) : [] }
        catch { return [] }
    })()
    const alarms: AlarmObject[] = (() => {
        try { return entry.alarms ? JSON.parse(entry.alarms) : [] }
        catch { return [] }
    })()
    const exdates: string[] = (() => {
        try { return entry.exdate ? JSON.parse(entry.exdate) : [] }
        catch { return [] }
    })()

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })

    const fmtDateTime = (iso: string) =>
        new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    return (
        <>
            {/* Dates */}
            {(entry.start_date || entry.due_date || entry.completed_date) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {entry.start_date && (
                        <div style={dateRowStyle}>
                            <span style={dateRowLabelStyle}>Date</span>
                            <span style={dateRowValueStyle}>{fmtDate(entry.start_date)}</span>
                        </div>
                    )}
                    {entry.due_date && (
                        <div style={dateRowStyle}>
                            <span style={dateRowLabelStyle}>Due</span>
                            <span style={{ ...dateRowValueStyle, color: isPast(entry.due_date) && entry.status !== 'COMPLETED' ? '#e07070' : 'var(--text-secondary)' }}>
                                {fmtDate(entry.due_date)}
                            </span>
                        </div>
                    )}
                    {entry.completed_date && (
                        <div style={dateRowStyle}>
                            <span style={dateRowLabelStyle}>Completed</span>
                            <span style={dateRowValueStyle}>{fmtDate(entry.completed_date)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Priority + Progress */}
            {entry.type === 'todo' && (entry.priority || entry.progress != null) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {entry.priority != null && entry.priority > 0 && (
                        <div style={dateRowStyle}>
                            <span style={dateRowLabelStyle}>Priority</span>
                            <span style={{ ...dateRowValueStyle, color: priorityColor(entry.priority), fontWeight: 500 }}>
                                {priorityLabel(entry.priority)}
                            </span>
                        </div>
                    )}
                    {entry.progress != null && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={dateRowLabelStyle}>Progress</span>
                                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>{entry.progress}%</span>
                            </div>
                            <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${entry.progress}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {tags.map(tag => <span key={tag} style={tagChipStyle}>{tag}</span>)}
                </div>
            )}

            {/* Body — the main content, shown prominently */}
            {entry.body && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div className="markdown-body" style={{
                        fontSize: '13px', color: 'var(--text-secondary)',
                        lineHeight: 1.8, wordBreak: 'break-word',
                    }}>
                        <ReactMarkdown>{entry.body}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Comment — highlighted box */}
            {entry.comment && (
                <div style={{
                    background:   'var(--bg-raised)',
                    borderLeft:   '3px solid var(--accent-dim)',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    padding:      '10px 14px',
                }}>
                    <SectionLabel>Comment</SectionLabel>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
                        {entry.comment}
                    </p>
                </div>
            )}

            {/* Details: location, url, contact, geo, duration */}
            {(entry.location || entry.url || entry.contact || entry.geo || entry.duration) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <SectionLabel>Details</SectionLabel>
                    {entry.location && (
                        <div style={detailRowStyle}>
                            <span style={detailIconStyle}>📍</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{entry.location}</span>
                        </div>
                    )}
                    {entry.url && (
                        <div style={detailRowStyle}>
                            <span style={detailIconStyle}>🔗</span>
                            <a href={entry.url} target="_blank" rel="noreferrer"
                                style={{ fontSize: '12px', color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}>
                                {entry.url}
                            </a>
                        </div>
                    )}
                    {entry.contact && (
                        <div style={detailRowStyle}>
                            <span style={detailIconStyle}>👤</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{entry.contact}</span>
                        </div>
                    )}
                    {entry.geo && (
                        <div style={detailRowStyle}>
                            <span style={detailIconStyle}>🗺</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {entry.geo.replace(';', ', ')}
                            </span>
                        </div>
                    )}
                    {entry.duration && (
                        <div style={detailRowStyle}>
                            <span style={detailIconStyle}>⏱</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{entry.duration}</span>
                        </div>
                    )}
                    {entry.color && (
                        <div style={detailRowStyle}>
                            <span style={{ ...detailIconStyle, display: 'flex', alignItems: 'center' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: entry.color, border: '1px solid var(--border)', display: 'inline-block' }} />
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entry.color}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Subtasks */}
            {subtasks.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <SectionLabel>
                        Subtasks · {subtasks.filter(s => s.status === 'COMPLETED').length}/{subtasks.length} done
                    </SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {subtasks.map(sub => <SubtaskRow key={sub.id} subtask={sub} />)}
                    </div>
                </div>
            )}

            {/* Recurrence */}
            {(entry.rrule || exdates.length > 0) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <SectionLabel>Recurrence</SectionLabel>
                    {entry.rrule && <code style={monoChipStyle}>{entry.rrule}</code>}
                    {exdates.length > 0 && (
                        <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Exceptions</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                {exdates.map(d => (
                                    <code key={d} style={monoChipStyle}>{new Date(d).toLocaleDateString()}</code>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Alarms */}
            {alarms.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <SectionLabel>Alarms</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {alarms.map((a, i) => (
                            <div key={i} style={{ ...monoChipStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span>🔔</span>
                                <span>{formatTrigger(a.trigger)}</span>
                                {a.description && <span style={{ color: 'var(--text-muted)' }}>· {a.description}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer: timestamps */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {entry.updated_at && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Updated {fmtDateTime(entry.updated_at)}
                    </span>
                )}
                {entry.created_at && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Created {fmtDateTime(entry.created_at)}
                    </span>
                )}
            </div>
        </>
    )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({
    entry, state, onChange, set,
}: {
    entry:    Entry
    state:    EditState
    onChange: (next: EditState) => void
    set:      (field: keyof EditState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}) {
    const isTodo    = entry.type === 'todo'
    const isJournal = entry.type === 'journal'

    const statusOptions = isTodo
        ? [['', 'No status'], ['NEEDS-ACTION', 'Needs Action'], ['IN-PROCESS', 'In Process'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']]
        : [['', 'No status'], ['DRAFT', 'Draft'], ['FINAL', 'Final'], ['CANCELLED', 'Cancelled']]

    const priorityOptions = [
        ['0', 'No priority'], ['1', 'High (1)'], ['2', 'High (2)'], ['3', 'High (3)'],
        ['4', 'Medium (4)'], ['5', 'Medium (5)'], ['6', 'Medium (6)'],
        ['7', 'Low (7)'], ['8', 'Low (8)'], ['9', 'Low (9)'],
    ]

    const addAlarm = () => onChange({
        ...state,
        alarms: [...state.alarms, { trigger: '-PT15M', action: 'DISPLAY', description: 'Reminder' }],
    })

    const removeAlarm = (i: number) => onChange({
        ...state,
        alarms: state.alarms.filter((_, idx) => idx !== i),
    })

    const updateAlarm = (i: number, field: keyof AlarmObject, value: string) => {
        const alarms = [...state.alarms]
        alarms[i] = { ...alarms[i], [field]: value }
        onChange({ ...state, alarms })
    }

    return (
        <>
            {/* Status / Classification / Color row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                <FormField label="Status">
                    <select value={state.status} onChange={set('status')} style={selectStyle}>
                        {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </FormField>
                <FormField label="Classification">
                    <select value={state.classification} onChange={set('classification')} style={selectStyle}>
                        <option value="">None</option>
                        <option value="PUBLIC">Public</option>
                        <option value="PRIVATE">Private</option>
                        <option value="CONFIDENTIAL">Confidential</option>
                    </select>
                </FormField>
                <FormField label="Color">
                    <input type="color" value={state.color} onChange={set('color')}
                        style={{ width: '36px', height: '30px', padding: '2px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', cursor: 'pointer' }}
                    />
                </FormField>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(isJournal || isTodo) && (
                    <FormField label="Start date">
                        <input type="datetime-local" value={state.start_date} onChange={set('start_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Due date">
                        <input type="datetime-local" value={state.due_date} onChange={set('due_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Completed date">
                        <input type="datetime-local" value={state.completed_date} onChange={set('completed_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Duration">
                        <input value={state.duration} onChange={set('duration')} placeholder="e.g. PT1H30M" style={inputStyle} />
                    </FormField>
                )}
            </div>

            {/* Priority + Progress (to-do only) */}
            {isTodo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'end' }}>
                    <FormField label="Priority">
                        <select value={state.priority} onChange={set('priority')} style={selectStyle}>
                            {priorityOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </FormField>
                    <FormField label={`Progress: ${state.progress}%`}>
                        <input type="range" min="0" max="100" value={state.progress}
                            onChange={set('progress')}
                            style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '6px' }}
                        />
                    </FormField>
                </div>
            )}

            {/* Body */}
            <FormField label="Notes">
                <div style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--accent-dim)',
                    borderRadius: 'var(--radius-md)', padding: '10px 12px', minHeight: '140px', display: 'flex', flexDirection: 'column',
                }}>
                    <EntryEditor content={state.body} onChange={body => onChange({ ...state, body })} />
                </div>
            </FormField>

            {/* Comment */}
            <FormField label="Comment">
                <textarea value={state.comment} onChange={set('comment')} rows={2}
                    placeholder="Short comment visible in list views"
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-ui)' }}
                />
            </FormField>

            {/* Categories */}
            <FormField label="Tags (comma-separated)">
                <input value={state.categories} onChange={set('categories')}
                    placeholder="work, personal, urgent" style={inputStyle} />
            </FormField>

            {/* Location / URL */}
            <FormField label="Location">
                <input value={state.location} onChange={set('location')} placeholder="Address or place name" style={inputStyle} />
            </FormField>
            <FormField label="URL">
                <input type="url" value={state.url} onChange={set('url')} placeholder="https://…" style={inputStyle} />
            </FormField>

            {/* Contact */}
            <FormField label="Contact">
                <input value={state.contact} onChange={set('contact')} placeholder="Name or email" style={inputStyle} />
            </FormField>

            {/* Geo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <FormField label="Latitude">
                    <input type="number" step="any" value={state.geo_lat} onChange={set('geo_lat')}
                        placeholder="37.386" style={inputStyle} />
                </FormField>
                <FormField label="Longitude">
                    <input type="number" step="any" value={state.geo_lon} onChange={set('geo_lon')}
                        placeholder="-122.083" style={inputStyle} />
                </FormField>
            </div>

            {/* RRULE */}
            <FormField label="Recurrence rule (RRULE)">
                <input value={state.rrule} onChange={set('rrule')}
                    placeholder="FREQ=WEEKLY;BYDAY=MO" style={inputStyle} />
            </FormField>

            {/* EXDATE */}
            <FormField label="Excluded dates (comma-separated ISO)">
                <input value={state.exdate} onChange={set('exdate')}
                    placeholder="2025-12-25T00:00:00.000Z, …" style={inputStyle} />
            </FormField>

            {/* Alarms */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={labelStyle}>Alarms</span>
                    <button onClick={addAlarm} style={addBtnStyle}>+ Add alarm</button>
                </div>
                {state.alarms.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No alarms</p>
                )}
                {state.alarms.map((alarm, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: '6px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'end',
                    }}>
                        <FormField label="Trigger">
                            <select value={alarm.trigger}
                                onChange={e => updateAlarm(i, 'trigger', e.target.value)}
                                style={selectStyle}>
                                <option value="-PT5M">5 min before</option>
                                <option value="-PT15M">15 min before</option>
                                <option value="-PT30M">30 min before</option>
                                <option value="-PT1H">1 hour before</option>
                                <option value="-PT2H">2 hours before</option>
                                <option value="-P1D">1 day before</option>
                                <option value="-P2D">2 days before</option>
                                <option value={alarm.trigger}>{alarm.trigger}</option>
                            </select>
                        </FormField>
                        <FormField label="Description">
                            <input value={alarm.description}
                                onChange={e => updateAlarm(i, 'description', e.target.value)}
                                placeholder="Reminder" style={inputStyle} />
                        </FormField>
                        <button onClick={() => removeAlarm(i)} style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            fontSize: '16px', padding: '0 4px', alignSelf: 'center',
                        }}>×</button>
                    </div>
                ))}
            </div>
        </>
    )
}

// ── View mode helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        'COMPLETED':    '#70c070',
        'CANCELLED':    '#a07070',
        'IN-PROCESS':   'var(--accent)',
        'NEEDS-ACTION': 'var(--text-muted)',
        'DRAFT':        'var(--text-muted)',
        'FINAL':        '#70c070',
    }
    return (
        <span style={{
            fontSize:      '9px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color:         colors[status] ?? 'var(--text-muted)',
            border:        `1px solid ${colors[status] ?? 'var(--border)'}`,
            borderRadius:  '3px',
            padding:       '1px 5px',
        }}>
            {status.replace('-', ' ')}
        </span>
    )
}

function priorityLabel(p: number): string {
    return p <= 3 ? 'High priority' : p <= 6 ? 'Medium priority' : 'Low priority'
}

function priorityColor(p: number): string {
    return p <= 3 ? '#e07070' : p <= 6 ? 'var(--accent)' : '#70c070'
}

function isPast(iso: string): boolean {
    return new Date(iso) < new Date()
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function HeaderButton({ label, onClick, accent = false }: { label: string; onClick: () => void; accent?: boolean }) {
    return (
        <button onClick={onClick} style={{
            background:   accent ? 'rgba(196,163,90,0.15)' : 'transparent',
            border:       accent ? '1px solid var(--accent-dim)' : 'none',
            borderRadius: 'var(--radius-sm)',
            color:        accent ? 'var(--accent)' : 'var(--text-muted)',
            fontSize:     label === '×' ? '18px' : '12px',
            fontFamily:   'var(--font-ui)',
            padding:      '3px 8px',
            cursor:       'pointer',
            lineHeight:   1,
        }}>{label}</button>
    )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div style={labelStyle}>{label}</div>
            {children}
        </div>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {children}
        </div>
    )
}

function SubtaskRow({ subtask }: { subtask: Entry }) {
    const isDone = subtask.status === 'COMPLETED' || subtask.status === 'CANCELLED'
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)' }}>
            <div style={{
                width: '13px', height: '13px', minWidth: '13px', borderRadius: '50%',
                border: `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                background: isDone ? 'var(--text-muted)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '7px', color: 'var(--bg-base)',
            }}>{isDone && '✓'}</div>
            <span className="truncate" style={{
                fontSize: '12px', flex: 1,
                color: isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                textDecoration: isDone ? 'line-through' : 'none',
            }}>{subtask.title || 'Untitled'}</span>
        </div>
    )
}

function formatTrigger(trigger: string): string {
    const map: Record<string, string> = {
        '-PT5M': '5 min before', '-PT15M': '15 min before', '-PT30M': '30 min before',
        '-PT1H': '1 hr before', '-PT2H': '2 hrs before', '-P1D': '1 day before', '-P2D': '2 days before',
    }
    return map[trigger] ?? trigger
}

// ── Style constants ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width:        '100%',
    boxSizing:    'border-box',
    background:   'var(--bg-raised)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color:        'var(--text-primary)',
    fontFamily:   'var(--font-ui)',
    fontSize:     '12px',
    padding:      '5px 8px',
    outline:      'none',
}

const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
    fontSize:      '10px',
    color:         'var(--text-muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom:  '4px',
}

const tagChipStyle: React.CSSProperties = {
    fontSize:     '11px',
    color:        'var(--accent)',
    background:   'var(--accent-glow)',
    border:       '1px solid var(--accent-dim)',
    borderRadius: 'var(--radius-sm)',
    padding:      '2px 7px',
}

const monoChipStyle: React.CSSProperties = {
    display:      'block',
    fontSize:     '11px',
    color:        'var(--text-muted)',
    background:   'var(--bg-raised)',
    borderRadius: 'var(--radius-sm)',
    padding:      '4px 8px',
    fontFamily:   'monospace',
}

const addBtnStyle: React.CSSProperties = {
    background:   'transparent',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color:        'var(--text-muted)',
    fontSize:     '11px',
    fontFamily:   'var(--font-ui)',
    padding:      '2px 8px',
    cursor:       'pointer',
}

const dateRowStyle: React.CSSProperties = {
    display:     'flex',
    alignItems:  'baseline',
    gap:         '10px',
}

const dateRowLabelStyle: React.CSSProperties = {
    fontSize:      '10px',
    color:         'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    minWidth:      '62px',
    flexShrink:    0,
}

const dateRowValueStyle: React.CSSProperties = {
    fontSize: '12px',
    color:    'var(--text-secondary)',
}

const detailRowStyle: React.CSSProperties = {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        '8px',
}

const detailIconStyle: React.CSSProperties = {
    fontSize:  '13px',
    flexShrink: 0,
    width:     '18px',
    textAlign: 'center',
}
