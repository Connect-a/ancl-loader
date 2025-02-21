import { storage } from 'webextension-polyfill';
import { defineStore } from 'pinia';

const key = 'additionalData';

type AdditionalData = {
  type: 'radio' | 'voice' | 'story';
  charaId: string;
  charaName: string;
  stid: number;
  storyId: string;
};

export const useAdditionalDataStore = defineStore('additionalDataStore', {
  state: () => ({
    additionalData: [] as Array<AdditionalData>,
  }),
  getters: {
    radioAdditionalData: (state) => state.additionalData.filter((x) => x.type === 'radio'),
    voiceAdditionalData: (state) => state.additionalData.filter((x) => x.type === 'voice'),
    storyAdditionalData: (state) => state.additionalData.filter((x) => x.type === 'story'),
  },
  actions: {
    async init() {
      this.additionalData = ((await storage.local.get(key))?.additionalData ?? []) as Array<AdditionalData>;
    },
    async setAdditionalData(charaImportUrl: string) {
      if (charaImportUrl) localStorage.setItem('charaImportUrl', charaImportUrl);

      charaImportUrl = localStorage.getItem('charaImportUrl') ?? '';
      const charaList = (await (await fetch(charaImportUrl)).text()).split('\n');
      if (charaList.length <= 1) return;

      await storage.local.set({
        additionalData: charaList.map((x) => {
          const [charaId, charaName, stid, storyId] = x.split('_');
          let t = 'story';
          if (charaId === 'voice') t = 'voice';
          if (charaId === 'radio') t = 'radio';
          return {
            type: t,
            charaId,
            charaName,
            stid: Number(stid),
            storyId,
          } as AdditionalData;
        }),
      });
      this.additionalData.splice(0);
      this.additionalData.push(...(((await storage.local.get(key))?.additionalData ?? []) as Array<AdditionalData>));
    },
  },
});
