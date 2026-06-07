// ── Entry ─────────────────────────────────────────────────────────────────────

export type EntryType = 'journal' | 'note' | 'todo'

// RFC 5545: VTODO statuses
export type TodoStatus = 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED'

// RFC 5545: VJOURNAL statuses
export type JournalStatus = 'DRAFT' | 'FINAL' | 'CANCELLED'

export type EntryStatus = TodoStatus | JournalStatus

export type Classification = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'

export interface AlarmObject {
    trigger:     string  // iCal DURATION relative to DTSTART/DUE, e.g. "-PT15M"
    action:      string  // "DISPLAY" | "AUDIO" | "EMAIL"
    description: string
}

export interface Entry {
    id:             string        // iCal UID — never changes
    type:           EntryType
    title:          string | null
    body:           string | null // Markdown, stored in iCal DESCRIPTION
    start_date:     string | null // ISO 8601 — present for Journal, absent for Note
    due_date:       string | null // VTODO only
    completed_date: string | null // VTODO COMPLETED property
    status:         EntryStatus | null
    priority:       number | null // 0 = undefined, 1–3 = high, 4–6 = medium, 7–9 = low
    progress:       number | null // 0–100 (PERCENT-COMPLETE)
    rrule:          string | null // iCal RRULE, e.g. "FREQ=WEEKLY"
    exdate:         string | null // JSON array of ISO date strings (recurrence exceptions)
    categories:     string | null // JSON-encoded string array of tags
    location:       string | null
    url:            string | null
    classification: Classification | null
    color:          string | null // CSS color name or hex
    comment:        string | null
    contact:        string | null
    geo:            string | null // "lat;lon", e.g. "37.386;-122.083"
    duration:       string | null // iCal DURATION, e.g. "PT1H30M" (VTODO only)
    alarms:         string | null // JSON array of AlarmObject
    sequence:       number | null // iCal SEQUENCE, auto-incremented on each push
    parent_uid:     string | null // subtask: UID of parent VTODO
    collection:     string        // CalDAV collection URL
    etag:           string | null
    dirty:          number        // 1 = has local changes not yet synced
    deleted:        number        // 1 = marked for deletion on next sync
    created_at:     string        // ISO 8601
    updated_at:     string        // ISO 8601
}

export type CreateEntryInput = Pick<Entry, 'type' | 'collection'> & Partial<Pick<Entry,
    'title' | 'body' | 'start_date' | 'due_date' | 'completed_date' | 'status' |
    'priority' | 'progress' | 'rrule' | 'exdate' | 'categories' |
    'location' | 'url' | 'classification' | 'color' | 'comment' | 'contact' |
    'geo' | 'duration' | 'alarms' | 'sequence' | 'parent_uid' | 'created_at'
>>

export type UpdateEntryInput = Partial<Pick<Entry,
    'title' | 'body' | 'start_date' | 'due_date' | 'completed_date' | 'status' |
    'priority' | 'progress' | 'rrule' | 'exdate' | 'categories' |
    'location' | 'url' | 'classification' | 'color' | 'comment' | 'contact' |
    'geo' | 'duration' | 'alarms' | 'parent_uid' | 'etag'
>>

// ── Collection ────────────────────────────────────────────────────────────────

export type CollectionType = 'journal' | 'todo' | 'mixed'

export interface Collection {
    url:          string
    display_name: string | null
    type:         CollectionType | null
    ctag:         string | null
    color:        string | null
}

// ── Entry Link ────────────────────────────────────────────────────────────────

export type LinkRelType = 'PARENT' | 'CHILD' | 'SIBLING'

export interface EntryLink {
    from_uid: string
    to_uid:   string
    rel_type: LinkRelType | null
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
    state:           SyncState
    last_synced_at:  string | null
    pending_changes: number
    error_message:   string | null
}
