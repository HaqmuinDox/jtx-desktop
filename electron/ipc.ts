import { ipcMain, safeStorage, app } from 'electron'
import { getDb } from './db'
import { randomUUID } from 'node:crypto'
import { sync, getSyncStatus, setCredentials, startSyncInterval } from './sync/engine'
import { testConnection } from './sync/caldav'
import path from 'node:path'
import fs from 'node:fs'

const ALL_ENTRY_FIELDS = [
    'title', 'body', 'start_date', 'due_date', 'completed_date', 'status',
    'priority', 'progress', 'rrule', 'exdate', 'categories',
    'location', 'url', 'classification', 'color', 'comment', 'contact',
    'geo', 'duration', 'alarms', 'parent_uid',
] as const

export function registerIpcHandlers() {

    // ── Collections ──────────────────────────────────────────────────────────

    ipcMain.handle('collections:getAll', () => {
        const db = getDb()
        return db.prepare('SELECT * FROM collections').all()
    })

    ipcMain.handle('collections:upsert', (_event, collection) => {
        const db = getDb()
        db.prepare(`
            INSERT INTO collections (url, display_name, type, ctag, color)
            VALUES (@url, @display_name, @type, @ctag, @color)
            ON CONFLICT(url) DO UPDATE SET
                display_name = excluded.display_name,
                type         = excluded.type,
                ctag         = excluded.ctag,
                color        = excluded.color
        `).run(collection)
        return { ok: true }
    })

    // ── Entries ───────────────────────────────────────────────────────────────

    ipcMain.handle('entries:getAll', (_event, filters?: { type?: string; collection?: string }) => {
        const db = getDb()
        let query = 'SELECT * FROM entries WHERE deleted = 0'
        const params: Record<string, string> = {}
        if (filters?.type) {
            query += ' AND type = @type'
            params.type = filters.type
        }
        if (filters?.collection) {
            query += ' AND collection = @collection'
            params.collection = filters.collection
        }
        query += ' ORDER BY COALESCE(start_date, created_at) DESC'
        return db.prepare(query).all(params)
    })

    ipcMain.handle('entries:getById', (_event, id: string) => {
        const db = getDb()
        return db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
    })

    ipcMain.handle('entries:create', (_event, entry) => {
        const db = getDb()
        const now = new Date().toISOString()
        const id  = entry.id ?? randomUUID()
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
                @collection, @etag, 1, 0, @created_at, @updated_at
            )
        `).run({
            id,
            type:           entry.type,
            title:          entry.title          ?? null,
            body:           entry.body           ?? null,
            start_date:     entry.start_date     ?? null,
            due_date:       entry.due_date        ?? null,
            completed_date: entry.completed_date ?? null,
            status:         entry.status         ?? null,
            priority:       entry.priority       ?? null,
            progress:       entry.progress       ?? null,
            rrule:          entry.rrule          ?? null,
            exdate:         entry.exdate         ?? null,
            categories:     entry.categories     ?? null,
            location:       entry.location       ?? null,
            url:            entry.url            ?? null,
            classification: entry.classification ?? null,
            color:          entry.color          ?? null,
            comment:        entry.comment        ?? null,
            contact:        entry.contact        ?? null,
            geo:            entry.geo            ?? null,
            duration:       entry.duration       ?? null,
            alarms:         entry.alarms         ?? null,
            sequence:       entry.sequence       ?? 0,
            parent_uid:     entry.parent_uid     ?? null,
            collection:     entry.collection,
            etag:           entry.etag           ?? null,
            // Preserve the original CREATED timestamp from iCal if available
            created_at:     entry.created_at     ?? now,
            updated_at:     entry.updated_at     ?? now,
        })
        return { id }
    })

    ipcMain.handle('entries:update', (_event, id: string, fields) => {
        const db = getDb()
        const now = new Date().toISOString()

        const updates = Object.keys(fields)
            .filter(k => (ALL_ENTRY_FIELDS as readonly string[]).includes(k))
            .map(k => `${k} = @${k}`)
            .join(', ')

        if (!updates) return { ok: false, reason: 'no valid fields' }

        // Increment sequence on every user-initiated update so the server
        // can detect our changes via the SEQUENCE counter.
        db.prepare(`
            UPDATE entries
            SET ${updates}, updated_at = @updated_at, dirty = 1,
                sequence = COALESCE(sequence, 0) + 1
            WHERE id = @id
        `).run({ ...fields, updated_at: now, id })

        return { ok: true }
    })

    ipcMain.handle('entries:delete', (_event, id: string) => {
        const db = getDb()
        db.prepare(`
            UPDATE entries SET deleted = 1, dirty = 1, updated_at = @updated_at
            WHERE id = @id
        `).run({ updated_at: new Date().toISOString(), id })
        return { ok: true }
    })

    // ── Sync ─────────────────────────────────────────────────────────────────

    ipcMain.handle('sync:getStatus', () => {
        return getSyncStatus()
    })

    ipcMain.handle('sync:now', async () => {
        return await sync()
    })

    ipcMain.handle('sync:setCredentials', (_event, creds) => {
        setCredentials(creds)
        startSyncInterval()
        return { ok: true }
    })

    ipcMain.handle('sync:testConnection', async (_event, creds) => {
        return await testConnection(creds)
    })

    // Clears all local ETags so the next sync re-fetches every entry from
    // the server. Use this to pick up fields that were added after initial sync.
    ipcMain.handle('sync:resetCache', () => {
        const db = getDb()
        db.prepare('UPDATE entries SET etag = NULL WHERE deleted = 0').run()
        return { ok: true }
    })

    // Returns entries that are marked dirty=1 (for diagnostics)
    ipcMain.handle('sync:getDirtyEntries', () => {
        const db = getDb()
        return db.prepare(
            'SELECT id, type, title, collection, dirty, etag FROM entries WHERE dirty = 1 AND deleted = 0'
        ).all()
    })

    // ── Credentials ───────────────────────────────────────────────────────────

    ipcMain.handle('credentials:save', (_event, creds: Record<string, string>) => {
        try {
            const credPath = path.join(app.getPath('userData'), 'credentials.enc')
            const plain    = JSON.stringify(creds)
            if (safeStorage.isEncryptionAvailable()) {
                const encrypted = safeStorage.encryptString(plain)
                fs.writeFileSync(credPath, encrypted)
            } else {
                fs.writeFileSync(credPath, plain, 'utf-8')
            }
            return { ok: true }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            return { ok: false, error: message }
        }
    })

    ipcMain.handle('credentials:load', () => loadCredentials())
}

export function loadCredentials(): Record<string, string> | null {
    try {
        const credPath = path.join(app.getPath('userData'), 'credentials.enc')
        if (!fs.existsSync(credPath)) return null
        const raw = fs.readFileSync(credPath)
        if (safeStorage.isEncryptionAvailable()) {
            const decrypted = safeStorage.decryptString(Buffer.from(raw))
            return JSON.parse(decrypted)
        } else {
            return JSON.parse(raw.toString('utf-8'))
        }
    } catch (_e) {
        return null
    }
}
