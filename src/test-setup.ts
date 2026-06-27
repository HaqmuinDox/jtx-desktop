import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

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
            resetCache:     vi.fn().mockResolvedValue(undefined),
            getDirtyEntries:vi.fn().mockResolvedValue([]),
        },
        credentials: {
            save: vi.fn().mockResolvedValue(undefined),
            load: vi.fn().mockResolvedValue(null),
        },
    },
})
