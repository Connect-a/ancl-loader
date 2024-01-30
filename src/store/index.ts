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
      !!state.token &&
      !!state.initData &&
      !!state.specificVoice &&
      !!state.characters &&
      !!state.enemy &&
      !!state.battleEvent &&
      !!state.radio &&
      !!state.voice,
  },
  actions: {
    async init() {
      this.token = (await storage.local.get('token')).token;
      this.initData = (await storage.local.get('initData')).initData;
      this.specificVoice = (await storage.local.get('specificVoice')).specificVoice;
      this.characters = (await storage.local.get('characters')).characters;
      this.stories = (await storage.local.get('stories')).stories;
      this.enemy = (await storage.local.get('enemy')).enemy;
      this.battleEvent = (await storage.local.get('battleEvent')).battleEvent;
      this.radio = (await storage.local.get('radio')).radio;
      this.voice = (await storage.local.get('voice')).voice;
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
      await storage.local.remove([
        'token',
        'initData',
        'specificVoice',
        'characters',
        'stories',
        'enemy',
        'battleEvent',
        'radio',
        'voice',
      ]);
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
