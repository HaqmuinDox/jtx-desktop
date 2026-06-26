import { useState, useMemo } from 'react'
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
        const sum = subtasks.reduce((acc, s) => {
            const p = s.progress !== null && s.progress !== undefined
                ? s.progress
                : (STATUS_PROGRESS[s.status ?? ''] ?? 0)
            return acc + p
        }, 0)
        return Math.round(sum / subtasks.length)
    }
    return STATUS_PROGRESS[status ?? ''] ?? 0
}

const STATUS_GROUPS = [
    { status: 'NEEDS-ACTION', label: 'Open',        color: '#a09880' },
    { status: 'IN-PROCESS',   label: 'In Progress', color: 'var(--accent)' },
    { status: 'COMPLETED',    label: 'Completed',   color: '#4a7c4a' },
    { status: 'CANCELLED',    label: 'Cancelled',   color: '#605850' },
]

type PriorityKey = '1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'none'
type DateOp = '=' | '<=' | '>='

const ALL_STATUSES = STATUS_GROUPS.map(g => g.status)

const PRIORITY_GROUPS = [
    { label: 'High', keys: ['1','2','3'] as PriorityKey[], color: '#c04040' },
    { label: 'Med',  keys: ['4','5','6'] as PriorityKey[], color: '#c08040' },
    { label: 'Low',  keys: ['7','8','9'] as PriorityKey[], color: 'var(--text-muted)' },
]

function priorityColor(key: PriorityKey): string {
    const n = Number(key)
    if (n >= 1 && n <= 3) return '#c04040'
    if (n >= 4 && n <= 6) return '#c08040'
    return 'var(--text-muted)'
}

const btnBase: React.CSSProperties = {
    background:   'transparent',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color:        'var(--text-muted)',
    fontSize:     '11px',
    fontFamily:   'var(--font-ui)',
    padding:      '2px 8px',
    cursor:       'pointer',
}
const btnActive: React.CSSProperties = {
    background: 'var(--accent-glow)',
    border:     '1px solid var(--accent-dim)',
    color:      'var(--accent)',
}

