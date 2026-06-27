import { describe, test, expect } from 'vitest'
import { parseIcs, serializeEntry } from '../../electron/sync/ical'
import type { Entry, AlarmObject } from '../../shared/types'

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

describe('parseIcs - optional fields', () => {
    test('parses location, url, contact, comment, CLASS, and COLOR', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:opt-scalar-001
LOCATION:San Francisco
URL:https://example.com
CONTACT:John Doe
COMMENT:A comment here
CLASS:PRIVATE
COLOR:blue
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.location).toBe('San Francisco')
        expect(entry?.url).toBe('https://example.com')
        expect(entry?.contact).toBe('John Doe')
        expect(entry?.comment).toBe('A comment here')
        expect(entry?.classification).toBe('PRIVATE')
        expect(entry?.color).toBe('blue')
    })

    test('parses GEO as a lat;lon string', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:geo-001
GEO:37.386013;-122.082932
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.geo).toBeTruthy()
        expect(entry?.geo).toContain(';')
    })

    test('parses RRULE', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:rrule-001
RRULE:FREQ=WEEKLY
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.rrule).toBeTruthy()
        expect(entry?.rrule).toContain('FREQ')
    })

    test('parses EXDATE as JSON array of ISO strings', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:exdate-001
EXDATE:20240120T090000Z
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.exdate).toBeTruthy()
        const dates = JSON.parse(entry!.exdate!)
        expect(Array.isArray(dates)).toBe(true)
        expect(dates.length).toBe(1)
    })

    test('parses VALARM into alarms JSON', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:alarm-001
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER:-PT15M
END:VALARM
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.alarms).toBeTruthy()
        const alarms = JSON.parse(entry!.alarms!) as AlarmObject[]
        expect(alarms).toHaveLength(1)
        expect(alarms[0].action).toBe('DISPLAY')
        expect(alarms[0].description).toBe('Reminder')
        expect(alarms[0].trigger).toBeTruthy()
    })

    test('parses RELATED-TO;RELTYPE=PARENT on VTODO as parent_uid', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTODO
UID:subtask-001
RELATED-TO;RELTYPE=PARENT:parent-uid-123
END:VTODO
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.parent_uid).toBe('parent-uid-123')
    })

    test('ignores RELATED-TO with non-PARENT reltype (parent_uid stays null)', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTODO
UID:sibling-001
RELATED-TO;RELTYPE=SIBLING:sibling-uid-456
END:VTODO
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.parent_uid).toBeNull()
    })

    test('parses VTODO COMPLETED and PERCENT-COMPLETE', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTODO
UID:done-001
COMPLETED:20240115T120000Z
PERCENT-COMPLETE:100
END:VTODO
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.completed_date).toBeTruthy()
        expect(entry?.progress).toBe(100)
    })

    test('treats unknown CLASS value as null classification', () => {
        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VJOURNAL
UID:class-001
CLASS:CLASSIFIED
END:VJOURNAL
END:VCALENDAR`
        const entry = parseIcs(ics, COLLECTION, ETAG)
        expect(entry?.classification).toBeNull()
    })
})

describe('parseIcs - status normalisation', () => {
    function makeIcs(uid: string, component: 'VJOURNAL' | 'VTODO', status: string) {
        return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:${component}\nUID:${uid}\nSTATUS:${status}\nEND:${component}\nEND:VCALENDAR`
    }

    test('IN-PROCESS', () => {
        expect(parseIcs(makeIcs('s1', 'VTODO', 'IN-PROCESS'), COLLECTION, ETAG)?.status).toBe('IN-PROCESS')
    })
    test('COMPLETED', () => {
        expect(parseIcs(makeIcs('s2', 'VTODO', 'COMPLETED'), COLLECTION, ETAG)?.status).toBe('COMPLETED')
    })
    test('CANCELLED', () => {
        expect(parseIcs(makeIcs('s3', 'VTODO', 'CANCELLED'), COLLECTION, ETAG)?.status).toBe('CANCELLED')
    })
    test('DRAFT', () => {
        expect(parseIcs(makeIcs('s4', 'VJOURNAL', 'DRAFT'), COLLECTION, ETAG)?.status).toBe('DRAFT')
    })
    test('case-insensitive: in-process normalises to IN-PROCESS', () => {
        expect(parseIcs(makeIcs('s5', 'VTODO', 'in-process'), COLLECTION, ETAG)?.status).toBe('IN-PROCESS')
    })
    test('no STATUS property returns null', () => {
        const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\nBEGIN:VJOURNAL\nUID:s6\nEND:VJOURNAL\nEND:VCALENDAR`
        expect(parseIcs(ics, COLLECTION, ETAG)?.status).toBeNull()
    })
})

describe('serializeEntry - optional fields', () => {
    test('writes STATUS when set', () => {
        const ics = serializeEntry({ ...baseEntry, status: 'CANCELLED' })
        expect(ics).toContain('STATUS:CANCELLED')
    })

    test('writes CLASS when classification is set', () => {
        const ics = serializeEntry({ ...baseEntry, classification: 'CONFIDENTIAL' })
        expect(ics).toContain('CLASS:CONFIDENTIAL')
    })

    test('writes COLOR when set', () => {
        const ics = serializeEntry({ ...baseEntry, color: 'red' })
        expect(ics).toContain('COLOR:red')
    })

    test('writes LOCATION, URL, CONTACT, COMMENT when set', () => {
        const ics = serializeEntry({ ...baseEntry, location: 'NYC', url: 'https://x.com', contact: 'Jane', comment: 'hello' })
        expect(ics).toContain('LOCATION:NYC')
        expect(ics).toContain('URL:https://x.com')
        expect(ics).toContain('CONTACT:Jane')
        expect(ics).toContain('COMMENT:hello')
    })

    test('writes GEO for valid lat;lon', () => {
        const ics = serializeEntry({ ...baseEntry, geo: '37.386;-122.083' })
        expect(ics).toContain('GEO')
    })

    test('skips GEO when parts are non-numeric', () => {
        const ics = serializeEntry({ ...baseEntry, geo: 'abc;def' })
        expect(ics).not.toContain('GEO')
    })

    test('skips GEO when there is only one part (no semicolon)', () => {
        const ics = serializeEntry({ ...baseEntry, geo: '37.386' })
        expect(ics).not.toContain('GEO')
    })

    test('writes CATEGORIES for a valid JSON array', () => {
        const ics = serializeEntry({ ...baseEntry, categories: '["work","personal"]' })
        expect(ics).toContain('CATEGORIES')
    })

    test('skips CATEGORIES for empty array', () => {
        const ics = serializeEntry({ ...baseEntry, categories: '[]' })
        expect(ics).not.toContain('CATEGORIES')
    })

    test('does not throw for malformed categories JSON', () => {
        expect(() => serializeEntry({ ...baseEntry, categories: '{invalid' })).not.toThrow()
    })

    test('writes RRULE for a valid recurrence string', () => {
        const ics = serializeEntry({ ...baseEntry, rrule: 'FREQ=WEEKLY' })
        expect(ics).toContain('RRULE')
    })

    test('does not throw for malformed RRULE', () => {
        expect(() => serializeEntry({ ...baseEntry, rrule: 'NOT_A_RRULE' })).not.toThrow()
    })

    test('writes EXDATE for a valid ISO date array', () => {
        const ics = serializeEntry({ ...baseEntry, exdate: '["2024-01-20T09:00:00.000Z"]' })
        expect(ics).toContain('EXDATE')
    })

    test('skips EXDATE for empty array', () => {
        const ics = serializeEntry({ ...baseEntry, exdate: '[]' })
        expect(ics).not.toContain('EXDATE')
    })

    test('does not throw for malformed exdate JSON', () => {
        expect(() => serializeEntry({ ...baseEntry, exdate: '{invalid' })).not.toThrow()
    })

    test('writes COMPLETED for a todo with completed_date', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo', completed_date: '2024-01-20T09:00:00.000Z' })
        expect(ics).toContain('COMPLETED')
    })

    test('writes PERCENT-COMPLETE for a todo with progress', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo', progress: 50 })
        expect(ics).toContain('PERCENT-COMPLETE:50')
    })

    test('writes DURATION for a todo with valid duration string', () => {
        const ics = serializeEntry({ ...baseEntry, type: 'todo', duration: 'PT1H' })
        expect(ics).toContain('DURATION')
    })

    test('does not throw for a malformed DURATION', () => {
        expect(() => serializeEntry({ ...baseEntry, type: 'todo', duration: 'INVALID' })).not.toThrow()
    })

    test('writes VALARM for valid alarm JSON', () => {
        const alarms = JSON.stringify([{ trigger: '-PT15M', action: 'DISPLAY', description: 'Reminder' }])
        const ics = serializeEntry({ ...baseEntry, alarms })
        expect(ics).toContain('BEGIN:VALARM')
        expect(ics).toContain('ACTION:DISPLAY')
    })

    test('does not throw when VALARM trigger is not a valid duration (inner+outer catch)', () => {
        const alarms = JSON.stringify([{ trigger: 'INVALID_TRIGGER', action: 'DISPLAY', description: 'Reminder' }])
        expect(() => serializeEntry({ ...baseEntry, alarms })).not.toThrow()
    })

    test('does not throw for malformed alarms JSON', () => {
        expect(() => serializeEntry({ ...baseEntry, alarms: '{invalid' })).not.toThrow()
    })

    test('round-trips all scalar optional fields', () => {
        const entry: Entry = {
            ...baseEntry,
            location:       'Paris',
            url:            'https://example.org',
            comment:        'test comment',
            contact:        'Alice',
            classification: 'PUBLIC',
            color:          'green',
            status:         'CANCELLED',
        }
        const parsed = parseIcs(serializeEntry(entry), COLLECTION, ETAG)
        expect(parsed?.location).toBe('Paris')
        expect(parsed?.url).toBe('https://example.org')
        expect(parsed?.comment).toBe('test comment')
        expect(parsed?.contact).toBe('Alice')
        expect(parsed?.classification).toBe('PUBLIC')
        expect(parsed?.color).toBe('green')
        expect(parsed?.status).toBe('CANCELLED')
    })
})
