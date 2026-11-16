import { describe, test, expect } from 'vitest'
import type { DAVCalendar } from 'tsdav'
import { calendarToCollection } from '../../electron/sync/caldav'

const cal = (over: Record<string, unknown>): DAVCalendar =>
    ({ url: 'https://nc.example/cal/', components: ['VJOURNAL'], ...over } as unknown as DAVCalendar)

describe('calendarToCollection', () => {
    test('keeps string ctag and color', () => {
        const c = calendarToCollection(cal({ ctag: 'http://x/1', calendarColor: '#ff0000', displayName: 'Personal' }))
        expect(c).toMatchObject({ ctag: 'http://x/1', color: '#ff0000', display_name: 'Personal', type: 'journal' })
    })

    // The Framagenda bug: non-string ctag/color must become null, never reach SQLite.
    test('coerces non-string ctag/color/displayName to null', () => {
        const c = calendarToCollection(cal({ ctag: {}, calendarColor: {}, displayName: {} }))
        expect(c.ctag).toBeNull()
        expect(c.color).toBeNull()
        expect(c.display_name).toBeNull()
    })

    test('handles missing fields', () => {
        const c = calendarToCollection(cal({}))
        expect(c.ctag).toBeNull()
        expect(c.color).toBeNull()
        expect(c.display_name).toBeNull()
    })

    test('infers type from components', () => {
        expect(calendarToCollection(cal({ components: ['VTODO'] })).type).toBe('todo')
        expect(calendarToCollection(cal({ components: ['VJOURNAL', 'VTODO'] })).type).toBe('mixed')
    })
})
