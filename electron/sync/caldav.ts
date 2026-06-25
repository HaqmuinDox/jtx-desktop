import { createDAVClient, DAVCalendar, DAVObject } from 'tsdav'
import type { Collection } from '../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalDavCredentials {
    serverUrl:  string
    username:   string
    password:   string
}

export interface RawCalDavEntry {
    url:  string
    etag: string
    data: string  // raw .ics text
}

// ── Client factory ────────────────────────────────────────────────────────────

async function makeClient(creds: CalDavCredentials) {
    // Nextcloud's CalDAV endpoint is always at /remote.php/dav
    // tsdav needs this explicitly — auto-discovery via /.well-known/caldav
    // does not reliably return the principalUrl for Nextcloud.
    const base = creds.serverUrl.replace(/\/$/, '')

    const client = await createDAVClient({
        serverUrl:    `${base}/remote.php/dav`,
        credentials: {
            username: creds.username,
            password: creds.password,
        },
        authMethod:         'Basic',
        defaultAccountType: 'caldav',
    })
    return client
}

// ── Discover collections ──────────────────────────────────────────────────────
// Fetches all VJOURNAL and VTODO calendars from the Nextcloud server.
// Returns them shaped as our local Collection type.

export async function discoverCollections(
    creds: CalDavCredentials
): Promise<Collection[]> {
    const client = await makeClient(creds)
    const calendars: DAVCalendar[] = await client.fetchCalendars()

    return calendars
        .filter(cal => {
            const comps: string[] = cal.components ?? []
            return comps.includes('VJOURNAL') || comps.includes('VTODO')
        })
        .map(cal => ({
            url:          cal.url,
            display_name: typeof cal.displayName === 'string' ? cal.displayName : null,
            type:         inferCollectionType(cal.components ?? []),
            ctag:  (cal as Record<string, unknown>).ctag  as string ?? null,
            color: (cal as Record<string, unknown>).color as string ?? null,
        }))
}

function inferCollectionType(components: string[]): 'journal' | 'todo' | 'mixed' {
    const hasJournal = components.includes('VJOURNAL')
    const hasTodo    = components.includes('VTODO')
    if (hasJournal && hasTodo) return 'mixed'
    if (hasTodo)               return 'todo'
    return 'journal'
}

// ── Fetch all ETags for a collection ─────────────────────────────────────────
// Used during sync to cheaply detect what has changed without downloading
// the full .ics body of every entry.

export async function fetchEtags(
    creds: CalDavCredentials,
    collectionUrl: string
): Promise<{ url: string; etag: string }[]> {
    const client = await makeClient(creds)
    const objects = await client.fetchCalendarObjects({
        calendar: { url: collectionUrl } as DAVCalendar,
        filters: [{
            'comp-filter': {
                _attributes: { name: 'VCALENDAR' },
                'comp-filter': {
                    _attributes: { name: 'VJOURNAL' },
                },
            },
        }],
    })
    const journalResults = objects.map(obj => ({
        url:  obj.url,
        etag: obj.etag ?? '',
    }))

    // Also fetch VTODOs separately
    const todoObjects = await client.fetchCalendarObjects({
        calendar: { url: collectionUrl } as DAVCalendar,
        filters: [{
            'comp-filter': {
                _attributes: { name: 'VCALENDAR' },
                'comp-filter': {
                    _attributes: { name: 'VTODO' },
                },
            },
        }],
    })
    const todoResults = todoObjects.map(obj => ({
        url:  obj.url,
        etag: obj.etag ?? '',
    }))

    // Merge, deduplicate by URL
    const merged = new Map<string, { url: string; etag: string }>()
    for (const r of [...journalResults, ...todoResults]) {
        merged.set(r.url, r)
    }
    return Array.from(merged.values())
}

// ── Fetch full .ics objects ───────────────────────────────────────────────────
// Downloads the full iCal data for a list of URLs.
// Called only for entries whose ETag has changed since last sync.

export async function fetchObjects(
    creds: CalDavCredentials,
    collectionUrl: string,
    urls: string[]
): Promise<RawCalDavEntry[]> {
    if (urls.length === 0) return []
    const client = await makeClient(creds)

    // Fetch by explicit URL list — no component filter needed here
    // since we're requesting specific objects we already know exist
    const objects: DAVObject[] = await client.fetchCalendarObjects({
        calendar:    { url: collectionUrl } as DAVCalendar,
        objectUrls:  urls,
    })
    return objects
        .filter(obj => obj.data)
        .map(obj => ({
            url:  obj.url,
            etag: obj.etag ?? '',
            data: obj.data as string,
        }))
}

// ── Push an entry to the server ───────────────────────────────────────────────
// Creates or updates a single .ics object on the server.
// Returns the new ETag assigned by the server.

export async function pushObject(
    creds:         CalDavCredentials,
    collectionUrl: string,
    entryId:       string,
    icsData:       string,
    existingEtag:  string | null
): Promise<string> {
    const client    = await makeClient(creds)
    const base      = collectionUrl.endsWith('/') ? collectionUrl : `${collectionUrl}/`
    const objectUrl = `${base}${entryId}.ics`

    if (existingEtag) {
        // Update existing object
        const response = await client.updateCalendarObject({
            calendarObject: {
                url:  objectUrl,
                etag: existingEtag,
                data: icsData,
            },
        })
        const headers = (response as unknown as { headers?: Record<string, string> })?.headers
        return headers?.etag ?? headers?.['oc-etag'] ?? existingEtag
    } else {
        // Create new object
        const response = await client.createCalendarObject({
            calendar:   { url: collectionUrl } as DAVCalendar,
            filename:   `${entryId}.ics`,
            iCalString: icsData,
        })
        return (response as unknown as Record<string, unknown> & { headers?: { etag?: string } })
            ?.headers?.etag ?? ''
    }
}

// ── Delete an entry from the server ──────────────────────────────────────────

export async function deleteObject(
    creds:         CalDavCredentials,
    collectionUrl: string,
    entryId:       string,
    existingEtag:  string | null
): Promise<void> {
    const client    = await makeClient(creds)
    const base      = collectionUrl.endsWith('/') ? collectionUrl : `${collectionUrl}/`
    const objectUrl = `${base}${entryId}.ics`

    await client.deleteCalendarObject({
        calendarObject: {
            url:  objectUrl,
            etag: existingEtag ?? '',
            data: '',
        },
    })
}

// ── Test connection ───────────────────────────────────────────────────────────
// Used by the settings screen to validate credentials before saving.

export async function testConnection(
    creds: CalDavCredentials
): Promise<{ ok: boolean; error?: string }> {
    try {
        await discoverCollections(creds)
        return { ok: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { ok: false, error: message }
    }
}