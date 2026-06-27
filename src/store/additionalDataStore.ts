import { defineStore } from 'pinia';
import { storage } from '@wxt-dev/storage';
import { sendMessage } from '@/scripts/extMessage';
import type { AdditionalRecord, StoryRecord, VoiceRecord } from '@/scripts/anclData';

export const useAdditionalDataStore = defineStore('additionalDataStore', {
  state: () => ({
    additionalData: [] as Array<AdditionalRecord>,
    charaImportUrl: '',
  }),
  getters: {
    voiceAdditionalData: (state) => state.additionalData.filter((x): x is VoiceRecord => x.type === 'voice'),
    storyAdditionalData: (state) => state.additionalData.filter((x): x is StoryRecord => x.type === 'story'),
  },
  actions: {
    async init() {
      const [add, url] = await storage.getItems(['local:additionalData', 'local:charaImportUrl']);
      this.additionalData = (add?.value ?? []) as Array<AdditionalRecord>;
      this.charaImportUrl = (url?.value as string) ?? '';
    },
    async setAdditionalData() {
      if (!this.charaImportUrl) return;
      await storage.setItem('local:charaImportUrl', this.charaImportUrl);

      try {
        const response = await fetch(this.charaImportUrl);
        if (!response.ok) {
          console.warn(`additionalData fetch failed: ${response.status}`);
          return;
        }
        const charaList = (await response.text()).split('\n');
        if (charaList.length <= 1) return;

        const parsed = charaList.map((x): AdditionalRecord => {
          const [c1 = '', c2 = '', c3 = '', c4 = ''] = x.split('_');
          if (c1 === 'voice') return { type: 'voice', sectionId: c2, chId: Number(c3), chapterId: c4 };
          return { type: c1 === 'radio' ? 'radio' : 'story', charaId: c1, charaName: c2, stid: Number(c3), storyId: c4 };
        });
        await sendMessage('additionalData/add', parsed);
      } catch (e: unknown) {
        console.warn('additionalData fetch error:', e);
      }
    },
  },
});

storage.watch<Array<AdditionalRecord>>('local:additionalData', (v) => {
  useAdditionalDataStore().additionalData = v ?? [];
});
