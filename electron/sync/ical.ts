import ICAL from 'ical.js'
import type { Entry } from '../../shared/types'

// ── Parse .ics text into an Entry ─────────────────────────────────────────────
// Takes raw iCal text from the server and returns a partial Entry
// ready to be upserted into SQLite.

export function parseIcs(
    icsText: string,
    collectionUrl: string,
    etag: string
): Partial<Entry> | null {
    try {
        const jcal    = ICAL.parse(icsText)
        const comp    = new ICAL.Component(jcal)

        // Try VJOURNAL first, then VTODO
        const vjournal = comp.getFirstSubcomponent('vjournal')
        const vtodo    = comp.getFirstSubcomponent('vtodo')
        const item     = vjournal ?? vtodo
        if (!item) return null

        const isJournal = !!vjournal
        const uid       = item.getFirstPropertyValue('uid') as string
        const summary   = item.getFirstPropertyValue('summary') as string | null
        const desc      = item.getFirstPropertyValue('description') as string | null

        // Categories — stored as JSON array string
        const catProp = item.getFirstProperty('categories')
        const categories = catProp
            ? JSON.stringify(catProp.getValues().flat())
            : null

        // DTSTART — determines Journal vs Note
        const dtstart = item.getFirstPropertyValue('dtstart') as ICAL.Time | null
        const startDate = dtstart ? dtstart.toJSDate().toISOString() : null

        if (isJournal) {
            return {
                id:          uid,
                type:        startDate ? 'journal' : 'note',
                title:       summary   ?? null,
                body:        desc      ?? null,
                start_date:  startDate,
                categories,
                collection:  collectionUrl,
                etag,
                dirty:       0,
                deleted:     0,
            }
        }

        // VTODO fields
        const due      = item.getFirstPropertyValue('due')      as ICAL.Time | null
        const status   = item.getFirstPropertyValue('status')   as string | null
        const priority = item.getFirstPropertyValue('priority') as number | null
        const progress = item.getFirstPropertyValue('percent-complete') as number | null
        const rruleProp = item.getFirstProperty('rrule')
        const rrule = rruleProp ? (rruleProp.getFirstValue()?.toString() ?? null) : null

        // Parent UID for subtasks
        const relatedProps = item.getAllProperties('related-to')
        let parentUid: string | null = null
        for (const prop of relatedProps) {
            const reltype = prop.getParameter('reltype') ?? 'PARENT'
            if (reltype === 'PARENT') {
                parentUid = prop.getFirstValue() as string
                break
            }
        }

        return {
            id:          uid,
            type:        'todo',
            title:       summary  ?? null,
            body:        desc     ?? null,
            start_date:  startDate,
            due_date:    due ? due.toJSDate().toISOString() : null,
            status:      normaliseStatus(status),
            priority:    priority ?? null,
            progress:    progress ?? null,
            rrule,
            categories,
            parent_uid:  parentUid,
            collection:  collectionUrl,
            etag,
            dirty:       0,
            deleted:     0,
        }
    } catch (err) {
        console.error('ical.ts: failed to parse ics', err)
        return null
    }
}

// ── Serialize an Entry to .ics text ───────────────────────────────────────────
// Takes a local Entry from SQLite and produces a valid .ics string
// ready to be PUT to the CalDAV server.

export function serializeEntry(entry: Entry): string {
    const vcalendar = new ICAL.Component(['vcalendar', [], []])
    vcalendar.addPropertyWithValue('version',  '2.0')
    vcalendar.addPropertyWithValue('prodid',   '-//jtx-desktop//EN')
    vcalendar.addPropertyWithValue('calscale', 'GREGORIAN')

    const isJournalOrNote = entry.type === 'journal' || entry.type === 'note'
    const itemName        = isJournalOrNote ? 'vjournal' : 'vtodo'
    const item            = new ICAL.Component(itemName)

    item.addPropertyWithValue('uid',           entry.id)
    item.addPropertyWithValue('summary',       entry.title   ?? '')
    item.addPropertyWithValue('description',   entry.body    ?? '')
    item.addPropertyWithValue('last-modified', ICAL.Time.now())
    item.addPropertyWithValue('dtstamp',       ICAL.Time.now())

    if (entry.created_at) {
        const created = ICAL.Time.fromJSDate(new Date(entry.created_at), false)
        item.addPropertyWithValue('created', created)
    }

    if (entry.start_date) {
        const dtstart = ICAL.Time.fromJSDate(new Date(entry.start_date), false)
        item.addPropertyWithValue('dtstart', dtstart)
    }

    if (entry.categories) {
        try {
            const tags: string[] = JSON.parse(entry.categories)
            if (tags.length > 0) {
                const catProp = new ICAL.Property('categories')
                catProp.setValues(tags)
                item.addProperty(catProp)
            }
        } catch (_e) {
            // categories is stored as JSON; if parsing fails we skip silently
        }
    }

    // VTODO-specific fields
    if (entry.type === 'todo') {
        if (entry.due_date) {
            const due = ICAL.Time.fromJSDate(new Date(entry.due_date), false)
            item.addPropertyWithValue('due', due)
        }
        if (entry.status) {
            item.addPropertyWithValue('status', denormaliseStatus(entry.status))
        }
        if (entry.priority != null) {
            item.addPropertyWithValue('priority', entry.priority)
        }
        if (entry.progress != null) {
            item.addPropertyWithValue('percent-complete', entry.progress)
        }
        if (entry.rrule) {
            const rruleProp = new ICAL.Property('rrule')
            rruleProp.setValue(ICAL.Recur.fromString(entry.rrule!))
            item.addProperty(rruleProp)
        }
        if (entry.parent_uid) {
            const relProp = new ICAL.Property('related-to')
            relProp.setParameter('reltype', 'PARENT')
            relProp.setValue(entry.parent_uid)
            item.addProperty(relProp)
        }
    }

    vcalendar.addSubcomponent(item)
    return vcalendar.toString()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseStatus(raw: string | null): Entry['status'] {
    switch (raw?.toUpperCase()) {
        case 'IN-PROCESS':    return 'IN-PROCESS'
        case 'COMPLETED':     return 'COMPLETED'
        case 'CANCELLED':     return 'CANCELLED'
        case 'NEEDS-ACTION':
        default:              return 'NEEDS-ACTION'
    }
}

function denormaliseStatus(status: Entry['status']): string {
    return status ?? 'NEEDS-ACTION'
}