import dayjs from 'dayjs';
import { storage } from '@wxt-dev/storage';

export type DownloadHistory = { id: string; date: string; complete?: boolean };

export const downloadHistoryItem = storage.defineItem<Array<DownloadHistory>>('local:downloadHistory', { fallback: [] });
export const sectionDownloadHistoryItem = storage.defineItem<Array<DownloadHistory>>('local:sectionDownloadHistory', { fallback: [] });

const append = async (item: typeof downloadHistoryItem, id: string, complete: boolean): Promise<void> => {
  const list = (await item.getValue()).filter((h) => h.id !== id);
  list.push({ id, date: dayjs().format('YYYY/M/D HH:mm'), complete });
  await item.setValue(list);
};

export const appendDownloadHistory = (charaId: string, complete: boolean): Promise<void> => append(downloadHistoryItem, charaId, complete);

export const appendSectionDownloadHistory = (sectionId: string, complete: boolean): Promise<void> =>
  append(sectionDownloadHistoryItem, sectionId, complete);
