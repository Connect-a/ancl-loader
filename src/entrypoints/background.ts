import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { storage } from '@wxt-dev/storage';
import { configure } from '@zip.js/zip.js';
import { setUpChrome, detachAll } from '@/scripts/readResponse/chrome/catchResponse';
import { anclDataFieldNames, requiredFieldNames, addAdditionalData } from '@/scripts/anclData';
import { BULK_DOWNLOAD_ALARM_NAME } from '@/scripts/bulkDownloadState';
import { onMessage } from '@/scripts/extMessage';
import { registerBulkDownloadAlertClicks } from '@/scripts/bulkDownloadAlert';
import { tickBulkDownload, startBulkDownload, stopBulkDownload } from '@/scripts/bulkDownloadRunner';

export default defineBackground(() => {
  // SWはWorker不可なのでzip.jsのWeb Workerを無効化
  configure({ useWebWorkers: false });

  registerBulkDownloadAlertClicks();

  // awaitで処理中はSWを生存させる（fire-and-forgetだとDL途中でSW終了の恐れ）
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BULK_DOWNLOAD_ALARM_NAME) await tickBulkDownload();
  });

  onMessage('capture/start', async () => {
    await setUpChrome();
  });
  onMessage('capture/stop', async () => {
    await detachAll();
  });
  onMessage('bulkDownload/start', ({ data }) => startBulkDownload(data.intervalMin, data.items, data.overwrite));
  onMessage('bulkDownload/stop', () => stopBulkDownload());
  onMessage('additionalData/add', ({ data }) => addAdditionalData(data));

  // 全必須フィールドが揃ったら自動detach。specificVoiceはbest-effortゆえ除外
  for (const key of anclDataFieldNames) {
    storage.watch(`local:${key}`, async () => {
      const entries = await storage.getItems(requiredFieldNames.map((x) => `local:${x}` as const));
      if (entries.every((e) => e.value)) await detachAll();
    });
  }

  void tickBulkDownload(); // SW起動時の復旧
});
