import { defineContentScript } from '#imports';
import { storage } from '@wxt-dev/storage';

export default defineContentScript({
  matches: ['*://ancl.jp/game/pc/start/*'],
  allFrames: true,
  async main() {
    console.log('ancl: load contentScripts');
    const e = new XMLSerializer().serializeToString(document.head);
    const token = (e.match(/"token":"(.+?)",/) ?? [])[1] ?? '';
    if (token) storage.setItem('local:token', token);

    const isAwaitGameData = (await storage.getItem<boolean>('local:isAwaitGameData')) ?? false;
    if (isAwaitGameData) {
      // IndexedDBを削除してリモートから再取得させる
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (!db.name) continue;
        await indexedDB.deleteDatabase(db.name);
      }
    }
  },
});
