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
        setInterval:     (minutes: number) =>
            ipcRenderer.invoke('sync:setInterval', minutes),
    },
    credentials: {
        save: (creds: Record<string, string>) =>
            ipcRenderer.invoke('credentials:save', creds),
        load: () =>
            ipcRenderer.invoke('credentials:load'),
    },
    onMenuAction: (cb: (action: string) => void) => {
        ipcRenderer.on('menu-action', (_event, action: string) => cb(action))
    },
    window: {
        minimize:          () => ipcRenderer.invoke('window:minimize'),
        maximize:          () => ipcRenderer.invoke('window:maximize'),
        close:             () => ipcRenderer.invoke('window:close'),
        isMaximized:       () => ipcRenderer.invoke('window:isMaximized'),
        onMaximizedChange: (cb: (maximized: boolean) => void) => {
            ipcRenderer.on('window:maximized', (_event, maximized: boolean) => cb(maximized))
        },
    },
})