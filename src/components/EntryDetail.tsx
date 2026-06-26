import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../store/app'
import { EntryEditor } from './EntryEditor'
import type { Entry, AlarmObject } from '../../shared/types'

// ── Entry defaults (persisted across sessions) ────────────────────────────────

const ENTRY_DEFAULTS_KEY = 'jtx_entry_defaults'

interface EntryDefaults {
    collection:     string
    classification: string
    status:         Partial<Record<'journal' | 'note' | 'todo', string>>
}

function loadEntryDefaults(): EntryDefaults | null {
    try {
        const raw = localStorage.getItem(ENTRY_DEFAULTS_KEY)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function saveEntryDefaults(next: EntryDefaults): void {
    try {
        localStorage.setItem(ENTRY_DEFAULTS_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
}

// ── Progress computation ──────────────────────────────────────────────────────

const STATUS_PROGRESS: Record<string, number> = {
    'NEEDS-ACTION': 0,
    'IN-PROCESS':   50,
    'COMPLETED':    100,
    'CANCELLED':    100,
}

function computeProgress(status: string | null, subtasks: Entry[]): number {
    if (subtasks.length > 0) {
        const sum = subtasks.reduce((acc, s) => {
            // Use stored progress for intermediate nodes; fall back to status mapping for leaves
            const p = s.progress !== null && s.progress !== undefined
                ? s.progress
                : (STATUS_PROGRESS[s.status ?? ''] ?? 0)
            return acc + p
        }, 0)
        return Math.round(sum / subtasks.length)
    }
    return STATUS_PROGRESS[status ?? ''] ?? 0
}

function progressToStatus(progress: number): string {
    if (progress >= 100) return 'COMPLETED'
    if (progress > 0)    return 'IN-PROCESS'
    return 'NEEDS-ACTION'
}

// Recomputes progress+status for entryId from its direct children, persists to DB,
// then recurses up to entryId's parent until the root is reached.
async function cascadeProgressFrom(entryId: string, allEntries: Entry[]): Promise<void> {
    const entry    = allEntries.find(e => e.id === entryId)
    if (!entry) return

    const children = allEntries.filter(e => e.parent_uid === entryId && !e.deleted)
    if (children.length === 0) return  // leaf — do not auto-derive status

    const progress = Math.round(
        children.reduce((acc, s) => {
            const p = s.progress !== null && s.progress !== undefined
                ? s.progress
                : (STATUS_PROGRESS[s.status ?? ''] ?? 0)
            return acc + p
        }, 0) / children.length
    )
    const status = progressToStatus(progress)
    await window.api.entries.update(entryId, { progress, status })

    if (entry.parent_uid) {
        const updated = allEntries.map(e =>
            e.id === entryId ? { ...e, progress, status } : e
        )
        await cascadeProgressFrom(entry.parent_uid, updated)
    }
}

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
        color:          entry.color ?? '#c4a35a',
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

function initBlankEditState(
    type:      'journal' | 'note' | 'todo',
    defaults?: EntryDefaults,
    location?: DeviceLocation | null
): EditState {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    return {
        title:          '',
        body:           '',
        status:         defaults?.status?.[type] ?? (type === 'todo' ? 'NEEDS-ACTION' : ''),
        classification: defaults?.classification ?? '',
        color:          '#c4a35a',
        start_date:     type === 'journal' ? localNow : '',
        due_date:       '',
        completed_date: '',
        priority:       '0',
        progress:       '0',
        rrule:          '',
        exdate:         '',
        categories:     '',
        location:       location?.name ?? '',
        url:            '',
        comment:        '',
        contact:        '',
        geo_lat:        location?.lat  ?? '',
        geo_lon:        location?.lon  ?? '',
        duration:       '',
        alarms:         [],
    }
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntryDetail() {
    const {
        selectedEntry, setSelectedEntry,
        entries, setEntries,
        creatingType, setCreatingType,
        creatingParentUid, setCreatingParentUid,
        creatingParentCollection, setCreatingParentCollection,
        deviceLocation,
    } = useAppStore()

    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState<EditState | null>(null)
    const [saving,    setSaving]    = useState(false)
    const [collections, setCollections] = useState<{ url: string; display_name: string | null }[]>([])
    const [selectedCollection, setSelectedCollection] = useState('')

    const isCreating = creatingType !== null && selectedEntry === null

    // Initialize blank form when entering create mode
    useEffect(() => {
        if (isCreating && creatingType) {
            const defaults = loadEntryDefaults()
            setEditState(initBlankEditState(creatingType, defaults ?? undefined, deviceLocation))

            window.api.collections.getAll().then(cols => {
                const typed = cols as { url: string; display_name: string | null }[]
                setCollections(typed)
                if (creatingParentCollection) {
                    // Subtasks must live in the same collection as their parent.
                    setSelectedCollection(creatingParentCollection)
                } else {
                    const match = defaults?.collection
                        ? typed.find(c => c.url === defaults.collection)
                        : null
                    setSelectedCollection(match?.url ?? typed[0]?.url ?? '')
                }
            })
        }
    }, [isCreating, creatingType]) // eslint-disable-line react-hooks/exhaustive-deps

    // Fill location fields if device location arrives after the form is already open
    useEffect(() => {
        if (!isCreating || !deviceLocation) return
        setEditState(prev => {
            if (!prev || prev.geo_lat) return prev
            return {
                ...prev,
                geo_lat:  deviceLocation.lat,
                geo_lon:  deviceLocation.lon,
                location: deviceLocation.name ?? '',
            }
        })
    }, [isCreating, deviceLocation])

    if (!selectedEntry && !isCreating) return null

    const subtasks = selectedEntry
        ? entries.filter(e => e.type === 'todo' && e.parent_uid === selectedEntry.id)
        : []

    const handleEdit = () => {
        if (!selectedEntry) return
        setEditState(initEditState(selectedEntry))
        setIsEditing(true)
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEditState(null)
    }

    const handleDelete = async () => {
        if (!selectedEntry) return
        if (!window.confirm(`Delete "${selectedEntry.title || 'Untitled'}"? This will be removed from Nextcloud on the next sync.`)) return
        const parentUid = selectedEntry.parent_uid
        const entryType = selectedEntry.type
        await window.api.entries.delete(selectedEntry.id)
        if (parentUid && entryType === 'todo') {
            const allLatest = await window.api.entries.getAll()
            await cascadeProgressFrom(parentUid, allLatest)
            setEntries(await window.api.entries.getAll())
        } else {
            setEntries(entries.filter(e => e.id !== selectedEntry.id))
        }
        setSelectedEntry(null)
    }

    const handleToggleSubtask = async (sub: Entry) => {
        const newStatus = (sub.status === 'COMPLETED' || sub.status === 'CANCELLED')
            ? 'NEEDS-ACTION'
            : 'COMPLETED'
        await window.api.entries.update(sub.id, {
            status:   newStatus,
            progress: STATUS_PROGRESS[newStatus],
        })
        if (sub.parent_uid) {
            const allLatest = await window.api.entries.getAll()
            await cascadeProgressFrom(sub.parent_uid, allLatest)
        }
        const allFinal = await window.api.entries.getAll()
        setEntries(allFinal)
        const refreshed = allFinal.find(e => e.id === selectedEntry?.id)
        if (refreshed) setSelectedEntry(refreshed)
    }

    const handleAddSubtask = () => {
        if (!selectedEntry) return
        setCreatingParentUid(selectedEntry.id)
        setCreatingParentCollection(selectedEntry.collection)
        setCreatingType('todo')
    }

    const handleClose = () => {
        if (isCreating) {
            setCreatingType(null)
            setCreatingParentUid(null)
            setCreatingParentCollection(null)
            setEditState(null)
        } else {
            setSelectedEntry(null)
        }
    }

    const set = (field: keyof EditState) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setEditState(prev => prev ? { ...prev, [field]: e.target.value } : prev)

    const assembleFields = (state: EditState) => {
        const categories = state.categories.trim()
            ? JSON.stringify(state.categories.split(',').map(t => t.trim()).filter(Boolean))
            : null
        const exdate = state.exdate.trim()
            ? JSON.stringify(state.exdate.split(',').map(d => d.trim()).filter(Boolean))
            : null
        const geo = (state.geo_lat.trim() && state.geo_lon.trim())
            ? `${state.geo_lat.trim()};${state.geo_lon.trim()}`
            : null
        const alarms = state.alarms.length > 0 ? JSON.stringify(state.alarms) : null
        const priority = parseInt(state.priority)
        const progress = parseInt(state.progress)
        return {
            title:          state.title          || null,
            body:           state.body           || null,
            status:         state.status         || null,
            classification: state.classification || null,
            color:          state.color          || null,
            start_date:     state.start_date     ? new Date(state.start_date).toISOString()     : null,
            due_date:       state.due_date       ? new Date(state.due_date).toISOString()       : null,
            completed_date: state.completed_date ? new Date(state.completed_date).toISOString() : null,
            priority:       isNaN(priority) || priority === 0 ? null : priority,
            progress:       isNaN(progress) ? null : progress,
            rrule:          state.rrule    || null,
            exdate,
            categories,
            location:       state.location || null,
            url:            state.url      || null,
            comment:        state.comment  || null,
            contact:        state.contact  || null,
            geo,
            duration:       state.duration || null,
            alarms,
        }
    }

    const handleSave = async () => {
        if (!editState || !selectedEntry) return
        setSaving(true)
        const fields: Record<string, unknown> = { ...assembleFields(editState) }
        if (selectedEntry.type === 'todo') {
            const mySubtasks = entries.filter(e => e.parent_uid === selectedEntry.id && !e.deleted)
            if (mySubtasks.length > 0) {
                // Non-leaf: status and progress are derived from children, not the form
                const p = computeProgress(null, mySubtasks)
                fields.progress = p
                fields.status   = progressToStatus(p)
            } else {
                fields.progress = STATUS_PROGRESS[editState.status ?? ''] ?? 0
            }
        }
        await window.api.entries.update(selectedEntry.id, fields)
        if (selectedEntry.parent_uid && selectedEntry.type === 'todo') {
            const allLatest = await window.api.entries.getAll()
            await cascadeProgressFrom(selectedEntry.parent_uid, allLatest)
        }
        const updated  = await window.api.entries.getAll()
        setEntries(updated)
        const refreshed = updated.find(e => e.id === selectedEntry.id)
        if (refreshed) setSelectedEntry(refreshed)
        setIsEditing(false)
        setEditState(null)
        setSaving(false)
    }

    const handleCreate = async () => {
        if (!editState || !creatingType || !selectedCollection) return
        setSaving(true)
        try {
            // Don't override the collection default when creating a subtask —
            // the collection is locked to the parent's collection in that case.
            if (!creatingParentUid) {
                const prev = loadEntryDefaults()
                saveEntryDefaults({
                    collection:     selectedCollection,
                    classification: editState.classification,
                    status:         { ...prev?.status, [creatingType]: editState.status },
                })
            }

            const subProgress = creatingType === 'todo'
                ? computeProgress(editState.status || null, [])
                : undefined
            const { id } = await window.api.entries.create({
                type:       creatingType,
                collection: selectedCollection,
                parent_uid: creatingParentUid ?? undefined,
                ...assembleFields(editState),
                ...(subProgress !== undefined && { progress: subProgress }),
            })
            // Cascade from parent up the full ancestor chain.
            // entries:update sets dirty=1 + increments sequence, so no separate touch needed.
            if (creatingParentUid) {
                const allLatest = await window.api.entries.getAll()
                await cascadeProgressFrom(creatingParentUid, allLatest)
            }
            const allFinal = await window.api.entries.getAll()
            setEntries(allFinal)
            const fresh = allFinal.find(e => e.id === id) ?? null
            setCreatingParentUid(null)
            setCreatingParentCollection(null)
            setSelectedEntry(fresh)
            setEditState(null)
        } finally {
            setSaving(false)
        }
    }

    const currentType = isCreating ? creatingType! : selectedEntry!.type

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
            {selectedEntry?.color && !isEditing && (
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
                    {/* Type label + status badges */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: '10px', color: 'var(--accent)',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                            {isCreating
                                ? `New ${currentType === 'journal' ? 'Journal' : currentType === 'note' ? 'Note' : 'Task'}`
                                : currentType === 'journal' ? 'Journal' : currentType === 'note' ? 'Note' : 'Task'}
                        </span>
                        {!isEditing && !isCreating && selectedEntry?.status && (
                            <StatusBadge status={selectedEntry.status} />
                        )}
                        {!isEditing && !isCreating && selectedEntry?.classification && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {selectedEntry.classification}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    {(isEditing || isCreating) && editState ? (
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
                            {selectedEntry?.title || 'Untitled'}
                        </h2>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {isCreating ? (
                        <>
                            <HeaderButton label={saving ? '…' : 'Create'} onClick={handleCreate} accent disabled={!selectedCollection || saving} />
                            <HeaderButton label="Cancel" onClick={handleClose} />
                        </>
                    ) : isEditing ? (
                        <>
                            <HeaderButton label={saving ? '…' : 'Save'} onClick={handleSave} accent />
                            <HeaderButton label="Cancel" onClick={handleCancel} />
                        </>
                    ) : (
                        <>
                            <HeaderButton label="Edit" onClick={handleEdit} />
                            <HeaderButton label="Delete" onClick={handleDelete} danger />
                        </>
                    )}
                    <HeaderButton label="×" onClick={handleClose} />
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
                {isCreating && editState ? (
                    <>
                        {/* Collection picker — hidden for subtasks (locked to parent's collection) */}
                        {!creatingParentCollection && (collections.length > 0 ? (
                            <FormField label="Collection">
                                <select
                                    value={selectedCollection}
                                    onChange={e => setSelectedCollection(e.target.value)}
                                    style={selectStyle}
                                >
                                    {collections.map(c => (
                                        <option key={c.url} value={c.url}>
                                            {c.display_name || c.url}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                No collections found — sync with Nextcloud first (Settings) to create a collection.
                            </p>
                        ))}
                        <EditForm
                            type={currentType}
                            state={editState}
                            onChange={next => setEditState(next)}
                            set={set}
                            hasSubtasks={subtasks.length > 0}
                        />
                    </>
                ) : isEditing && editState ? (
                    <EditForm
                        type={currentType}
                        state={editState}
                        onChange={next => setEditState(next)}
                        set={set}
                    />
                ) : selectedEntry ? (
                    <ViewMode
                        entry={selectedEntry}
                        subtasks={subtasks}
                        onAddSubtask={handleAddSubtask}
                        onSelectSubtask={setSelectedEntry}
                        onToggleSubtask={handleToggleSubtask}
                    />
                ) : null}
            </div>
        </aside>
    )
}

// ── View mode ────────────────────────────────────────────────────────────────

function ViewMode({ entry, subtasks, onAddSubtask, onSelectSubtask, onToggleSubtask }: {
    entry:             Entry
    subtasks:          Entry[]
    onAddSubtask:      () => void
    onSelectSubtask:   (sub: Entry) => void
    onToggleSubtask:   (sub: Entry) => void
}) {
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
            {entry.type === 'todo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {entry.priority != null && entry.priority > 0 && (
                        <div style={dateRowStyle}>
                            <span style={dateRowLabelStyle}>Priority</span>
                            <span style={{ ...dateRowValueStyle, color: priorityColor(entry.priority), fontWeight: 500 }}>
                                {priorityLabel(entry.priority)}
                            </span>
                        </div>
                    )}
                    {(() => {
                        const pct = computeProgress(entry.status, subtasks)
                        return (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={dateRowLabelStyle}>Progress</span>
                                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>{pct}%</span>
                                </div>
                                <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {tags.map(tag => <span key={tag} style={tagChipStyle}>{tag}</span>)}
                </div>
            )}

            {/* Body */}
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

            {/* Comment */}
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

            {/* Details */}
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
            {entry.type === 'todo' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <SectionLabel>
                        {'Subtasks'}
                        {subtasks.length > 0 && ` · ${subtasks.filter(s => s.status === 'COMPLETED').length}/${subtasks.length} done`}
                    </SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {subtasks.map(sub => (
                            <SubtaskRow
                                key={sub.id}
                                subtask={sub}
                                onClick={() => onSelectSubtask(sub)}
                                onToggle={() => onToggleSubtask(sub)}
                            />
                        ))}
                    </div>
                    <button onClick={onAddSubtask} style={addSubtaskButtonStyle}>
                        + Add subtask
                    </button>
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
    type, state, onChange, set, hasSubtasks = false,
}: {
    type:        'journal' | 'note' | 'todo'
    state:        EditState
    onChange:    (next: EditState) => void
    set:         (field: keyof EditState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    hasSubtasks?: boolean
}) {
    const isTodo    = type === 'todo'
    const isJournal = type === 'journal'

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
            <div style={{ display: 'grid', gridTemplateColumns: `${isTodo && hasSubtasks ? '' : '1fr '}1fr auto`, gap: '8px', alignItems: 'end' }}>
                {!(isTodo && hasSubtasks) && (
                    <FormField label="Status">
                        <select value={state.status} onChange={set('status')} style={selectStyle}>
                            {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </FormField>
                )}
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

            {/* Priority (to-do only) */}
            {isTodo && (
                <FormField label="Priority">
                    <select value={state.priority} onChange={set('priority')} style={selectStyle}>
                        {priorityOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </FormField>
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

function HeaderButton({ label, onClick, accent = false, danger = false, disabled = false }: { label: string; onClick: () => void; accent?: boolean; danger?: boolean; disabled?: boolean }) {
    return (
        <button onClick={onClick} disabled={disabled} style={{
            background:   accent ? 'rgba(196,163,90,0.15)' : 'transparent',
            border:       accent ? '1px solid var(--accent-dim)' : 'none',
            borderRadius: 'var(--radius-sm)',
            color:        accent ? 'var(--accent)' : danger ? '#e07070' : 'var(--text-muted)',
            fontSize:     label === '×' ? '18px' : '12px',
            fontFamily:   'var(--font-ui)',
            padding:      '3px 8px',
            cursor:       disabled ? 'not-allowed' : 'pointer',
            lineHeight:   1,
            opacity:      disabled ? 0.4 : 1,
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

function SubtaskRow({ subtask, onClick, onToggle }: { subtask: Entry; onClick: () => void; onToggle: () => void }) {
    const isDone = subtask.status === 'COMPLETED' || subtask.status === 'CANCELLED'
    return (
        <div
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-raised)' }}
        >
            <div
                onClick={e => { e.stopPropagation(); onToggle() }}
                style={{
                    width: '13px', height: '13px', minWidth: '13px', borderRadius: '50%',
                    border: `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                    background: isDone ? 'var(--text-muted)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', color: 'var(--bg-base)', cursor: 'pointer',
                }}
            >{isDone && '✓'}</div>
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

const addSubtaskButtonStyle: React.CSSProperties = {
    marginTop:  '6px',
    background: 'none',
    border:     'none',
    color:      'var(--text-muted)',
    fontSize:   '11px',
    cursor:     'pointer',
    padding:    '3px 0',
    textAlign:  'left',
}

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
