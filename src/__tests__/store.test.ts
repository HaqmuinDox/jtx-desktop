import { describe, test, expect, beforeEach, afterEach } from 'vitest'
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

describe('theme and appearance actions', () => {
    let rootEl: HTMLDivElement

    beforeEach(() => {
        rootEl = document.createElement('div')
        rootEl.id = 'root'
        document.body.appendChild(rootEl)
    })

    afterEach(() => {
        document.body.removeChild(rootEl)
    })

    test('setTheme persists to localStorage and updates data-theme attribute', () => {
        useAppStore.getState().setTheme('light')
        expect(localStorage.getItem('jtx_theme')).toBe('light')
        expect(useAppStore.getState().theme).toBe('light')
        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    test('setTheme system resolves via matchMedia (mock returns false → light)', () => {
        useAppStore.getState().setTheme('system')
        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    test('setFontSize sm sets scale on root element', () => {
        useAppStore.getState().setFontSize('sm')
        expect(localStorage.getItem('jtx_fontsize')).toBe('sm')
        expect(rootEl.style.transform).toContain('scale(0.875)')
    })

    test('setFontSize md clears root element style', () => {
        useAppStore.getState().setFontSize('sm')
        useAppStore.getState().setFontSize('md')
        expect(rootEl.style.transform).toBe('')
        expect(rootEl.style.transformOrigin).toBe('')
    })

    test('setAccentColor persists to localStorage and updates store', () => {
        useAppStore.getState().setAccentColor('#ff5500')
        expect(localStorage.getItem('jtx_accent')).toBe('#ff5500')
        expect(useAppStore.getState().accentColor).toBe('#ff5500')
    })

    test('setAccentColor with invalid hex does not throw (hits !m early return)', () => {
        expect(() => useAppStore.getState().setAccentColor('invalid-hex')).not.toThrow()
    })

    test('setAccentColor #00ff00 covers max===g hue branch', () => {
        expect(() => useAppStore.getState().setAccentColor('#00ff00')).not.toThrow()
        expect(useAppStore.getState().accentColor).toBe('#00ff00')
    })

    test('setAccentColor #0000ff covers max===b hue branch', () => {
        expect(() => useAppStore.getState().setAccentColor('#0000ff')).not.toThrow()
        expect(useAppStore.getState().accentColor).toBe('#0000ff')
    })

    test('setAccentColor #888888 covers d===0 grayscale branch', () => {
        expect(() => useAppStore.getState().setAccentColor('#888888')).not.toThrow()
    })

    test('setAccentColor #ff0080 covers g<b branch in max===r case', () => {
        expect(() => useAppStore.getState().setAccentColor('#ff0080')).not.toThrow()
    })
})

describe('misc state actions', () => {
    test('setSidebarCollapsed persists to localStorage', () => {
        useAppStore.getState().setSidebarCollapsed(true)
        expect(localStorage.getItem('jtx_sidebar')).toBe('true')
        expect(useAppStore.getState().sidebarCollapsed).toBe(true)

        useAppStore.getState().setSidebarCollapsed(false)
        expect(localStorage.getItem('jtx_sidebar')).toBe('false')
        expect(useAppStore.getState().sidebarCollapsed).toBe(false)
    })

    test('setSearchQuery updates searchQuery state', () => {
        useAppStore.getState().setSearchQuery('hello world')
        expect(useAppStore.getState().searchQuery).toBe('hello world')
    })

    test('setDeviceLocation sets and clears location', () => {
        useAppStore.getState().setDeviceLocation({ lat: '37.386', lon: '-122.083', name: 'San Francisco' })
        expect(useAppStore.getState().deviceLocation?.lat).toBe('37.386')
        expect(useAppStore.getState().deviceLocation?.name).toBe('San Francisco')

        useAppStore.getState().setDeviceLocation(null)
        expect(useAppStore.getState().deviceLocation).toBeNull()
    })

    test('setIsSyncing and setLastSynced update state', () => {
        useAppStore.getState().setIsSyncing(true)
        expect(useAppStore.getState().isSyncing).toBe(true)

        useAppStore.getState().setLastSynced('2024-01-15T10:00:00.000Z')
        expect(useAppStore.getState().lastSynced).toBe('2024-01-15T10:00:00.000Z')
    })

    test('setCreatingParentUid and setCreatingParentCollection update state', () => {
        useAppStore.getState().setCreatingParentUid('parent-001')
        expect(useAppStore.getState().creatingParentUid).toBe('parent-001')

        useAppStore.getState().setCreatingParentCollection('https://example.com/cal/')
        expect(useAppStore.getState().creatingParentCollection).toBe('https://example.com/cal/')
    })

    test('setActiveSection("settings") returns empty filterCollections', () => {
        useAppStore.getState().setActiveSection('settings')
        expect(useAppStore.getState().filterCollections.size).toBe(0)
    })

    test('setActiveSection loads saved filterCollections from localStorage', () => {
        localStorage.setItem('jtx_filter_todos', JSON.stringify(['https://example.com/cal/']))
        useAppStore.getState().setActiveSection('todos')
        expect(useAppStore.getState().filterCollections.has('https://example.com/cal/')).toBe(true)
    })

    test('setActiveSection with malformed localStorage JSON returns empty Set', () => {
        localStorage.setItem('jtx_filter_notes', 'NOT_VALID_JSON')
        useAppStore.getState().setActiveSection('notes')
        expect(useAppStore.getState().filterCollections.size).toBe(0)
    })

    test('setFilterCollections when section is settings does not write to localStorage', () => {
        useAppStore.getState().setActiveSection('settings')
        localStorage.removeItem('jtx_filter_settings')
        useAppStore.getState().setFilterCollections(new Set(['https://example.com/']))
        expect(localStorage.getItem('jtx_filter_settings')).toBeNull()
    })
})
