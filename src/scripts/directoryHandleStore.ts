import { get, set, del, createStore } from 'idb-keyval';

// FileSystemDirectoryHandleはstructured-clone可でIndexedDBに保存できる（storage.localは不可）。
const handleStore = createStore('ancl-dir-handles', 'handles');
const KEY = 'homeDir';

export const homeDirHandle = {
  get: async (): Promise<FileSystemDirectoryHandle | null> => (await get<FileSystemDirectoryHandle>(KEY, handleStore)) ?? null,
  save: (handle: FileSystemDirectoryHandle): Promise<void> => set(KEY, handle, handleStore),
  clear: (): Promise<void> => del(KEY, handleStore),
};
