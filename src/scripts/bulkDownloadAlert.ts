import { browser } from 'wxt/browser';
import { getBulkDownloadNotify, bulkDownloadStats, type BulkDownloadState } from '@/scripts/bulkDownloadState';

const BULK_ROUTE = '/bulkDownload';
// SW再起動でもクリック処理を復元できるよう、in-memoryマップでなく通知IDに遷移先routeを埋め込む。
const NAV_PREFIX = 'nav:';

const setBadge = async (text: string, color: string): Promise<void> => {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
};

const createNotification = (title: string, message: string): Promise<string> =>
  browser.notifications.create(`${NAV_PREFIX}${BULK_ROUTE}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/128.png'),
    title,
    message,
  });

export const registerBulkDownloadAlertClicks = (): void => {
  browser.notifications.onClicked.addListener(async (id) => {
    if (!id.startsWith(NAV_PREFIX)) return;
    await browser.notifications.clear(id);
    await browser.tabs.create({ url: browser.runtime.getURL(`/popup.html#${id.slice(NAV_PREFIX.length)}`) });
  });
};

export const notifyBulkDownloadOutcome = async (state: BulkDownloadState): Promise<void> => {
  try {
    const notify = await getBulkDownloadNotify();
    if (state.phase === 'error') {
      await setBadge('!', '#d32f2f');
      const msg = state.tokenError ? 'トークンエラー：再読み込み後に再開してください' : state.lastError || '異常停止しました';
      if (notify) await createNotification('一括ダウンロードが停止しました', msg);
    } else if (state.phase === 'done') {
      await setBadge('✓', '#2e7d32');
      const s = bulkDownloadStats(state.items);
      if (notify) await createNotification('一括ダウンロード完了', `${s.done}件完了（スキップ ${s.skipped} / 失敗 ${s.failed}）`);
    }
  } catch {
    /* no-op */
  }
};

export const clearBulkDownloadBadge = (): Promise<void> => browser.action.setBadgeText({ text: '' });
