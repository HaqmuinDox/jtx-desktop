import ICAL from 'ical.js'
import type { Entry, EntryStatus, Classification, AlarmObject } from '../../shared/types'

// ── Parse .ics text into an Entry ─────────────────────────────────────────────

export function parseIcs(
    icsText: string,
    collectionUrl: string,
    etag: string
): Partial<Entry> | null {
    try {
        const jcal = ICAL.parse(icsText)
        const comp = new ICAL.Component(jcal)

        const vjournal = comp.getFirstSubcomponent('vjournal')
        const vtodo    = comp.getFirstSubcomponent('vtodo')
        const item     = vjournal ?? vtodo
        if (!item) return null

        const isJournal = !!vjournal

        // ── Core fields ──────────────────────────────────────────────────────
        const uid     = item.getFirstPropertyValue('uid')     as string
        const summary = item.getFirstPropertyValue('summary') as string | null
        const desc    = item.getFirstPropertyValue('description') as string | null

        // ── Timestamps ───────────────────────────────────────────────────────
        const dtstart  = item.getFirstPropertyValue('dtstart')      as ICAL.Time | null
        const created  = item.getFirstPropertyValue('created')       as ICAL.Time | null
        const modified = item.getFirstPropertyValue('last-modified') as ICAL.Time | null

        const start_date = dtstart  ? dtstart.toJSDate().toISOString()  : null
        const created_at = created  ? created.toJSDate().toISOString()  : null
        const updated_at = modified ? modified.toJSDate().toISOString() : null

        // ── Categories ───────────────────────────────────────────────────────
        const catProp    = item.getFirstProperty('categories')
        const categories = catProp
            ? JSON.stringify(catProp.getValues().flat())
            : null

        // ── Status ───────────────────────────────────────────────────────────
        const rawStatus = item.getFirstPropertyValue('status') as string | null
        const status    = normaliseStatus(rawStatus)

        // ── Scalar properties common to both types ───────────────────────────
        const location       = item.getFirstPropertyValue('location')  as string | null
        const url            = item.getFirstPropertyValue('url')        as string | null
        const color          = item.getFirstPropertyValue('color')      as string | null
        const comment        = item.getFirstPropertyValue('comment')    as string | null
        const contact        = item.getFirstPropertyValue('contact')    as string | null
        const sequence       = item.getFirstPropertyValue('sequence')   as number | null

        const rawClass       = item.getFirstPropertyValue('class') as string | null
        const validClasses   = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL']
        const classification = validClasses.includes(rawClass?.toUpperCase() ?? '')
            ? rawClass!.toUpperCase() as Classification
            : null

        // ── GEO ──────────────────────────────────────────────────────────────
        // ical.js stores GEO as a structured value: getFirstValue() → [lat, lon].
        // getValues() returns [[lat, lon]] (array-of-arrays), so length is 1, not 2.
        const geoProp = item.getFirstProperty('geo')
        let geo: string | null = null
        if (geoProp) {
            try {
                const val = geoProp.getFirstValue()
                if (Array.isArray(val) && val.length >= 2) {
                    geo = `${val[0]};${val[1]}`
                } else if (typeof val === 'string' && val.includes(';')) {
                    geo = val
                }
            } catch { /* ignore */ }
        }

        // ── RRULE ────────────────────────────────────────────────────────────
        const rruleProp = item.getFirstProperty('rrule')
        const rrule     = rruleProp ? (rruleProp.getFirstValue()?.toString() ?? null) : null

        // ── EXDATE ───────────────────────────────────────────────────────────
        const exdateProps = item.getAllProperties('exdate')
        const exdates: string[] = []
        for (const prop of exdateProps) {
            const vals = prop.getValues() as ICAL.Time[]
            for (const val of vals) {
                if (val?.toJSDate) exdates.push(val.toJSDate().toISOString())
            }
        }
        const exdate = exdates.length > 0 ? JSON.stringify(exdates) : null

        // ── VALARM subcomponents ─────────────────────────────────────────────
        const alarmComps = item.getAllSubcomponents('valarm')
        const alarmList: AlarmObject[] = alarmComps.map(alarm => {
            const triggerProp = alarm.getFirstProperty('trigger')
            const trigger     = triggerProp ? (triggerProp.getFirstValue()?.toString() ?? '') : ''
            const action      = (alarm.getFirstPropertyValue('action') as string | null) ?? 'DISPLAY'
            const description = (alarm.getFirstPropertyValue('description') as string | null) ?? ''
            return { trigger, action, description }
        })
        const alarms = alarmList.length > 0 ? JSON.stringify(alarmList) : null

        // ── Parent UID (subtask) ─────────────────────────────────────────────
        const relatedProps = item.getAllProperties('related-to')
        let parentUid: string | null = null
        for (const prop of relatedProps) {
            const reltype = prop.getParameter('reltype') ?? 'PARENT'
            if (reltype === 'PARENT') {
                parentUid = prop.getFirstValue() as string
                break
            }
        }

        // ── VJOURNAL-specific return ─────────────────────────────────────────
        if (isJournal) {
            return {
                id:             uid,
                type:           start_date ? 'journal' : 'note',
                title:          summary       ?? null,
                body:           desc          ?? null,
                start_date,
                status,
                categories,
                location,
                url,
                classification,
                color,
                comment,
                contact,
                geo,
                rrule,
                exdate,
                alarms,
                sequence:       sequence ?? 0,
                collection:     collectionUrl,
                etag,
                dirty:          0,
                deleted:        0,
                ...(created_at  && { created_at }),
                ...(updated_at  && { updated_at }),
            }
        }

        // ── VTODO-specific fields ────────────────────────────────────────────
        const due      = item.getFirstPropertyValue('due')              as ICAL.Time | null
        const completed = item.getFirstPropertyValue('completed')       as ICAL.Time | null
        const priority = item.getFirstPropertyValue('priority')         as number | null
        const progress = item.getFirstPropertyValue('percent-complete') as number | null

        const durationProp = item.getFirstProperty('duration')
        const duration     = durationProp ? (durationProp.getFirstValue()?.toString() ?? null) : null

        return {
            id:             uid,
            type:           'todo',
            title:          summary       ?? null,
            body:           desc          ?? null,
            start_date,
            due_date:       due       ? due.toJSDate().toISOString()       : null,
            completed_date: completed ? completed.toJSDate().toISOString() : null,
            status,
            priority:       priority ?? null,
            progress:       progress ?? null,
            rrule,
            exdate,
            categories,
            location,
            url,
            classification,
            color,
            comment,
            contact,
            geo,
            duration,
            alarms,
            sequence:       sequence ?? 0,
            parent_uid:     parentUid,
            collection:     collectionUrl,
            etag,
            dirty:          0,
            deleted:        0,
            ...(created_at  && { created_at }),
            ...(updated_at  && { updated_at }),
        }
    } catch (err) {
        console.error('ical.ts: failed to parse ics', err)
        return null
    }
}

