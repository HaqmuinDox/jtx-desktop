import { getDb } from '../db'
import type { Entry, Collection, SyncStatus } from '../../shared/types'
import {
    discoverCollections,
    fetchEtags,
    fetchObjects,
    pushObject,
    deleteObject,
    type CalDavCredentials,
} from './caldav'
import { parseIcs, serializeEntry } from './ical'

// ── State ─────────────────────────────────────────────────────────────────────

let syncStatus: SyncStatus = {
    state:           'idle',
    last_synced_at:  null,
    pending_changes: 0,
    error_message:   null,
}

let syncInterval: ReturnType<typeof setInterval> | null = null
let credentials:  CalDavCredentials | null = null

// ── Public API ────────────────────────────────────────────────────────────────

export function setCredentials(creds: CalDavCredentials) {
    credentials = creds
}

export function getSyncStatus(): SyncStatus {
    const db      = getDb()
    const pending = (db.prepare(`
        SELECT COUNT(*) as count FROM entries
        WHERE dirty = 1 AND deleted = 0
        AND collection IN (SELECT url FROM collections)
    `).get() as any).count
    return { ...syncStatus, pending_changes: pending }
}

export function startSyncInterval(intervalMs = 5 * 60 * 1000) {
    if (syncInterval) clearInterval(syncInterval)
    syncInterval = setInterval(() => {
        sync().catch(err => console.error('sync interval error:', err))
    }, intervalMs)
}

export function stopSyncInterval() {
    if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
    }
}

// ── Main sync entry point ─────────────────────────────────────────────────────

export async function sync(): Promise<SyncStatus> {
    if (!credentials) {
        syncStatus = { ...syncStatus, state: 'offline', error_message: 'No credentials set' }
        return syncStatus
    }

    syncStatus = { ...syncStatus, state: 'syncing', error_message: null }

    try {
        // 1. Discover all collections from Nextcloud
        const remoteCollections = await discoverCollections(credentials)

        // 2. Upsert collections into local SQLite
        const db = getDb()
        for (const col of remoteCollections) {
            db.prepare(`
        INSERT INTO collections (url, display_name, type, ctag, color)
        VALUES (@url, @display_name, @type, @ctag, @color)
        ON CONFLICT(url) DO UPDATE SET
          display_name = excluded.display_name,
          ctag         = excluded.ctag,
          color        = excluded.color
      `).run(col)
        }

        // 3. Sync each collection
        for (const col of remoteCollections) {
            await syncCollection(col)
        }

        syncStatus = {
            state:           'idle',
            last_synced_at:  new Date().toISOString(),
            pending_changes: 0,
            error_message:   null,
        }
    } catch (err: any) {
        console.error('sync error:', err)
        syncStatus = {
            ...syncStatus,
            state:         'error',
            error_message: err?.message ?? 'Unknown sync error',
        }
    }

    return syncStatus
}

// ── Sync a single collection ──────────────────────────────────────────────────

