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
    },
    collections: {
        getAll:   () =>
            ipcRenderer.invoke('collections:getAll'),
        upsert:   (collection: Record<string, unknown>) =>
            ipcRenderer.invoke('collections:upsert', collection),
    },
})