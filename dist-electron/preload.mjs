"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  entries: {
    getAll: (filters) => electron.ipcRenderer.invoke("entries:getAll", filters),
    getById: (id) => electron.ipcRenderer.invoke("entries:getById", id),
    create: (entry) => electron.ipcRenderer.invoke("entries:create", entry),
    update: (id, fields) => electron.ipcRenderer.invoke("entries:update", id, fields),
    delete: (id) => electron.ipcRenderer.invoke("entries:delete", id)
  },
  collections: {
    getAll: () => electron.ipcRenderer.invoke("collections:getAll"),
    upsert: (collection) => electron.ipcRenderer.invoke("collections:upsert", collection)
  }
});
