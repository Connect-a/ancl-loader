import { storage, type StorageItemKey } from '@wxt-dev/storage';
import dayjs from 'dayjs';

type AppStorageData = {
  downloadHistory?: { id: string; date: string }[];
  sectionDownloadHistory?: { id: string; date: string }[];
  charaImportUrl?: string;
  playerCardStyle?: Record<string, unknown>;
  volume?: number;
};

const STORAGE_KEYS = {
  downloadHistory: 'downloadHistory',
  sectionDownloadHistory: 'sectionDownloadHistory',
  charaImportUrl: 'charaImportUrl',
  playerCardStyle: 'playerCardStyle',
  volume: 'volume',
} as const;

const getLocalStorageData = (): AppStorageData => {
  const data: AppStorageData = {};

  const downloadHistoryStr = localStorage.getItem(STORAGE_KEYS.downloadHistory);
  if (downloadHistoryStr) {
    try {
      data.downloadHistory = JSON.parse(downloadHistoryStr);
    } catch {
      /* ignore */
    }
  }

  const sectionDownloadHistoryStr = localStorage.getItem(STORAGE_KEYS.sectionDownloadHistory);
  if (sectionDownloadHistoryStr) {
    try {
      data.sectionDownloadHistory = JSON.parse(sectionDownloadHistoryStr);
    } catch {
      /* ignore */
    }
  }

  const charaImportUrl = localStorage.getItem(STORAGE_KEYS.charaImportUrl);
  if (charaImportUrl) {
    data.charaImportUrl = charaImportUrl;
  }

  const playerCardStyleStr = localStorage.getItem(STORAGE_KEYS.playerCardStyle);
  if (playerCardStyleStr) {
    try {
      data.playerCardStyle = JSON.parse(playerCardStyleStr);
    } catch {
      /* ignore */
    }
  }

  const volumeStr = localStorage.getItem(STORAGE_KEYS.volume);
  if (volumeStr) {
    const volume = parseInt(volumeStr, 10);
    if (!isNaN(volume)) {
      data.volume = volume;
    }
  }

  return data;
};

export const checkMigrationNeeded = async (): Promise<boolean> => {
  const [dh, sdh] = await storage.getItems(['local:downloadHistory', 'local:sectionDownloadHistory']);

  const hasStorageData = (Array.isArray(dh?.value) && dh.value.length > 0) || (Array.isArray(sdh?.value) && sdh.value.length > 0);

  if (hasStorageData) {
    return false;
  }

  const localStorageData = getLocalStorageData();

  return (
    (localStorageData.downloadHistory?.length ?? 0) > 0 ||
    (localStorageData.sectionDownloadHistory?.length ?? 0) > 0 ||
    !!localStorageData.charaImportUrl
  );
};

export const migrateToStorageLocal = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = getLocalStorageData();
    if (Object.keys(data).length > 0) {
      await storage.setItems(Object.entries(data).map(([k, value]) => ({ key: `local:${k}` as StorageItemKey, value })));
    }
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    return { success: true };
  } catch (e: unknown) {
    console.error('Storage migration failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const downloadBackup = (): void => {
  const data = getLocalStorageData();

  const blob = new Blob([JSON.stringify(data)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.download = `ancl-loader-backup-${dayjs().format('YYYYMMDD_HHmmss')}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};
