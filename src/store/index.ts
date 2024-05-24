import { defineStore } from 'pinia';
import { runtime, storage } from 'webextension-polyfill';
import type {
  AllStories,
  BattleEvent,
  Characters,
  Enemy,
  InitData,
  Radio,
  SpecificVoice,
  Voice,
} from '@/@types';
import { anclDataFieldNames } from '@/scripts/anclDataFieldNames';

export const useMainStore = defineStore('main', {
  state: () => ({
    isAwaitGameData: false,
    token: '',
    initData: {} as InitData | undefined,
    specificVoice: {} as Array<SpecificVoice> | undefined,
    characters: {} as Characters | undefined,
    stories: {} as AllStories | undefined,
    enemy: {} as Enemy | undefined,
    battleEvent: {} as BattleEvent | undefined,
    radio: {} as Radio | undefined,
    voice: {} as Voice | undefined,
  }),
  getters: {
    loaded: (state) =>
      anclDataFieldNames.every((x) => !!((state as Record<string, any>)[x] as any)),
  },
  actions: {
    async init() {
      for (const x of anclDataFieldNames) {
        (this as Record<string, any>)[x] = (await storage.local.get(x))[x];
      }
    },
    async clear() {
      this.token = '';
      this.initData = undefined;
      this.specificVoice = undefined;
      this.characters = undefined;
      this.stories = undefined;
      this.enemy = undefined;
      this.battleEvent = undefined;
      this.radio = undefined;
      this.voice = undefined;
      await storage.local.remove(anclDataFieldNames);
    },
    async awaitRestore() {
      this.isAwaitGameData = true;
      await this.clear();
      await runtime.sendMessage('awaitGameData');
    },
    async cancelRestore() {
      this.isAwaitGameData = false;
      await runtime.sendMessage('cancelRestore');
    },
  },
});