async function syncCollection(col: Collection) {
    if (!credentials) return
    const db = getDb()

    // ── Step 1: Push local deletions ──────────────────────────────────────────
    const toDelete = db.prepare(
        'SELECT * FROM entries WHERE collection = ? AND deleted = 1 AND dirty = 1'
    ).all(col.url) as Entry[]

    for (const entry of toDelete) {
        try {
            await deleteObject(credentials, col.url, entry.id, entry.etag)
            db.prepare('DELETE FROM entries WHERE id = ?').run(entry.id)
        } catch (err) {
            console.error(`Failed to delete ${entry.id} from server:`, err)
        }
    }

    // ── Step 2: Push local dirty entries ──────────────────────────────────────
    const toPush = db.prepare(
        'SELECT * FROM entries WHERE collection = ? AND dirty = 1 AND deleted = 0'
    ).all(col.url) as Entry[]

    for (const entry of toPush) {
        try {
            const icsData = serializeEntry(entry)
            const newEtag = await pushObject(
                credentials, col.url, entry.id, icsData, entry.etag
            )
            db.prepare(
                'UPDATE entries SET dirty = 0, etag = ? WHERE id = ?'
            ).run(newEtag, entry.id)
        } catch (err) {
            console.error(`Failed to push ${entry.id}:`, err)
        }
    }

    // ── Step 3: Fetch remote ETags ────────────────────────────────────────────
    const remoteEtags = await fetchEtags(credentials, col.url)

    // Build a map of what we have locally
    const localEntries = db.prepare(
        'SELECT id, etag FROM entries WHERE collection = ? AND deleted = 0'
    ).all(col.url) as { id: string; etag: string | null }[]

    const localMap  = new Map(localEntries.map(e => [e.id, e.etag]))

    // ── Step 4: Detect server deletions ───────────────────────────────────────
    // Entries in local but not on server → server deleted them
    const remoteIds = new Set(
        remoteEtags.map(r => extractIdFromUrl(r.url))
    )
    for (const local of localEntries) {
        if (!remoteIds.has(local.id)) {
            db.prepare('DELETE FROM entries WHERE id = ?').run(local.id)
        }
    }

    // ── Step 5: Pull changed or new entries from server ───────────────────────
    const urlsToFetch = remoteEtags
        .filter(r => {
            const id       = extractIdFromUrl(r.url)
            const localEtag = localMap.get(id)
            return localEtag === undefined || localEtag !== r.etag
        })
        .map(r => r.url)

    const remoteObjects = await fetchObjects(credentials, col.url, urlsToFetch)

    for (const obj of remoteObjects) {
        const parsed = parseIcs(obj.data, col.url, obj.etag)
        if (!parsed || !parsed.id) continue

        const exists = db.prepare(
            'SELECT id, updated_at FROM entries WHERE id = ?'
        ).get(parsed.id) as { id: string; updated_at: string } | undefined

        const now  = new Date().toISOString()
        const row  = {
            id:             parsed.id,
            type:           parsed.type           ?? 'note',
            title:          parsed.title          ?? null,
            body:           parsed.body           ?? null,
            start_date:     parsed.start_date     ?? null,
            due_date:       parsed.due_date       ?? null,
            completed_date: parsed.completed_date ?? null,
            status:         parsed.status         ?? null,
            priority:       parsed.priority       ?? null,
            progress:       parsed.progress       ?? null,
            rrule:          parsed.rrule          ?? null,
            exdate:         parsed.exdate         ?? null,
            categories:     parsed.categories     ?? null,
            location:       parsed.location       ?? null,
            url:            parsed.url            ?? null,
            classification: parsed.classification ?? null,
            color:          parsed.color          ?? null,
            comment:        parsed.comment        ?? null,
            contact:        parsed.contact        ?? null,
            geo:            parsed.geo            ?? null,
            duration:       parsed.duration       ?? null,
            alarms:         parsed.alarms         ?? null,
            sequence:       parsed.sequence       ?? 0,
            parent_uid:     parsed.parent_uid     ?? null,
            collection:     col.url,
            etag:           obj.etag,
            created_at:     parsed.created_at     ?? now,
            updated_at:     parsed.updated_at     ?? now,
        }

        if (!exists) {
            // New entry from server — insert it
            db.prepare(`
                INSERT INTO entries (
                    id, type, title, body,
                    start_date, due_date, completed_date, status,
                    priority, progress, rrule, exdate, categories,
                    location, url, classification, color, comment, contact,
                    geo, duration, alarms, sequence, parent_uid,
                    collection, etag, dirty, deleted, created_at, updated_at
                ) VALUES (
                    @id, @type, @title, @body,
                    @start_date, @due_date, @completed_date, @status,
                    @priority, @progress, @rrule, @exdate, @categories,
                    @location, @url, @classification, @color, @comment, @contact,
                    @geo, @duration, @alarms, @sequence, @parent_uid,
                    @collection, @etag, 0, 0, @created_at, @updated_at
                )
            `).run(row)
        } else {
            // Existing entry — server wins (last-write-wins on pull)
            db.prepare(`
                UPDATE entries SET
                    type           = @type,
                    title          = @title,
                    body           = @body,
                    start_date     = @start_date,
                    due_date       = @due_date,
                    completed_date = @completed_date,
                    status         = @status,
                    priority       = @priority,
                    progress       = @progress,
                    rrule          = @rrule,
                    exdate         = @exdate,
                    categories     = @categories,
                    location       = @location,
                    url            = @url,
                    classification = @classification,
                    color          = @color,
                    comment        = @comment,
                    contact        = @contact,
                    geo            = @geo,
                    duration       = @duration,
                    alarms         = @alarms,
                    sequence       = @sequence,
                    parent_uid     = @parent_uid,
                    etag           = @etag,
                    dirty          = 0,
                    updated_at     = @updated_at
                WHERE id = @id
            `).run(row)
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Extracts the entry UID from a CalDAV object URL
// e.g. https://nextcloud.example.com/remote.php/dav/calendars/user/journal/abc-123.ics
// → abc-123
function extractIdFromUrl(url: string): string {
    const parts   = url.split('/')
    const filename = parts[parts.length - 1]
    return filename.replace(/\.ics$/i, '')
}