import { describe, test, expect } from 'vitest'
import { collectionSupports } from '../utils/collections'

describe('collectionSupports', () => {
    test('journal/mixed collections hold journals and notes, not todos', () => {
        expect(collectionSupports('journal', 'journal')).toBe(true)
        expect(collectionSupports('journal', 'note')).toBe(true)
        expect(collectionSupports('journal', 'todo')).toBe(false)
        expect(collectionSupports('mixed', 'journal')).toBe(true)
        expect(collectionSupports('mixed', 'todo')).toBe(true)
    })

    test('todo collections hold todos, not journals or notes', () => {
        expect(collectionSupports('todo', 'todo')).toBe(true)
        expect(collectionSupports('todo', 'journal')).toBe(false)
        expect(collectionSupports('todo', 'note')).toBe(false)
    })

    test('null/unknown type fails open (shown everywhere)', () => {
        expect(collectionSupports(null, 'journal')).toBe(true)
        expect(collectionSupports(null, 'todo')).toBe(true)
    })
})
