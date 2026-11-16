import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom doesn't expose localStorage here, so provide an in-memory stub.
const store = new Map<string, string>()
const localStorageStub: Storage = {
    get length() { return store.size },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
}
Object.defineProperty(globalThis, 'localStorage', { writable: true, value: localStorageStub })
Object.defineProperty(window, 'localStorage', { writable: true, value: localStorageStub })

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
})

Object.defineProperty(window, 'api', {
    writable: true,
    value: {
        entries: {
            getAll:   vi.fn().mockResolvedValue([]),
            getById:  vi.fn().mockResolvedValue(null),
            create:   vi.fn().mockResolvedValue(null),
            update:   vi.fn().mockResolvedValue(undefined),
            delete:   vi.fn().mockResolvedValue(undefined),
        },
        collections: {
            getAll:  vi.fn().mockResolvedValue([]),
            upsert:  vi.fn().mockResolvedValue(undefined),
        },
        sync: {
            getStatus:      vi.fn().mockResolvedValue({ state: 'idle', last_synced_at: null, pending_changes: 0, error_message: null }),
            now:            vi.fn().mockResolvedValue(undefined),
            setCredentials: vi.fn().mockResolvedValue(undefined),
            testConnection: vi.fn().mockResolvedValue({ ok: true }),
            resetCache:     vi.fn().mockResolvedValue({ ok: true, status: { state: 'idle', last_synced_at: null, error_message: null } }),
            getDirtyEntries:vi.fn().mockResolvedValue([]),
        },
        credentials: {
            save: vi.fn().mockResolvedValue(undefined),
            load: vi.fn().mockResolvedValue(null),
        },
    },
})
