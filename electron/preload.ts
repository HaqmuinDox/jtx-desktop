import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    entries: {
        getAll:   (filters?: { type?: string; collection?: string }) =>
            ipcRenderer.invoke('entries:getAll', filters),
        getById:  (id: string) =>
            ipcRenderer.invoke('entries:getById', id),
        create:   (entry: Record<string, unknown>) =>
            ipcRenderer.invoke('entries:create', entry),
        update:   (id: string, fields: Record<string, unknown>) =>
            ipcRenderer.invoke('entries:update', id, fields),
        delete:   (id: string) =>
            ipcRenderer.invoke('entries:delete', id),
        touch:    (id: string) =>
            ipcRenderer.invoke('entries:touch', id),
    },
    collections: {
        getAll:   () =>
            ipcRenderer.invoke('collections:getAll'),
        upsert:   (collection: Record<string, unknown>) =>
            ipcRenderer.invoke('collections:upsert', collection),
    },
    sync: {
        getStatus:      () =>
            ipcRenderer.invoke('sync:getStatus'),
        now:            () =>
            ipcRenderer.invoke('sync:now'),
        setCredentials: (creds: Record<string, string>) =>
            ipcRenderer.invoke('sync:setCredentials', creds),
        testConnection: (creds: Record<string, string>) =>
            ipcRenderer.invoke('sync:testConnection', creds),
        resetCache:      () =>
            ipcRenderer.invoke('sync:resetCache'),
        getDirtyEntries: () =>
            ipcRenderer.invoke('sync:getDirtyEntries'),
    },
    credentials: {
        save: (creds: Record<string, string>) =>
            ipcRenderer.invoke('credentials:save', creds),
        load: () =>
            ipcRenderer.invoke('credentials:load'),
    },
})