import { runtime, storage } from 'webextension-polyfill';
const e = new XMLSerializer().serializeToString(document.head);
const token = (e.match(/"token":"(.+?)",/) ?? [])[1] ?? '';
if (token) storage.local.set({ token });

const isAwaitGameData = await runtime.sendMessage('getIsAwaitGameData');
if (isAwaitGameData) {
  // NOTE: ローカルのIndexedDBを削除してリモートからデータが取得されるようにする
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (!db.name) continue;
    await indexedDB.deleteDatabase(db.name);
  }
}

export {};
