import { describe, test, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/app'
import type { Entry } from '../../shared/types'

const mockEntry: Entry = {
    id:             'entry-001',
    type:           'journal',
    title:          'Test',
    body:           null,
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
    collection:     'https://example.com/cal/',
    etag:           '"abc"',
    dirty:          0,
    deleted:        0,
    created_at:     '2024-01-15T09:00:00.000Z',
    updated_at:     '2024-01-15T10:00:00.000Z',
}

beforeEach(() => {
    useAppStore.setState({
        activeSection:          'journals',
        selectedEntry:          null,
        creatingType:           null,
        creatingParentUid:      null,
        creatingParentCollection: null,
        entries:                [],
        filterCollections:      new Set(),
    })
})

describe('useAppStore', () => {
    test('initial activeSection is journals', () => {
        expect(useAppStore.getState().activeSection).toBe('journals')
    })

    test('setActiveSection clears selectedEntry and creatingType', () => {
        const s = useAppStore.getState()
        s.setSelectedEntry(mockEntry)
        s.setCreatingType('note')

        s.setActiveSection('todos')

        const state = useAppStore.getState()
        expect(state.activeSection).toBe('todos')
        expect(state.selectedEntry).toBeNull()
        expect(state.creatingType).toBeNull()
    })

    test('setEntries replaces the entries array', () => {
        useAppStore.getState().setEntries([mockEntry])
        const { entries } = useAppStore.getState()
        expect(entries).toHaveLength(1)
        expect(entries[0].id).toBe('entry-001')
    })

    test('addEntry prepends to the entries array', () => {
        const entry2: Entry = { ...mockEntry, id: 'entry-002' }
        useAppStore.getState().setEntries([mockEntry])
        useAppStore.getState().addEntry(entry2)
        const { entries } = useAppStore.getState()
        expect(entries[0].id).toBe('entry-002')
        expect(entries[1].id).toBe('entry-001')
    })

    test('setSelectedEntry clears creatingType', () => {
        useAppStore.getState().setCreatingType('journal')
        useAppStore.getState().setSelectedEntry(mockEntry)
        expect(useAppStore.getState().creatingType).toBeNull()
        expect(useAppStore.getState().selectedEntry?.id).toBe('entry-001')
    })

    test('setCreatingType clears selectedEntry', () => {
        useAppStore.getState().setSelectedEntry(mockEntry)
        useAppStore.getState().setCreatingType('todo')
        expect(useAppStore.getState().selectedEntry).toBeNull()
        expect(useAppStore.getState().creatingType).toBe('todo')
    })

    test('filterCollections persists to localStorage per section', () => {
        useAppStore.getState().setActiveSection('notes')
        useAppStore.getState().setFilterCollections(new Set(['https://example.com/cal/']))
        const saved = localStorage.getItem('jtx_filter_notes')
        expect(saved).not.toBeNull()
        expect(JSON.parse(saved!)).toContain('https://example.com/cal/')
    })

    test('setSelectedEntry to null clears the selection', () => {
        useAppStore.getState().setSelectedEntry(mockEntry)
        useAppStore.getState().setSelectedEntry(null)
        expect(useAppStore.getState().selectedEntry).toBeNull()
    })
})
