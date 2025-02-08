import { defineStore } from 'pinia';
import { detachAll, setUpChrome } from '@/scripts/readResponse/chrome/catchResponse';
import { storage } from 'webextension-polyfill';
import type { AllStories, BattleEvent, Characters, Enemy, InitData, Radio, SpecificVoice, Voice } from '@/@types';
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
      state.token !== '' &&
      state.initData !== undefined &&
      state.specificVoice !== undefined &&
      state.characters !== undefined &&
      state.stories !== undefined &&
      state.enemy !== undefined &&
      state.battleEvent !== undefined &&
      state.radio !== undefined &&
      state.voice !== undefined,
  },
  actions: {
    async init() {
      this.token = (await storage.local.get('token')).token as string;
      this.initData = (await storage.local.get('initData')).initData as InitData;
      this.specificVoice = (await storage.local.get('specificVoice')).specificVoice as Array<SpecificVoice>;
      this.characters = (await storage.local.get('characters')).characters as Characters;
      this.stories = (await storage.local.get('stories')).stories as AllStories;
      this.enemy = (await storage.local.get('enemy')).enemy as Enemy;
      this.battleEvent = (await storage.local.get('battleEvent')).battleEvent as BattleEvent;
      this.radio = (await storage.local.get('radio')).radio as Radio;
      this.voice = (await storage.local.get('voice')).voice as Voice;
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
      await this.clear();
      await storage.local.set({ isAwaitGameData: true });
      this.isAwaitGameData = true;
      await setUpChrome();
    },
    async cancelRestore() {
      this.isAwaitGameData = false;
      await storage.local.set({ isAwaitGameData: false });
      await detachAll();
    },
  },
});