// ── Serialize an Entry to .ics text ───────────────────────────────────────────

export function serializeEntry(entry: Entry): string {
    const vcalendar = new ICAL.Component(['vcalendar', [], []])
    vcalendar.addPropertyWithValue('version',  '2.0')
    vcalendar.addPropertyWithValue('prodid',   '-//jtx-desktop//EN')
    vcalendar.addPropertyWithValue('calscale', 'GREGORIAN')

    const isJournalOrNote = entry.type === 'journal' || entry.type === 'note'
    const itemName        = isJournalOrNote ? 'vjournal' : 'vtodo'
    const item            = new ICAL.Component(itemName)

    // ── Core ─────────────────────────────────────────────────────────────────
    item.addPropertyWithValue('uid',     entry.id)
    item.addPropertyWithValue('summary', entry.title ?? '')
    item.addPropertyWithValue('description', entry.body ?? '')

    // ── Timestamps ───────────────────────────────────────────────────────────
    const now = ICAL.Time.now()
    item.addPropertyWithValue('last-modified', now)
    item.addPropertyWithValue('dtstamp',       now)

    if (entry.created_at) {
        item.addPropertyWithValue('created', ICAL.Time.fromJSDate(new Date(entry.created_at), false))
    }

    if (entry.start_date) {
        item.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(new Date(entry.start_date), false))
    }

    item.addPropertyWithValue('sequence', entry.sequence ?? 0)

    // ── Status ───────────────────────────────────────────────────────────────
    if (entry.status) {
        item.addPropertyWithValue('status', entry.status)
    }

    // ── Classification ───────────────────────────────────────────────────────
    if (entry.classification) {
        item.addPropertyWithValue('class', entry.classification)
    }

    // ── Color ────────────────────────────────────────────────────────────────
    if (entry.color) {
        item.addPropertyWithValue('color', entry.color)
    }

    // ── Location / URL / Contact ─────────────────────────────────────────────
    if (entry.location) item.addPropertyWithValue('location', entry.location)
    if (entry.url)      item.addPropertyWithValue('url',      entry.url)
    if (entry.contact)  item.addPropertyWithValue('contact',  entry.contact)
    if (entry.comment)  item.addPropertyWithValue('comment',  entry.comment)

    // ── GEO ──────────────────────────────────────────────────────────────────
    if (entry.geo) {
        const parts = entry.geo.split(';')
        if (parts.length === 2) {
            const lat = parseFloat(parts[0])
            const lon = parseFloat(parts[1])
            if (!isNaN(lat) && !isNaN(lon)) {
                const geoProp = new ICAL.Property('geo')
                geoProp.setValue([lat, lon])
                item.addProperty(geoProp)
            }
        }
    }

    // ── Categories ───────────────────────────────────────────────────────────
    if (entry.categories) {
        try {
            const tags: string[] = JSON.parse(entry.categories)
            if (tags.length > 0) {
                const catProp = new ICAL.Property('categories')
                catProp.setValues(tags)
                item.addProperty(catProp)
            }
        } catch { /* malformed JSON — skip */ }
    }

    // ── RRULE ────────────────────────────────────────────────────────────────
    if (entry.rrule) {
        try {
            const rruleProp = new ICAL.Property('rrule')
            rruleProp.setValue(ICAL.Recur.fromString(entry.rrule))
            item.addProperty(rruleProp)
        } catch { /* malformed rrule — skip */ }
    }

    // ── EXDATE ───────────────────────────────────────────────────────────────
    if (entry.exdate) {
        try {
            const dates: string[] = JSON.parse(entry.exdate)
            if (dates.length > 0) {
                const exdateProp = new ICAL.Property('exdate')
                exdateProp.setValues(dates.map(d => ICAL.Time.fromJSDate(new Date(d), false)))
                item.addProperty(exdateProp)
            }
        } catch { /* malformed JSON — skip */ }
    }

    // ── VTODO-specific ───────────────────────────────────────────────────────
    if (entry.type === 'todo') {
        if (entry.due_date) {
            item.addPropertyWithValue('due', ICAL.Time.fromJSDate(new Date(entry.due_date), false))
        }
        if (entry.completed_date) {
            item.addPropertyWithValue('completed', ICAL.Time.fromJSDate(new Date(entry.completed_date), false))
        }
        if (entry.priority != null) {
            item.addPropertyWithValue('priority', entry.priority)
        }
        if (entry.progress != null) {
            item.addPropertyWithValue('percent-complete', entry.progress)
        }
        if (entry.duration) {
            try {
                item.addPropertyWithValue('duration', ICAL.Duration.fromString(entry.duration))
            } catch { /* malformed duration — skip */ }
        }
        if (entry.parent_uid) {
            const relProp = new ICAL.Property('related-to')
            relProp.setParameter('reltype', 'PARENT')
            relProp.setValue(entry.parent_uid)
            item.addProperty(relProp)
        }
    }

    // ── VALARM subcomponents ─────────────────────────────────────────────────
    if (entry.alarms) {
        try {
            const alarmList: AlarmObject[] = JSON.parse(entry.alarms)
            for (const alarm of alarmList) {
                const valarm = new ICAL.Component('valarm')
                valarm.addPropertyWithValue('action',      alarm.action || 'DISPLAY')
                valarm.addPropertyWithValue('description', alarm.description || 'Reminder')
                try {
                    const triggerProp = new ICAL.Property('trigger')
                    triggerProp.setValue(ICAL.Duration.fromString(alarm.trigger))
                    valarm.addProperty(triggerProp)
                } catch {
                    valarm.addPropertyWithValue('trigger', alarm.trigger)
                }
                item.addSubcomponent(valarm)
            }
        } catch { /* malformed JSON — skip */ }
    }

    vcalendar.addSubcomponent(item)
    return vcalendar.toString()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseStatus(raw: string | null): EntryStatus | null {
    if (!raw) return null
    switch (raw.toUpperCase()) {
        case 'IN-PROCESS':   return 'IN-PROCESS'
        case 'COMPLETED':    return 'COMPLETED'
        case 'CANCELLED':    return 'CANCELLED'
        case 'NEEDS-ACTION': return 'NEEDS-ACTION'
        case 'DRAFT':        return 'DRAFT'
        case 'FINAL':        return 'FINAL'
        default:             return null
    }
}
