import type { CollectionType, EntryType } from '../../shared/types'

// Journals and notes are both VJOURNAL on the wire; todos are VTODO. A calendar
// only accepts the component types it was created with, so pushing (say) a todo
// to a journal-only calendar is dropped by the server. Use this to show the user
// only the collections that can actually hold a given entry type.
// A null/unknown type means capabilities are undetermined — show it rather than
// hide a usable collection.
export function collectionSupports(colType: CollectionType | null, entryType: EntryType): boolean {
    if (colType == null) return true
    return entryType === 'todo'
        ? colType === 'todo'    || colType === 'mixed'
        : colType === 'journal' || colType === 'mixed'
}
