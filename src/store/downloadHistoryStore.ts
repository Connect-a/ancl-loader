import { defineStore } from 'pinia';
import { downloadHistoryItem, sectionDownloadHistoryItem, type DownloadHistory } from '@/scripts/downloadHistory';

type DownloadHistoryEntry = { date: string; complete?: boolean };

export const useDownloadHistoryStore = defineStore('downloadHistoryStore', {
  state: () => ({
    downloadHistory: [] as Array<DownloadHistory>,
    sectionDownloadHistory: [] as Array<DownloadHistory>,
  }),
  getters: {
    downloadedDateMap(): Map<string, DownloadHistoryEntry> {
      return new Map(this.downloadHistory.map((h) => [h.id, { date: h.date, complete: h.complete }]));
    },
    sectionDownloadedDateMap(): Map<string, DownloadHistoryEntry> {
      return new Map(this.sectionDownloadHistory.map((h) => [h.id, { date: h.date, complete: h.complete }]));
    },
  },
  actions: {
    async init() {
      this.downloadHistory = await downloadHistoryItem.getValue();
      this.sectionDownloadHistory = await sectionDownloadHistoryItem.getValue();
    },
  },
});

downloadHistoryItem.watch((v) => (useDownloadHistoryStore().downloadHistory = v));
sectionDownloadHistoryItem.watch((v) => (useDownloadHistoryStore().sectionDownloadHistory = v));
