// ── Entry ─────────────────────────────────────────────────────────────────────
// Represents a Journal, Note, or ToDo. All three share one table in SQLite
// and one interface here, distinguished by the `type` field.

export type EntryType = 'journal' | 'note' | 'todo'

export type TodoStatus = 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED'

export interface Entry {
    id:           string        // iCal UID — never changes, used for sync identity
    type:         EntryType
    title:        string | null
    body:         string | null // Markdown content, stored in iCal DESCRIPTION
    start_date:   string | null // ISO 8601 — present for Journal, absent for Note
    due_date:     string | null // VTODO only
    status:       TodoStatus | null
    priority:     number | null // 1 (highest) to 9 (lowest)
    progress:     number | null // 0–100
    rrule:        string | null // iCal recurrence rule e.g. FREQ=WEEKLY
    categories:   string | null // JSON-encoded string array of tags
    parent_uid:   string | null // subtask: UID of parent VTODO
    collection:   string        // CalDAV collection URL this entry belongs to
    etag:         string | null // last known ETag from server
    dirty:        number        // 1 = has local changes not yet synced to server
    deleted:      number        // 1 = marked for deletion on next sync
    created_at:   string        // ISO 8601
    updated_at:   string        // ISO 8601
}

// Fields required when creating a new entry — id and timestamps are auto-generated
export type CreateEntryInput = Pick<Entry,
    'type' | 'collection'
> & Partial<Pick<Entry,
    'title' | 'body' | 'start_date' | 'due_date' | 'status' |
    'priority' | 'progress' | 'rrule' | 'categories' | 'parent_uid'
>>

// Fields allowed when updating an existing entry
export type UpdateEntryInput = Partial<Pick<Entry,
    'title' | 'body' | 'start_date' | 'due_date' | 'status' |
    'priority' | 'progress' | 'rrule' | 'categories' | 'parent_uid' | 'etag'
>>

// ── Collection ────────────────────────────────────────────────────────────────
// A CalDAV collection from Nextcloud — analogous to a notebook or project

export type CollectionType = 'journal' | 'todo' | 'mixed'

export interface Collection {
    url:          string        // CalDAV collection URL — primary key
    display_name: string | null
    type:         CollectionType | null
    ctag:         string | null // collection-level change token from server
    color:        string | null
}

// ── Entry Link ────────────────────────────────────────────────────────────────
// Represents a RELATED-TO link between two entries

export type LinkRelType = 'PARENT' | 'CHILD' | 'SIBLING'

export interface EntryLink {
    from_uid:   string
    to_uid:     string
    rel_type:   LinkRelType | null
}

// ── Sync ──────────────────────────────────────────────────────────────────────
// Used by the sync engine and the status bar in the UI

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
    state:          SyncState
    last_synced_at: string | null  // ISO 8601
    pending_changes: number        // count of dirty=1 entries
    error_message:  string | null
}