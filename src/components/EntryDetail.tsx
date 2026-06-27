import { useState, useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { MapPin, Link, User, Map, Timer, Bell } from 'lucide-react'
import {DeviceLocation, useAppStore} from '../store/app'
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
            e.id === entryId ? ({ ...e, progress, status } as Entry) : e
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
        color:          entry.color ?? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
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
        color:          getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
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
    const [confirmingDelete, setConfirmingDelete] = useState(false)
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

    const handleDeleteConfirmed = async () => {
        if (!selectedEntry) return
        setConfirmingDelete(false)
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
        // Non-leaf nodes have cascade-derived status — toggling them directly would
        // create inconsistency with their children's statuses.
        if (entries.some(e => e.parent_uid === sub.id)) return

        const isDone    = sub.status === 'COMPLETED' || sub.status === 'CANCELLED'
            || (sub.progress ?? 0) >= 100
        const newStatus = isDone ? 'NEEDS-ACTION' : 'COMPLETED'
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
                    ) : selectedEntry?.title ? (
                        <h2 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize:   '20px',
                            fontWeight: 400,
                            color:      'var(--text-primary)',
                            lineHeight: 1.3,
                            margin:     0,
                        }}>
                            {selectedEntry.title}
                        </h2>
                    ) : null}
                </div>

                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {isCreating ? (
                        <>
                            <HeaderButton label={saving ? '…' : 'Create'} minWidth="48px" onClick={handleCreate} accent disabled={!selectedCollection || saving} ariaLabel="Create entry" />
                            <HeaderButton label="Cancel" onClick={handleClose} ariaLabel="Discard changes" />
                        </>
                    ) : isEditing ? (
                        <>
                            <HeaderButton label={saving ? '…' : 'Save'} minWidth="40px" onClick={handleSave} accent ariaLabel="Save changes" />
                            <HeaderButton label="Cancel" onClick={handleCancel} ariaLabel="Discard changes" />
                        </>
                    ) : (
                        <>
                            <HeaderButton label="Edit" onClick={handleEdit} ariaLabel="Edit entry" />
                            <HeaderButton label="Delete" onClick={() => setConfirmingDelete(true)} danger ariaLabel="Delete entry" />
                        </>
                    )}
                    <HeaderButton label="×" onClick={handleClose} ariaLabel="Close" />
                </div>
            </div>

            {/* Delete confirmation banner */}
            {confirmingDelete && selectedEntry && (
                <div style={{
                    padding:      '10px 20px',
                    background:   'rgba(192, 64, 64, 0.1)',
                    borderBottom: '1px solid rgba(192, 64, 64, 0.3)',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '10px',
                    flexShrink:   0,
                }}>
                    <span style={{ flex: 1, fontSize: '12px', color: '#e07070' }}>
                        Delete "{selectedEntry.title || 'Untitled'}"? This cannot be undone.
                    </span>
                    <button onClick={handleDeleteConfirmed} style={{ background: 'rgba(192,64,64,0.2)', border: '1px solid rgba(192,64,64,0.5)', borderRadius: 'var(--radius-sm)', color: '#e07070', fontSize: '12px', fontFamily: 'var(--font-ui)', padding: '3px 10px', cursor: 'pointer' }}>
                        Delete
                    </button>
                    <button onClick={() => setConfirmingDelete(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-ui)', padding: '3px 8px', cursor: 'pointer' }}>
                        Cancel
                    </button>
                </div>
            )}

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
                        allEntries={entries}
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

function ViewMode({ entry, subtasks, allEntries, onAddSubtask, onSelectSubtask, onToggleSubtask }: {
    entry:             Entry
    subtasks:          Entry[]
    allEntries:        Entry[]
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
                                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress" style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
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
                            <MapPin size={13} style={detailIconStyle} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{entry.location}</span>
                        </div>
                    )}
                    {entry.url && (
                        <div style={detailRowStyle}>
                            <Link size={13} style={detailIconStyle} />
                            <a href={entry.url} target="_blank" rel="noreferrer"
                                style={{ fontSize: '12px', color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}>
                                {entry.url}
                            </a>
                        </div>
                    )}
                    {entry.contact && (
                        <div style={detailRowStyle}>
                            <User size={13} style={detailIconStyle} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{entry.contact}</span>
                        </div>
                    )}
                    {entry.geo && (
                        <div style={detailRowStyle}>
                            <Map size={13} style={detailIconStyle} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {entry.geo.replace(';', ', ')}
                            </span>
                        </div>
                    )}
                    {entry.duration && (
                        <div style={detailRowStyle}>
                            <Timer size={13} style={detailIconStyle} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {humanizeDuration(entry.duration) || entry.duration}
                            </span>
                        </div>
                    )}
                    {entry.color && (
                        <div style={detailRowStyle}>
                            <span style={{ flexShrink: 0, width: '18px', height: '13px', marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ width: '10px', height: '10px', minWidth: '10px', borderRadius: '50%', background: entry.color, border: '1px solid var(--border)' }} />
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Color</span>
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
                                hasChildren={allEntries.some(e => e.parent_uid === sub.id && !e.deleted)}
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
                    {entry.rrule && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: exdates.length ? '8px' : '0' }}>
                            {humanizeRrule(entry.rrule) || entry.rrule}
                        </div>
                    )}
                    {exdates.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Skipped occurrences</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                {exdates.map(d => (
                                    <span key={d} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
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
                                <Bell size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
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

    const { entries } = useAppStore()
    const allTags = useMemo(() => {
        const tagSet = new Set<string>()
        entries.forEach(e => {
            try {
                const tags: string[] = JSON.parse(e.categories ?? '[]')
                tags.forEach(tag => tagSet.add(tag))
            } catch { /* empty */ }
        })
        return [...tagSet].sort()
    }, [entries])

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
                    <FormField label="Status" htmlFor="ef-status">
                        <select id="ef-status" value={state.status} onChange={set('status')} style={selectStyle}>
                            {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </FormField>
                )}
                <FormField label="Classification" htmlFor="ef-classification">
                    <select id="ef-classification" value={state.classification} onChange={set('classification')} style={selectStyle}>
                        <option value="">None</option>
                        <option value="PUBLIC">Public</option>
                        <option value="PRIVATE">Private</option>
                        <option value="CONFIDENTIAL">Confidential</option>
                    </select>
                </FormField>
                <FormField label="Color" htmlFor="ef-color">
                    <input id="ef-color" type="color" value={state.color} onChange={set('color')}
                        style={{ width: '36px', height: '30px', padding: '2px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', cursor: 'pointer' }}
                    />
                </FormField>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(isJournal || isTodo) && (
                    <FormField label="Start date" htmlFor="ef-start-date">
                        <input id="ef-start-date" type="datetime-local" value={state.start_date} onChange={set('start_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Due date" htmlFor="ef-due-date">
                        <input id="ef-due-date" type="datetime-local" value={state.due_date} onChange={set('due_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Completed date" htmlFor="ef-completed-date">
                        <input id="ef-completed-date" type="datetime-local" value={state.completed_date} onChange={set('completed_date')} style={inputStyle} />
                    </FormField>
                )}
                {isTodo && (
                    <FormField label="Duration" htmlFor="ef-duration">
                        <input id="ef-duration" value={state.duration} onChange={set('duration')} placeholder="e.g. PT1H30M" style={inputStyle} />
                        {state.duration && humanizeDuration(state.duration) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                {humanizeDuration(state.duration)}
                            </div>
                        )}
                    </FormField>
                )}
            </div>

            {/* Priority (to-do only) */}
            {isTodo && (
                <FormField label="Priority" htmlFor="ef-priority">
                    <select id="ef-priority" value={state.priority} onChange={set('priority')} style={selectStyle}>
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
            <FormField label="Comment" htmlFor="ef-comment">
                <textarea id="ef-comment" value={state.comment} onChange={set('comment')} rows={2}
                    placeholder="Short note or annotation"
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-ui)' }}
                />
            </FormField>

            {/* Categories */}
            <FormField label="Tags (comma-separated)" htmlFor="ef-tags">
                <input id="ef-tags" value={state.categories} onChange={set('categories')}
                    placeholder="work, personal, urgent" style={inputStyle} />
                {(() => {
                    const active = new Set(
                        state.categories.split(',').map(t => t.trim()).filter(Boolean)
                    )
                    const suggestions = allTags.filter(t => !active.has(t))
                    if (suggestions.length === 0) return null
                    return (
                        <div style={{
                            display:    'flex',
                            gap:        '4px',
                            overflowX:  'auto',
                            paddingBottom: '2px',
                            marginTop:  '6px',
                        }}>
                            {suggestions.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        const existing = state.categories.trim()
                                        onChange({ ...state, categories: existing ? `${existing}, ${tag}` : tag })
                                    }}
                                    style={{
                                        flexShrink:   0,
                                        background:   'var(--bg-raised)',
                                        border:       '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        color:        'var(--text-muted)',
                                        fontSize:     '11px',
                                        fontFamily:   'var(--font-ui)',
                                        padding:      '2px 7px',
                                        cursor:       'pointer',
                                        whiteSpace:   'nowrap',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-dim)'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                                    }}
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>
                    )
                })()}
            </FormField>

            {/* Location / URL */}
            <FormField label="Location" htmlFor="ef-location">
                <input id="ef-location" value={state.location} onChange={set('location')} placeholder="Address or place name" style={inputStyle} />
            </FormField>
            <FormField label="URL" htmlFor="ef-url">
                <input id="ef-url" type="url" value={state.url} onChange={set('url')} placeholder="https://…" style={inputStyle} />
            </FormField>

            {/* Contact */}
            <FormField label="Contact" htmlFor="ef-contact">
                <input id="ef-contact" value={state.contact} onChange={set('contact')} placeholder="Name or email" style={inputStyle} />
            </FormField>

            {/* Geo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <FormField label="Latitude" htmlFor="ef-geo-lat">
                    <input id="ef-geo-lat" type="number" step="any" value={state.geo_lat} onChange={set('geo_lat')}
                        placeholder="37.386" style={inputStyle} />
                </FormField>
                <FormField label="Longitude" htmlFor="ef-geo-lon">
                    <input id="ef-geo-lon" type="number" step="any" value={state.geo_lon} onChange={set('geo_lon')}
                        placeholder="-122.083" style={inputStyle} />
                </FormField>
            </div>

            {/* RRULE */}
            <RRuleEditor
                value={state.rrule}
                onChange={rrule => onChange({ ...state, rrule })}
                startDate={state.start_date || state.due_date}
            />

            {/* EXDATE — only shown when recurrence is active */}
            {state.rrule && (
                <ExdateEditor
                    value={state.exdate}
                    onChange={exdate => onChange({ ...state, exdate })}
                />
            )}

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

const STATUS_LABELS: Record<string, string> = {
    'COMPLETED':    'Completed',
    'CANCELLED':    'Cancelled',
    'IN-PROCESS':   'In Progress',
    'NEEDS-ACTION': 'Needs Action',
    'DRAFT':        'Draft',
    'FINAL':        'Final',
}

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
            {STATUS_LABELS[status] ?? status}
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

function humanizeRrule(rrule: string): string {
    if (!rrule.trim()) return ''
    const parts: Record<string, string> = {}
    rrule.split(';').forEach(p => {
        const eq = p.indexOf('=')
        if (eq > 0) parts[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1)
    })
    const freq = parts['FREQ']?.toUpperCase()
    const freqMap: Record<string, [string, string]> = {
        DAILY:   ['day',   'daily'],
        WEEKLY:  ['week',  'weekly'],
        MONTHLY: ['month', 'monthly'],
        YEARLY:  ['year',  'yearly'],
    }
    if (!freq || !freqMap[freq]) return ''
    const [unit, adverb] = freqMap[freq]
    const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1
    let result = interval === 1
        ? `Repeats ${adverb}`
        : `Repeats every ${interval} ${unit}s`
    if (parts['BYDAY']) {
        if (freq === 'WEEKLY') {
            const dayMap: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }
            const days = parts['BYDAY'].split(',').map(d => dayMap[d.toUpperCase()] ?? d).join(', ')
            result += ` on ${days}`
        } else if (freq === 'MONTHLY') {
            const m = parts['BYDAY'].match(/^([+-]?\d+)([A-Za-z]{2})$/)
            if (m) {
                const pos = parseInt(m[1])
                const dayNames: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' }
                const ordinals = ['first', 'second', 'third', 'fourth', 'fifth']
                const dName = dayNames[m[2].toUpperCase()] ?? m[2]
                result += pos === -1 ? ` on the last ${dName}` : ` on the ${ordinals[pos - 1] ?? pos + 'th'} ${dName}`
            }
        }
    }
    if (parts['BYMONTHDAY'] && freq === 'MONTHLY') result += ` on day ${parts['BYMONTHDAY']}`
    if (parts['COUNT']) {
        result += `, ${parts['COUNT']} time${parseInt(parts['COUNT']) !== 1 ? 's' : ''}`
    } else if (parts['UNTIL']) {
        const u = parts['UNTIL'].replace(/T.*$/, '')
        const d = new Date(`${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`)
        if (!isNaN(d.getTime()))
            result += ` until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return result
}

function humanizeDuration(dur: string): string {
    if (!dur) return ''
    const m = dur.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
    if (!m) return ''
    const [years, months, weeks, days, hours, minutes, seconds] = m.slice(1).map(x => parseInt(x ?? '0') || 0)
    const parts: string[] = []
    if (years)   parts.push(`${years} yr${years !== 1 ? 's' : ''}`)
    if (months)  parts.push(`${months} mo`)
    if (weeks)   parts.push(`${weeks} wk${weeks !== 1 ? 's' : ''}`)
    if (days)    parts.push(`${days} day${days !== 1 ? 's' : ''}`)
    if (hours)   parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`)
    if (minutes) parts.push(`${minutes} min`)
    if (seconds) parts.push(`${seconds} sec`)
    return parts.join(' ')
}

// ── RRule editor ─────────────────────────────────────────────────────────────

type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

interface RRuleEditorState {
    freq:         RRuleFreq
    interval:     number
    weekDays:     string[]
    monthlyMode:  'day' | 'weekday'
    monthlyValue: string
    endMode:      'never' | 'on' | 'after'
    endDate:      string
    count:        number
}

const WEEK_DAYS: { code: string; label: string; name: string }[] = [
    { code: 'MO', label: 'M', name: 'Monday' },
    { code: 'TU', label: 'T', name: 'Tuesday' },
    { code: 'WE', label: 'W', name: 'Wednesday' },
    { code: 'TH', label: 'T', name: 'Thursday' },
    { code: 'FR', label: 'F', name: 'Friday' },
    { code: 'SA', label: 'S', name: 'Saturday' },
    { code: 'SU', label: 'S', name: 'Sunday' },
]

function defaultRRuleEditorState(): RRuleEditorState {
    return { freq: 'WEEKLY', interval: 1, weekDays: [], monthlyMode: 'day', monthlyValue: '', endMode: 'never', endDate: '', count: 30 }
}

function parseRRuleToState(rrule: string): RRuleEditorState {
    if (!rrule.trim()) return defaultRRuleEditorState()
    const parts: Record<string, string> = {}
    rrule.split(';').forEach(p => {
        const eq = p.indexOf('=')
        if (eq > 0) parts[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1)
    })
    const freqOptions: RRuleFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
    const freq: RRuleFreq = freqOptions.includes(parts.FREQ as RRuleFreq) ? parts.FREQ as RRuleFreq : 'WEEKLY'
    const interval = parseInt(parts.INTERVAL ?? '1') || 1
    const byDayRaw = parts.BYDAY ? parts.BYDAY.split(',') : []
    const weekDays = freq === 'WEEKLY' ? byDayRaw.map(d => d.toUpperCase()) : []
    let monthlyMode: 'day' | 'weekday' = 'day'
    let monthlyValue = parts.BYMONTHDAY ?? ''
    if (freq === 'MONTHLY' && byDayRaw.length > 0 && /^[+-]?\d/.test(byDayRaw[0])) {
        monthlyMode = 'weekday'
        monthlyValue = byDayRaw[0].toUpperCase()
    }
    let endMode: 'never' | 'on' | 'after' = 'never'
    let endDate = ''
    let count = 30
    if (parts.COUNT) {
        endMode = 'after'; count = parseInt(parts.COUNT) || 30
    } else if (parts.UNTIL) {
        endMode = 'on'
        const u = parts.UNTIL.replace(/T.*$/, '')
        endDate = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`
    }
    return { freq, interval, weekDays, monthlyMode, monthlyValue, endMode, endDate, count }
}

function serializeRRuleState(s: RRuleEditorState): string {
    const parts: string[] = [`FREQ=${s.freq}`]
    if (s.interval > 1) parts.push(`INTERVAL=${s.interval}`)
    if (s.freq === 'WEEKLY' && s.weekDays.length > 0) parts.push(`BYDAY=${s.weekDays.join(',')}`)
    if (s.freq === 'MONTHLY') {
        if (s.monthlyMode === 'day' && s.monthlyValue)     parts.push(`BYMONTHDAY=${s.monthlyValue}`)
        if (s.monthlyMode === 'weekday' && s.monthlyValue) parts.push(`BYDAY=${s.monthlyValue}`)
    }
    if (s.endMode === 'after' && s.count > 0)  parts.push(`COUNT=${s.count}`)
    else if (s.endMode === 'on' && s.endDate)  parts.push(`UNTIL=${s.endDate.replace(/-/g, '')}T000000Z`)
    return parts.join(';')
}

function computeMonthlyOptions(startDate: string): Array<{ label: string; mode: 'day' | 'weekday'; value: string }> {
    const d = startDate ? new Date(startDate) : new Date()
    if (isNaN(d.getTime())) return []
    const dayOfMonth = d.getDate()
    const dayIdx  = d.getDay()
    const dayCode = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIdx]
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIdx]
    const occurrence  = Math.ceil(dayOfMonth / 7)
    const ordinals    = ['first', 'second', 'third', 'fourth', 'fifth']
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const isLast      = dayOfMonth + 7 > daysInMonth
    const opts: Array<{ label: string; mode: 'day' | 'weekday'; value: string }> = [
        { label: `Monthly on day ${dayOfMonth}`,                                       mode: 'day',     value: String(dayOfMonth) },
        { label: `Monthly on the ${ordinals[occurrence - 1] ?? 'fifth'} ${dayName}`,  mode: 'weekday', value: `${occurrence}${dayCode}` },
    ]
    if (isLast) opts.push({ label: `Monthly on the last ${dayName}`, mode: 'weekday', value: `-1${dayCode}` })
    return opts
}

function RRuleEditor({ value, onChange, startDate }: {
    value:      string
    onChange:   (rrule: string) => void
    startDate?: string
}) {
    const [state, setState] = useState<RRuleEditorState>(() => parseRRuleToState(value))
    const lastRef = useRef(value)

    useEffect(() => {
        if (value !== lastRef.current) {
            setState(parseRRuleToState(value))
            lastRef.current = value
        }
    }, [value])

    const update = (next: Partial<RRuleEditorState>) => {
        setState(prev => {
            const merged = { ...prev, ...next }
            const serialized = serializeRRuleState(merged)
            lastRef.current = serialized
            onChange(serialized)
            return merged
        })
    }

    const monthlyOptions = useMemo(() => computeMonthlyOptions(startDate ?? ''), [startDate])

    const defaultEndDate = useMemo(() => {
        const base = startDate ? new Date(startDate) : new Date()
        const d = isNaN(base.getTime()) ? new Date() : new Date(base)
        if (state.freq === 'DAILY')   d.setDate(d.getDate() + 30)
        if (state.freq === 'WEEKLY')  d.setDate(d.getDate() + 91)
        if (state.freq === 'MONTHLY') d.setMonth(d.getMonth() + 6)
        if (state.freq === 'YEARLY')  d.setFullYear(d.getFullYear() + 5)
        return d.toISOString().slice(0, 10)
    }, [state.freq, startDate])

    const isEnabled = value.trim() !== ''

    const handleEnable = () => {
        if (isEnabled) {
            lastRef.current = ''
            onChange('')
        } else {
            const next = defaultRRuleEditorState()
            if (startDate) {
                const d = new Date(startDate)
                if (!isNaN(d.getTime())) {
                    next.weekDays = [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()]]
                    if (monthlyOptions.length > 0) {
                        next.monthlyMode  = monthlyOptions[0].mode
                        next.monthlyValue = monthlyOptions[0].value
                    }
                }
            }
            setState(next)
            const serialized = serializeRRuleState(next)
            lastRef.current = serialized
            onChange(serialized)
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEnabled ? '10px' : '0' }}>
                <span style={labelStyle}>Recurrence</span>
                <button onClick={handleEnable} style={addBtnStyle}>
                    {isEnabled ? 'Remove' : '+ Add recurrence'}
                </button>
            </div>

            {isEnabled && (
                <div style={{
                    background:    'var(--bg-raised)',
                    border:        '1px solid var(--border)',
                    borderRadius:  'var(--radius-md)',
                    padding:       '14px 16px',
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           '16px',
                }}>
                    {/* Repeat every */}
                    <div>
                        <div style={rruleSectionLabelStyle}>Repeat every</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="number" min={1} max={99} value={state.interval}
                                onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) update({ interval: n }) }}
                                style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
                            />
                            <select
                                value={state.freq}
                                onChange={e => {
                                    const freq = e.target.value as RRuleFreq
                                    const next: Partial<RRuleEditorState> = { freq }
                                    if (freq === 'MONTHLY' && monthlyOptions.length > 0) {
                                        next.monthlyMode  = monthlyOptions[0].mode
                                        next.monthlyValue = monthlyOptions[0].value
                                    }
                                    if (freq === 'WEEKLY' && startDate && state.weekDays.length === 0) {
                                        const d = new Date(startDate)
                                        if (!isNaN(d.getTime())) next.weekDays = [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()]]
                                    }
                                    update(next)
                                }}
                                style={{ ...selectStyle, flex: 1 }}
                            >
                                <option value="DAILY">day</option>
                                <option value="WEEKLY">week</option>
                                <option value="MONTHLY">month</option>
                                <option value="YEARLY">year</option>
                            </select>
                        </div>
                    </div>

                    {/* Repeat on — weekly day toggles */}
                    {state.freq === 'WEEKLY' && (
                        <div>
                            <div style={rruleSectionLabelStyle}>Repeat on</div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                {WEEK_DAYS.map(({ code, label, name }) => {
                                    const active = state.weekDays.includes(code)
                                    return (
                                        <button
                                            key={code} title={name}
                                            onClick={() => update({ weekDays: active ? state.weekDays.filter(d => d !== code) : [...state.weekDays, code] })}
                                            style={{
                                                width: '32px', height: '32px', borderRadius: '50%', padding: 0,
                                                border:     active ? '2px solid var(--accent)' : '1px solid var(--border)',
                                                background: active ? 'var(--accent-glow)' : 'transparent',
                                                color:      active ? 'var(--accent)' : 'var(--text-muted)',
                                                fontSize: '11px', fontFamily: 'var(--font-ui)',
                                                fontWeight: active ? 700 : 400, cursor: 'pointer',
                                            }}
                                        >{label}</button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Repeat on — monthly dropdown */}
                    {state.freq === 'MONTHLY' && (
                        <div>
                            <div style={rruleSectionLabelStyle}>Repeat on</div>
                            <select
                                value={`${state.monthlyMode}:${state.monthlyValue}`}
                                onChange={e => {
                                    const colonIdx = e.target.value.indexOf(':')
                                    const mode = e.target.value.slice(0, colonIdx) as 'day' | 'weekday'
                                    const val  = e.target.value.slice(colonIdx + 1)
                                    update({ monthlyMode: mode, monthlyValue: val })
                                }}
                                style={selectStyle}
                            >
                                {monthlyOptions.map(opt => (
                                    <option key={opt.value} value={`${opt.mode}:${opt.value}`}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Ends */}
                    <div>
                        <div style={rruleSectionLabelStyle}>Ends</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => update({ endMode: 'never' })}>
                                <RadioDot active={state.endMode === 'never'} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Never</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <RadioDot active={state.endMode === 'on'} onClick={() => update({ endMode: 'on', endDate: state.endDate || defaultEndDate })} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', minWidth: '30px' }} onClick={() => update({ endMode: 'on', endDate: state.endDate || defaultEndDate })}>On</span>
                                <input
                                    type="date"
                                    value={state.endMode === 'on' ? state.endDate : ''}
                                    disabled={state.endMode !== 'on'}
                                    onChange={e => update({ endDate: e.target.value })}
                                    onClick={() => { if (state.endMode !== 'on') update({ endMode: 'on', endDate: state.endDate || defaultEndDate }) }}
                                    style={{ ...inputStyle, flex: 1, opacity: state.endMode === 'on' ? 1 : 0.35 }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <RadioDot active={state.endMode === 'after'} onClick={() => update({ endMode: 'after' })} />
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', minWidth: '30px' }} onClick={() => update({ endMode: 'after' })}>After</span>
                                <input
                                    type="number" min={1} max={999}
                                    value={state.endMode === 'after' ? state.count : ''}
                                    disabled={state.endMode !== 'after'}
                                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) update({ count: n }) }}
                                    onClick={() => { if (state.endMode !== 'after') update({ endMode: 'after' }) }}
                                    style={{ ...inputStyle, width: '64px', textAlign: 'center', opacity: state.endMode === 'after' ? 1 : 0.35 }}
                                />
                                <span style={{ fontSize: '13px', color: state.endMode === 'after' ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                    occurrences
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function RadioDot({ active, onClick }: { active: boolean; onClick?: () => void }) {
    return (
        <div
            role="radio" aria-checked={active} tabIndex={0}
            onClick={onClick}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick() } }}
            style={{
                width: '16px', height: '16px', minWidth: '16px', borderRadius: '50%', flexShrink: 0,
                border:     active ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {active && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />}
        </div>
    )
}

function ExdateEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const dates = value.trim() ? value.split(',').map(d => d.trim()).filter(Boolean) : []
    const toLocalDate = (iso: string) => { try { return new Date(iso).toISOString().slice(0, 10) } catch { return '' } }
    const emit = (next: string[]) => onChange(next.join(', '))
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dates.length ? '8px' : '0' }}>
                <span style={labelStyle}>Skip occurrences on</span>
                <button onClick={() => emit([...dates, new Date().toISOString()])} style={addBtnStyle}>+ Add date</button>
            </div>
            {dates.map((iso, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                    <input
                        type="date" value={toLocalDate(iso)}
                        onChange={e => {
                            if (!e.target.value) return
                            const next = [...dates]; next[i] = e.target.value + 'T00:00:00.000Z'; emit(next)
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={() => emit(dates.filter((_, idx) => idx !== i))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>
                        ×
                    </button>
                </div>
            ))}
        </div>
    )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function HeaderButton({ label, minWidth, onClick, accent = false, danger = false, disabled = false, ariaLabel }: {
    label:      string
    minWidth?:  string
    onClick:    () => void
    accent?:    boolean
    danger?:    boolean
    disabled?:  boolean
    ariaLabel?: string
}) {
    return (
        <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{
            background:   accent ? 'var(--accent-glow)' : 'transparent',
            border:       accent ? '1px solid var(--accent-dim)' : 'none',
            borderRadius: 'var(--radius-sm)',
            color:        accent ? 'var(--accent)' : danger ? '#e07070' : 'var(--text-muted)',
            fontSize:     label === '×' ? '18px' : '12px',
            fontFamily:   'var(--font-ui)',
            padding:      '3px 8px',
            cursor:       disabled ? 'not-allowed' : 'pointer',
            lineHeight:   1,
            opacity:      disabled ? 0.4 : 1,
            minWidth,
            textAlign:    'center',
        }}>{label}</button>
    )
}

function FormField({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
    return (
        <div>
            <label htmlFor={htmlFor} style={{ ...labelStyle, display: 'block', cursor: htmlFor ? 'default' : undefined }}>
                {label}
            </label>
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

function SubtaskRow({ subtask, onClick, onToggle, hasChildren }: { subtask: Entry; onClick: () => void; onToggle: () => void; hasChildren?: boolean }) {
    const isDone = (subtask.progress ?? 0) >= 100
        || subtask.status === 'COMPLETED'
        || subtask.status === 'CANCELLED'
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
            aria-label={subtask.title || 'Untitled subtask'}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-raised)' }}
        >
            <div
                role={hasChildren ? undefined : 'checkbox'}
                aria-checked={hasChildren ? undefined : isDone}
                aria-label={hasChildren ? 'Progress derived from subtasks' : isDone ? 'Mark incomplete' : 'Mark complete'}
                title={hasChildren ? 'Completion is derived from subtasks' : undefined}
                tabIndex={hasChildren ? -1 : 0}
                onClick={e => { if (hasChildren) return; e.stopPropagation(); onToggle() }}
                onKeyDown={e => { if (hasChildren) return; if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggle() } }}
                style={{
                    width: '13px', height: '13px', minWidth: '13px', borderRadius: '50%',
                    border: `1.5px solid ${isDone ? 'var(--text-muted)' : 'var(--border-strong)'}`,
                    background: isDone ? 'var(--text-muted)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', color: 'var(--bg-base)',
                    cursor: hasChildren ? 'default' : 'pointer',
                    opacity: hasChildren ? 0.5 : 1,
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
    flexShrink: 0,
    width:      '18px',
    color:      'var(--text-muted)',
    marginTop:  '1px',
}

const rruleSectionLabelStyle: React.CSSProperties = {
    fontSize:      '10px',
    color:         'var(--text-muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom:  '8px',
}