export function TodosView() {
    const { entries, selectedEntry, setSelectedEntry, setCreatingType, searchQuery } = useAppStore()

    const [sortBy, setSortBy] = useState<'priority' | 'due' | 'alpha' | 'updated'>(
        () => (localStorage.getItem('jtx_todos_sort') as 'priority' | 'due' | 'alpha' | 'updated' | null) ?? 'priority'
    )
    const [sortAsc, setSortAsc] = useState<boolean>(
        () => localStorage.getItem('jtx_todos_sort_asc') !== 'false'
    )
    const [showFilters, setShowFilters] = useState(false)

    const [filterPriorities, setFilterPriorities] = useState<Set<PriorityKey>>(() => {
        try {
            const saved = localStorage.getItem('jtx_todos_filter_priorities')
            if (saved) return new Set(JSON.parse(saved) as PriorityKey[])
        } catch { /* empty */ }
        // migrate from old single-value filter
        const old = localStorage.getItem('jtx_todos_filter_priority')
        if (old && old !== 'all') {
            const map: Record<string, PriorityKey[]> = {
                high:   ['1','2','3'],
                medium: ['4','5','6'],
                low:    ['7','8','9'],
                none:   ['none'],
            }
            return new Set(map[old] ?? [])
        }
        return new Set()
    })

    const [filterTags, setFilterTags] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('jtx_todos_filter_tags') ?? '[]') } catch { return [] }
    })
    const [filterStatuses, setFilterStatuses] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('jtx_todos_filter_statuses')
            if (saved) return JSON.parse(saved)
        } catch { /* empty */ }
        const showDone = localStorage.getItem('jtx_todos_show_completed') !== 'false'
        return showDone ? ALL_STATUSES : ['NEEDS-ACTION', 'IN-PROCESS']
    })

    const [filterDueOp, setFilterDueOp] = useState<DateOp>(
        () => (localStorage.getItem('jtx_todos_filter_due_op') as DateOp | null) ?? '<='
    )
    const [filterDueDate, setFilterDueDate] = useState<string>(
        () => localStorage.getItem('jtx_todos_filter_due_date') ?? ''
    )
    const [filterStartOp, setFilterStartOp] = useState<DateOp>(
        () => (localStorage.getItem('jtx_todos_filter_start_op') as DateOp | null) ?? '<='
    )
    const [filterStartDate, setFilterStartDate] = useState<string>(
        () => localStorage.getItem('jtx_todos_filter_start_date') ?? ''
    )

    const todos = entries
        .filter(e => e.type === 'todo' && !e.parent_uid)
        .sort((a, b) => {
            let result
            if (sortBy === 'priority') {
                const pa = a.priority ?? 9
                const pb = b.priority ?? 9
                result = pa !== pb ? pa - pb : b.updated_at.localeCompare(a.updated_at)
            } else if (sortBy === 'due') {
                if (!a.due_date && !b.due_date) result = 0
                else if (!a.due_date) result = 1
                else if (!b.due_date) result = -1
                else result = a.due_date.localeCompare(b.due_date)
            } else if (sortBy === 'alpha') {
                result = (a.title ?? '').toLowerCase().localeCompare((b.title ?? '').toLowerCase())
            } else {
                result = b.updated_at.localeCompare(a.updated_at)
            }
            return sortAsc ? result : -result
        })

    const subtasks = entries.filter(e => e.type === 'todo' && e.parent_uid)

    const allTags = useMemo(() => {
        const tagSet = new Set<string>()
        entries
            .filter(e => e.type === 'todo' && !e.parent_uid)
            .forEach(t => {
                try {
                    const tags: string[] = JSON.parse(t.categories ?? '[]')
                    tags.forEach(tag => tagSet.add(tag))
                } catch { /* empty */ }
            })
        return [...tagSet].sort()
    }, [entries])

    const activeFilterCount =
        (filterPriorities.size > 0 ? 1 : 0) +
        filterTags.length +
        (filterStatuses.length < ALL_STATUSES.length ? 1 : 0) +
        (filterDueDate ? 1 : 0) +
        (filterStartDate ? 1 : 0)

    const filteredTodos = todos.filter(e => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            if (
                !(e.title ?? '').toLowerCase().includes(q) &&
                !(e.body  ?? '').toLowerCase().includes(q) &&
                !(e.categories ?? '').toLowerCase().includes(q)
            ) return false
        }
        if (!filterStatuses.includes(e.status ?? 'NEEDS-ACTION')) return false
        if (filterPriorities.size > 0) {
            const key: PriorityKey =
                e.priority === null || e.priority === undefined || e.priority === 0
                    ? 'none'
                    : String(e.priority) as PriorityKey
            if (!filterPriorities.has(key)) return false
        }
        if (filterDueDate) {
            if (!e.due_date) return false
            const d = e.due_date.slice(0, 10)
            if (filterDueOp === '='  && d !== filterDueDate) return false
            if (filterDueOp === '<=' && d >  filterDueDate)  return false
            if (filterDueOp === '>=' && d <  filterDueDate)  return false
        }
        if (filterStartDate) {
            if (!e.start_date) return false
            const d = e.start_date.slice(0, 10)
            if (filterStartOp === '='  && d !== filterStartDate) return false
            if (filterStartOp === '<=' && d >  filterStartDate)  return false
            if (filterStartOp === '>=' && d <  filterStartDate)  return false
        }
        if (filterTags.length > 0) {
            try {
                const tags: string[] = JSON.parse(e.categories ?? '[]')
                if (!filterTags.some(ft => tags.includes(ft))) return false
            } catch { return false }
        }
        return true
    })

    const persistStatuses = (next: string[]) => {
        localStorage.setItem('jtx_todos_filter_statuses', JSON.stringify(next))
        setFilterStatuses(next)
    }
    const persistPriorities = (next: Set<PriorityKey>) => {
        localStorage.setItem('jtx_todos_filter_priorities', JSON.stringify([...next]))
        setFilterPriorities(new Set(next))
    }
    const persistTags = (tags: string[]) => {
        localStorage.setItem('jtx_todos_filter_tags', JSON.stringify(tags))
        setFilterTags(tags)
    }
    const persistDue = (op: DateOp, date: string) => {
        localStorage.setItem('jtx_todos_filter_due_op',   op)
        localStorage.setItem('jtx_todos_filter_due_date', date)
        setFilterDueOp(op)
        setFilterDueDate(date)
    }
    const persistStart = (op: DateOp, date: string) => {
        localStorage.setItem('jtx_todos_filter_start_op',   op)
        localStorage.setItem('jtx_todos_filter_start_date', date)
        setFilterStartOp(op)
        setFilterStartDate(date)
    }

    const togglePriority = (key: PriorityKey) => {
        const next = new Set(filterPriorities)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        persistPriorities(next)
    }

    const togglePriorityGroup = (keys: PriorityKey[]) => {
        const allActive = keys.every(k => filterPriorities.has(k))
        const next = new Set(filterPriorities)
        if (allActive) keys.forEach(k => next.delete(k))
        else           keys.forEach(k => next.add(k))
        persistPriorities(next)
    }

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
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                        {filteredTodos.length}
                    </span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            ...btnBase,
                            ...(showFilters || activeFilterCount > 0 ? btnActive : {}),
                            padding: '3px 8px',
                        }}
                    >
                        Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </button>
                    <select
                        value={sortBy}
                        onChange={e => {
                            const v = e.target.value as 'priority' | 'due' | 'alpha' | 'updated'
                            localStorage.setItem('jtx_todos_sort', v)
                            setSortBy(v)
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
                        }}
                    >
                        <option value="priority">Priority</option>
                        <option value="due">Due date</option>
                        <option value="alpha">A → Z</option>
                        <option value="updated">Last updated</option>
                    </select>
                    <button
                        onClick={() => {
                            const next = !sortAsc
                            localStorage.setItem('jtx_todos_sort_asc', String(next))
                            setSortAsc(next)
                        }}
                        title={sortAsc ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
                        style={{
                            background:   'transparent',
                            border:       '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color:        'var(--text-secondary)',
                            fontSize:     '14px',
                            fontFamily:   'var(--font-ui)',
                            padding:      '2px 7px',
                            cursor:       'pointer',
                            lineHeight:   1,
                        }}
                    >
                        {sortAsc ? '↑' : '↓'}
                    </button>
                    <NewButton onClick={() => setCreatingType('todo')} />
                </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div style={{
                    display:      'flex',
                    gap:          '20px',
                    flexWrap:     'wrap',
                    alignItems:   'flex-start',
                    marginBottom: '24px',
                    padding:      '14px 16px',
                    background:   'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border:       '1px solid var(--border)',
                }}>
                    {/* Status */}
                    <FilterSection label="Status">
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {STATUS_GROUPS.map(({ status, label }) => {
                                const active = filterStatuses.includes(status)
                                return (
                                    <button
                                        key={status}
                                        onClick={() => persistStatuses(
                                            active
                                                ? filterStatuses.filter(s => s !== status)
                                                : [...filterStatuses, status]
                                        )}
                                        style={{ ...btnBase, ...(active ? btnActive : {}) }}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </FilterSection>

                    {/* Priority */}
                    <FilterSection label="Priority">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {/* Group shortcuts row */}
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                    onClick={() => persistPriorities(new Set())}
                                    style={{ ...btnBase, ...(filterPriorities.size === 0 ? btnActive : {}) }}
                                >
                                    All
                                </button>
                                {PRIORITY_GROUPS.map(({ label, keys, color }) => {
                                    const allOn  = keys.every(k => filterPriorities.has(k))
                                    const someOn = keys.some(k  => filterPriorities.has(k))
                                    return (
                                        <button
                                            key={label}
                                            onClick={() => togglePriorityGroup(keys)}
                                            style={{
                                                ...btnBase,
                                                ...(allOn  ? { background: 'var(--accent-glow)', border: `1px solid ${color}55`, color } : {}),
                                                ...(someOn && !allOn ? { border: `1px solid ${color}44` } : {}),
                                            }}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                                <button
                                    onClick={() => togglePriority('none')}
                                    title="No priority set"
                                    style={{ ...btnBase, ...(filterPriorities.has('none') ? btnActive : {}) }}
                                >
                                    —
                                </button>
                            </div>
                            {/* Individual number chips */}
                            <div style={{ display: 'flex', gap: '3px' }}>
                                {(['1','2','3','4','5','6','7','8','9'] as PriorityKey[]).map((k, i) => {
                                    const active = filterPriorities.has(k)
                                    const col    = priorityColor(k)
                                    return (
                                        <button
                                            key={k}
                                            onClick={() => togglePriority(k)}
                                            style={{
                                                ...btnBase,
                                                padding:     '2px 6px',
                                                marginRight: i === 2 || i === 5 ? '4px' : 0,
                                                ...(active ? { background: 'var(--accent-glow)', border: `1px solid ${col}66`, color: col } : {}),
                                            }}
                                        >
                                            {k}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </FilterSection>

                    {/* Due date */}
                    <FilterSection label="Due Date">
                        <DateFilter
                            op={filterDueOp}
                            date={filterDueDate}
                            onChange={persistDue}
                        />
                    </FilterSection>

                    {/* Start date */}
                    <FilterSection label="Start Date">
                        <DateFilter
                            op={filterStartOp}
                            date={filterStartDate}
                            onChange={persistStart}
                        />
                    </FilterSection>

                    {/* Tags */}
                    {allTags.length > 0 && (
                        <FilterSection label="Tags">
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {allTags.map(tag => {
                                    const active = filterTags.includes(tag)
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => persistTags(
                                                active
                                                    ? filterTags.filter(t => t !== tag)
                                                    : [...filterTags, tag]
                                            )}
                                            style={{ ...btnBase, ...(active ? btnActive : {}) }}
                                        >
                                            {tag}
                                        </button>
                                    )
                                })}
                            </div>
                        </FilterSection>
                    )}

                    {/* Clear all */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => {
                                persistPriorities(new Set())
                                persistTags([])
                                persistStatuses(ALL_STATUSES)
                                persistDue('<=', '')
                                persistStart('<=', '')
                            }}
                            style={{
                                background: 'transparent',
                                border:     'none',
                                color:      'var(--text-muted)',
                                fontSize:   '11px',
                                fontFamily: 'var(--font-ui)',
                                cursor:     'pointer',
                                alignSelf:  'flex-end',
                                padding:    '0 0 2px',
                            }}
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {filteredTodos.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No tasks match the current filters'}
                </div>
            ) : (
                STATUS_GROUPS.map(({ status, label, color }) => {
                    if (!filterStatuses.includes(status)) return null
                    const group = filteredTodos.filter(e => (e.status ?? 'NEEDS-ACTION') === status)
                    if (group.length === 0) return null
                    return (
                        <div key={status} style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '8px', height: '8px',
                                    borderRadius: '50%', background: color, flexShrink: 0,
                                }} />
                                <span style={{
                                    fontSize: '11px', color,
                                    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500,
                                }}>
                                    {label}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {group.length}
                                </span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            </div>
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
                })
            )}
        </div>
    )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div style={{
                fontSize:      '10px',
                color:         'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom:  '6px',
            }}>
                {label}
            </div>
            {children}
        </div>
    )
}

function DateFilter({ op, date, onChange }: {
    op:       DateOp
    date:     string
    onChange: (op: DateOp, date: string) => void
}) {
    const ops: { value: DateOp; label: string }[] = [
        { value: '<=', label: '≤' },
        { value: '>=', label: '≥' },
        { value: '=',  label: '=' },
    ]
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {ops.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => onChange(value, date)}
                    style={{
                        ...btnBase,
                        padding: '2px 6px',
                        ...(op === value && date ? btnActive : {}),
                    }}
                >
                    {label}
                </button>
            ))}
            <input
                type="date"
                value={date}
                onChange={e => onChange(op, e.target.value)}
                style={{
                    background:  'var(--bg-raised)',
                    border:      '1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',
                    color:       date ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize:    '11px',
                    fontFamily:  'var(--font-ui)',
                    padding:     '2px 6px',
                    cursor:      'pointer',
                    colorScheme: 'dark',
                } as React.CSSProperties}
            />
            {date && (
                <button
                    onClick={() => onChange(op, '')}
                    title="Clear"
                    style={{
                        background: 'transparent',
                        border:     'none',
                        color:      'var(--text-muted)',
                        fontSize:   '14px',
                        cursor:     'pointer',
                        padding:    '0 2px',
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            )}
        </div>
    )
}

function TodoRow({
    entry, isSelected, onClick, subtasks
}: {
    entry:      Entry
    isSelected: boolean
    onClick:    () => void
    subtasks:   Entry[]
}) {
    const { setEntries } = useAppStore()
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

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        const status   = isDone ? 'NEEDS-ACTION' : 'COMPLETED'
        const progress = isDone ? 0 : 100
        window.api.entries.update(entry.id, { status, progress }).then(() => {
            window.api.entries.getAll().then(setEntries)
        })
    }

    const checkboxBorderColor = isDone ? 'var(--text-muted)' : 'var(--border-strong)'

    return (
        <div
            onClick={onClick}
            style={{
                display:    'flex',
                alignItems: 'flex-start',
                gap:        '12px',
                padding:    '10px 14px',
                borderRadius: 'var(--radius-md)',
                background:   isSelected ? 'var(--bg-active)' : 'transparent',
                borderLeft:   isSelected
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                cursor:     'pointer',
                transition: 'background 0.12s',
                opacity:    isDone ? 0.5 : 1,
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
            <div
                onClick={handleCheckboxClick}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-dim)'
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = checkboxBorderColor
                }}
                style={{
                    width:          '16px',
                    height:         '16px',
                    minWidth:       '16px',
                    borderRadius:   '50%',
                    border:         `1.5px solid ${checkboxBorderColor}`,
                    background:     isDone ? 'var(--text-muted)' : 'transparent',
                    marginTop:      '1px',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       '9px',
                    color:          'var(--bg-base)',
                    cursor:         'pointer',
                }}
            >
                {isDone && '✓'}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                    marginBottom: subtasks.length > 0 || tags.length > 0 ? '4px' : 0,
                }}>
                    <span style={{
                        fontSize:       '14px',
                        color:          'var(--text-primary)',
                        fontWeight:     500,
                        textDecoration: isDone ? 'line-through' : 'none',
                        flex:           1,
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
                            flexShrink: 0,
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
                                height:       '100%',
                                width:        `${pct}%`,
                                background:   'var(--accent)',
                                borderRadius: '1px',
                            }} />
                        </div>
                    ) : null
                })()}

                {/* Subtasks count + tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {subtasks.length > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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
            background:   'var(--accent-glow)',
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
                    background:   'var(--accent-glow)',
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
