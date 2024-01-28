import { storage } from 'webextension-polyfill';
import { defineStore } from 'pinia';

const key = 'additionalData';

export type AdditionalDataType = 'radio' | 'voice' | 'story';
export type AdditionalData = {
  type: AdditionalDataType;
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
      this.additionalData = (await storage.local.get(key))?.additionalData ?? [];
    },
    async setAdditionalData(stories: Array<AdditionalData>) {
      await storage.local.set({ additionalData: stories });
      this.additionalData.splice(0);
      this.additionalData.push(...((await storage.local.get(key))?.additionalData ?? []));
    },
  },
});
