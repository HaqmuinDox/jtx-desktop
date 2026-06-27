import { describe, test, expect } from 'vitest'
import { parseIcs, serializeEntry } from '../../electron/sync/ical'
import type { Entry } from '../../shared/types'

const COLLECTION = 'https://nextcloud.example.com/remote.php/dav/calendars/user/personal/'
const ETAG = '"abc123"'

const JOURNAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:journal-001
SUMMARY:My Journal Entry
DESCRIPTION:Today was a great day.
DTSTART:20240115T100000Z
CREATED:20240115T090000Z
LAST-MODIFIED:20240115T100000Z
STATUS:FINAL
END:VJOURNAL
END:VCALENDAR`

const NOTE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:note-001
SUMMARY:My Note
DESCRIPTION:A note without a date.
CREATED:20240115T090000Z
END:VJOURNAL
END:VCALENDAR`

const TODO_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTODO
UID:todo-001
SUMMARY:Buy groceries
DESCRIPTION:Milk and eggs
DUE:20240120T090000Z
STATUS:NEEDS-ACTION
PRIORITY:1
PERCENT-COMPLETE:0
END:VTODO
END:VCALENDAR`

const baseEntry: Entry = {
    id:             'test-uid-001',
    type:           'journal',
    title:          'Test Entry',
    body:           'Hello world',
    start_date:     '2024-01-15T10:00:00.000Z',
    due_date:       null,
    completed_date: null,
    status:         null,
    priority:       null,
    progress:       null,
    rrule:          null,
    exdate:         null,
    categories:     null,
    location:       null,
    url:            null,
    classification: null,
    color:          null,
    comment:        null,
    contact:        null,
    geo:            null,
    duration:       null,
    alarms:         null,
    sequence:       0,
    parent_uid:     null,
    collection:     COLLECTION,
    etag:           ETAG,
    dirty:          1,
    deleted:        0,
    created_at:     '2024-01-15T09:00:00.000Z',
    updated_at:     '2024-01-15T10:00:00.000Z',
}

describe('parseIcs', () => {
    test('parses a journal (VJOURNAL + DTSTART) as type journal', () => {
        const entry = parseIcs(JOURNAL_ICS, COLLECTION, ETAG)
        expect(entry).not.toBeNull()
        expect(entry?.type).toBe('journal')
        expect(entry?.id).toBe('journal-001')
        expect(entry?.title).toBe('My Journal Entry')
        expect(entry?.body).toBe('Today was a great day.')
        expect(entry?.start_date).toBeTruthy()
        expect(entry?.status).toBe('FINAL')
        expect(entry?.collection).toBe(COLLECTION)
        expect(entry?.etag).toBe(ETAG)
    })

    test('parses a note (VJOURNAL without DTSTART) as type note', () => {
        const entry = parseIcs(NOTE_ICS, COLLECTION, ETAG)
        expect(entry).not.toBeNull()
        expect(entry?.type).toBe('note')
        expect(entry?.id).toBe('note-001')
        expect(entry?.title).toBe('My Note')
        expect(entry?.start_date).toBeNull()
    })

    test('parses a todo (VTODO) as type todo', () => {
        const entry = parseIcs(TODO_ICS, COLLECTION, ETAG)
        expect(entry).not.toBeNull()
        expect(entry?.type).toBe('todo')
        expect(entry?.id).toBe('todo-001')
        expect(entry?.title).toBe('Buy groceries')
        expect(entry?.status).toBe('NEEDS-ACTION')
        expect(entry?.priority).toBe(1)
        expect(entry?.due_date).toBeTruthy()
    })

    test('returns null for garbage input', () => {
        expect(parseIcs('not valid ical at all', COLLECTION, ETAG)).toBeNull()
    })

    test('returns null when no VJOURNAL or VTODO is present', () => {
        const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nEND:VCALENDAR`
        expect(parseIcs(ics, COLLECTION, ETAG)).toBeNull()
    })

    test('parses categories as a JSON array', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:cat-001
SUMMARY:Categorized
CATEGORIES:work,personal
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.categories).toBeTruthy()
        const tags: string[] = JSON.parse(entry!.categories!)
        expect(tags).toContain('work')
        expect(tags).toContain('personal')
    })

    test('always sets dirty=0 and deleted=0 on parsed entries', () => {
        const entry = parseIcs(JOURNAL_ICS, COLLECTION, ETAG)
        expect(entry?.dirty).toBe(0)
        expect(entry?.deleted).toBe(0)
    })

    test('normalises unknown STATUS values to null', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:status-001
STATUS:BOGUS
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.status).toBeNull()
    })
})

describe('serializeEntry', () => {
    test('produces VJOURNAL for journal type', () => {
        const ics = serializeEntry(baseEntry)
        expect(ics).toContain('BEGIN:VCALENDAR')
        expect(ics).toContain('BEGIN:VJOURNAL')
        expect(ics).toContain('UID:test-uid-001')
        expect(ics).toContain('SUMMARY:Test Entry')
    })

    test('produces VTODO for todo type', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo' })
        expect(ics).toContain('BEGIN:VTODO')
        expect(ics).not.toContain('BEGIN:VJOURNAL')
    })

    test('notes also produce VJOURNAL (shared iCal component with journals)', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'note', start_date: null })
        expect(ics).toContain('BEGIN:VJOURNAL')
    })

    test('includes RELATED-TO;RELTYPE=PARENT for subtasks', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo', parent_uid: 'parent-uid-001' })
        expect(ics).toContain('parent-uid-001')
        expect(ics).toContain('RELTYPE=PARENT')
    })

    test('includes RELATED-TO;RELTYPE=CHILD for each child uid passed', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo' }, ['child-001', 'child-002'])
        expect(ics).toContain('child-001')
        expect(ics).toContain('child-002')
        expect(ics).toContain('RELTYPE=CHILD')
    })

    test('round-trips key fields: id, title, body, type', () => {
        const ics = serializeEntry(baseEntry)
        const parsed = parseIcs(ics, COLLECTION, ETAG)
        expect(parsed?.id).toBe(baseEntry.id)
        expect(parsed?.title).toBe(baseEntry.title)
        expect(parsed?.body).toBe(baseEntry.body)
        expect(parsed?.type).toBe(baseEntry.type)
    })

    test('round-trips todo due date and priority', () => {
        const todo: Entry = {
            ...baseEntry,
            type:     'todo',
            due_date: '2024-02-01T08:00:00.000Z',
            priority: 3,
        }
        const ics    = serializeEntry(todo)
        const parsed = parseIcs(ics, COLLECTION, ETAG)
        expect(parsed?.type).toBe('todo')
        expect(parsed?.due_date).toBeTruthy()
        expect(parsed?.priority).toBe(3)
    })
})
