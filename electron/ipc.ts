import { ipcMain } from 'electron'
import { getDb } from './db'
import { randomUUID } from 'node:crypto'

export function registerIpcHandlers() {

    // ── Collections ──────────────────────────────────────────

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

    // ── Entries ───────────────────────────────────────────────

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
        const id = entry.id ?? randomUUID()
        db.prepare(`
      INSERT INTO entries (
        id, type, title, body, start_date, due_date, status,
        priority, progress, rrule, categories, parent_uid,
        collection, etag, dirty, deleted, created_at, updated_at
      ) VALUES (
        @id, @type, @title, @body, @start_date, @due_date, @status,
        @priority, @progress, @rrule, @categories, @parent_uid,
        @collection, @etag, 1, 0, @created_at, @updated_at
      )
    `).run({
            id,
            type:        entry.type,
            title:       entry.title       ?? null,
            body:        entry.body        ?? null,
            start_date:  entry.start_date  ?? null,
            due_date:    entry.due_date    ?? null,
            status:      entry.status      ?? null,
            priority:    entry.priority    ?? null,
            progress:    entry.progress    ?? null,
            rrule:       entry.rrule       ?? null,
            categories:  entry.categories  ?? null,
            parent_uid:  entry.parent_uid  ?? null,
            collection:  entry.collection,
            etag:        entry.etag        ?? null,
            created_at:  now,
            updated_at:  now,
        })
        return { id }
    })

    ipcMain.handle('entries:update', (_event, id: string, fields) => {
        const db = getDb()
        const now = new Date().toISOString()
        const allowed = [
            'title', 'body', 'start_date', 'due_date', 'status',
            'priority', 'progress', 'rrule', 'categories', 'parent_uid', 'etag'
        ]
        const updates = Object.keys(fields)
            .filter(k => allowed.includes(k))
            .map(k => `${k} = @${k}`)
            .join(', ')
        if (!updates) return { ok: false, reason: 'no valid fields' }
        db.prepare(`
      UPDATE entries SET ${updates}, updated_at = @updated_at, dirty = 1
      WHERE id = @id
    `).run({ ...fields, updated_at: now, id })
        return { ok: true }
    })

    ipcMain.handle('entries:delete', (_event, id: string) => {
        const db = getDb()
        // Soft delete — sync engine will send DELETE to server then remove locally
        db.prepare(`
      UPDATE entries SET deleted = 1, dirty = 1, updated_at = @updated_at
      WHERE id = @id
    `).run({ updated_at: new Date().toISOString(), id })
        return { ok: true }
    })
}