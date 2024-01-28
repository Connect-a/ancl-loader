import dayjs from 'dayjs';
import { defineStore } from 'pinia';

const key_downloadHistory = 'downloadHistory';
const key_sectionDownloadHistory = 'sectionDownloadHistory';

type DownloadHistory = { id: string; date: string };
type SectionDownloadHistory = { id: string; date: string };

export const useDownloadHistoryStore = defineStore('downloadHistoryStore', {
  state: () => ({
    downloadHistory: JSON.parse(
      localStorage.getItem(key_downloadHistory) ?? '[]',
    ) as Array<DownloadHistory>,
    sectionDownloadHistory: JSON.parse(
      localStorage.getItem(key_sectionDownloadHistory) ?? '[]',
    ) as Array<SectionDownloadHistory>,
  }),
  getters: {},
  actions: {
    pushDownloadHistory(charaId: string) {
      this.downloadHistory.push({
        id: charaId,
        date: dayjs().format('YYYY/M/D HH:mm'),
      });

      localStorage.setItem(key_downloadHistory, JSON.stringify(this.downloadHistory));
    },
    pushSectionDownloadHistory(sectionId: string) {
      this.sectionDownloadHistory.push({
        id: sectionId,
        date: dayjs().format('YYYY/M/D HH:mm'),
      });

      localStorage.setItem(key_sectionDownloadHistory, JSON.stringify(this.sectionDownloadHistory));
    },
  },
});
