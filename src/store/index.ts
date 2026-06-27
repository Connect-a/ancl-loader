import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { storage } from '@wxt-dev/storage';
import type { Story } from '@/@types';
import {
  anclDataFieldNames,
  requiredFieldNames,
  buildCharaEnableStidMap,
  buildEventEnableStidMap,
  buildMainEnableStidMap,
  buildSectionEventIdMap,
  type AnclDataField,
  type AnclDataTypeMap,
} from '@/scripts/anclData';
import { decodeBase64Msgpack } from '@/utils/msgpack';
import { sendMessage } from '@/scripts/extMessage';
import { useAdditionalDataStore } from './additionalDataStore';

export const TOKEN_ERROR_MESSAGE = 'トークンエラー：ヘッダーからゲーム情報の再読み込みを実施してください';

const decodeMsgpackAsRaw = <K extends keyof AnclDataTypeMap>(key: K, raw: string | null | undefined): AnclDataTypeMap[K] | undefined => {
  const decoded = decodeBase64Msgpack<AnclDataTypeMap[K] & object>(raw);
  if (raw && decoded === undefined) {
    console.error(`decodeMsgpackAsRaw: ${key} — decode failed (${raw.length} chars), removing corrupted data`);
    void storage.removeItem(`local:${key}`);
    return undefined;
  }
  return decoded ? markRaw(decoded) : undefined;
};

let _storageWatchersRegistered = false;

export const useMainStore = defineStore('main', {
  state: () => ({
    isAwaitGameData: false,
    failedToken: '',
    _raw: Object.fromEntries(anclDataFieldNames.map((k) => [k, ''])) as Record<AnclDataField, string>,
    capturingFields: [] as Array<string>,
  }),
  getters: {
    token: (state) => state._raw['token'] ?? '',
    tokenState: (state): 'none' | 'error' | 'ok' =>
      !state._raw['token'] ? 'none' : state.failedToken && state.failedToken === state._raw['token'] ? 'error' : 'ok',
    initData: (state) => decodeMsgpackAsRaw('initData', state._raw['initData']),
    characters: (state) => decodeMsgpackAsRaw('characters', state._raw['characters']),
    stories: (state) => decodeMsgpackAsRaw('stories', state._raw['stories']),
    enemy: (state) => decodeMsgpackAsRaw('enemy', state._raw['enemy']),
    battleEvent: (state) => decodeMsgpackAsRaw('battleEvent', state._raw['battleEvent']),
    battleMain: (state) => decodeMsgpackAsRaw('battleMain', state._raw['battleMain']),
    battleLimited: (state) => decodeMsgpackAsRaw('battleLimited', state._raw['battleLimited']),
    event: (state) => decodeMsgpackAsRaw('event', state._raw['event']),
    radio: (state) => decodeMsgpackAsRaw('radio', state._raw['radio']),
    voice: (state) => decodeMsgpackAsRaw('voice', state._raw['voice']),
    loaded: (state) => requiredFieldNames.every((k) => !!state._raw[k]),
    rawPresence: (state) => Object.fromEntries(anclDataFieldNames.map((k) => [k, !!state._raw[k]])) as Record<string, boolean>,
    // this参照のため通常関数（arrow不可）
    charaEnableStidMap(): Map<number, Story> {
      const stidSet = new Set(useAdditionalDataStore().storyAdditionalData.map((x) => x.stid));
      return buildCharaEnableStidMap(this.stories, this.initData, stidSet);
    },
    eventEnableStidMap(): Map<number, Story> {
      const storyList = { ...this.stories?.event.story, ...this.stories?.limited.story };
      const sectionOpened = { ...this.initData?.result.player_data.story.event, ...this.initData?.result.player_data.story.limited };
      const stidSet = new Set(useAdditionalDataStore().storyAdditionalData.map((x) => x.stid));
      return buildEventEnableStidMap(storyList, sectionOpened, stidSet);
    },
    mainEnableStidMap(): Map<number, Story> {
      return buildMainEnableStidMap(this.stories?.main.story ?? {}, this.initData?.result.player_data.story.main ?? {});
    },
    sectionEventIdMap(): Map<string, string> {
      return buildSectionEventIdMap(this.battleEvent);
    },
  },
  actions: {
    async init() {
      // chrome.storage.localはオブジェクトのIPC転送で9MB超データに約1秒かかる。
      // Base64文字列のまま保持しgetterで遅延デコードして初期化を高速化する。
      const entries = await storage.getItems([...anclDataFieldNames.map((k) => `local:${k}` as const), 'local:isAwaitGameData', 'local:failedToken']);
      const valueByKey = new Map(entries.map((e) => [e.key, e.value]));
      this.isAwaitGameData = !!valueByKey.get('local:isAwaitGameData');
      this.failedToken = (valueByKey.get('local:failedToken') as string) ?? '';
      this.capturingFields = (await storage.getItem<Array<string>>('session:capturing')) ?? [];

      for (const key of anclDataFieldNames) {
        const v = valueByKey.get(`local:${key}`);
        this._raw[key] = typeof v === 'string' ? v : '';
      }

      if (!_storageWatchersRegistered) {
        _storageWatchersRegistered = true;
        for (const key of anclDataFieldNames) {
          storage.watch<string>(`local:${key}`, (newValue) => {
            if (typeof newValue !== 'string' || !newValue) return;
            this._raw[key] = newValue;
            if (this.loaded) this.isAwaitGameData = false;
          });
        }
        storage.watch<string>('local:failedToken', (v) => (this.failedToken = typeof v === 'string' ? v : ''));
        storage.watch<Array<string>>('session:capturing', (v) => {
          this.capturingFields = Array.isArray(v) ? v : [];
        });
      }
    },
    async clear() {
      // specificVoiceはindex JSのHTTPキャッシュで再取得時に取れないことがあるため取得済みの値を保持する。
      const keysToClear = anclDataFieldNames.filter((k) => k !== 'specificVoice');
      for (const key of keysToClear) {
        this._raw[key] = '';
      }
      await storage.removeItems(keysToClear.map((k) => `local:${k}` as const));
      this.capturingFields = [];
      await storage.setItem('session:capturing', []);
    },
    async awaitRestore() {
      await this.clear();
      await storage.setItem('local:isAwaitGameData', true);
      this.isAwaitGameData = true;
      await sendMessage('capture/start');
    },
    async cancelRestore() {
      this.isAwaitGameData = false;
      this.capturingFields = [];
      await storage.setItem('local:isAwaitGameData', false);
      await storage.setItem('session:capturing', []);
      await sendMessage('capture/stop');
    },
  },
});
