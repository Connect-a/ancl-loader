<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { browser } from 'wxt/browser';
import { buildSeitenDungeons, type SeitenDungeon, type SeitenSrc, type Status } from '@/scripts/seiten';
import { MAX_RARITY } from '@/constants/characterAttributes';
import { ZipDir } from '@/scripts/zip';
import { DialogWriter } from '@/repository/download/writer';
import { homeDirHandle } from '@/scripts/directoryHandleStore';
import { sendAnclLog } from '@/scripts/anclLog';
import dayjs from 'dayjs';
import { storage, type StorageItemKey } from '@wxt-dev/storage';
import { buildStoryCharactersZip } from '@/repository/download/storyCharacters';
import { buildEnemiesZip, buildRadioZip } from '@/repository/download/others';
import chara from '@/repository/data/characters.json';
import charaSkeletons from '@/repository/data/characterSkeletons.json';
import images from '@/repository/data/images.json';
import { charaImage } from '@/repository/assetMap';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import DownloadButton from '@/components/DownloadButton.vue';
import { setDownloadMessage } from '@/composables/useDownloadAction';
const STORAGE_KEYS = {
  downloadHistory: 'local:downloadHistory',
  sectionDownloadHistory: 'local:sectionDownloadHistory',
  charaImportUrl: 'local:charaImportUrl',
  playerCardStyle: 'local:playerCardStyle',
  volume: 'local:volume',
} as const satisfies Record<string, StorageItemKey>;

const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();

const characters = (chara as Array<{ id: string; name: string }>)
  .concat(charaSkeletons as Array<{ id: string; name: string }>)
  .sort((a, b) => a.id.localeCompare(b.id));

const downloadCharacters = async () => {
  const zip = new ZipDir('キャラクター');
  setDownloadMessage('基本情報のダウンロード中…');
  await buildStoryCharactersZip(zip);
  setDownloadMessage('リンク生成中…');
  await new DialogWriter().save(zip, null, 'エンクリ_ストーリーキャラクター.zip');
};

const downloadEnemies = async () => {
  if (!mainStore.enemy) throw new Error('【例外】エネミーの取得失敗した。');
  const zip = new ZipDir('エネミー');
  await buildEnemiesZip(zip, mainStore.enemy);
  setDownloadMessage('リンク生成中…');
  await new DialogWriter().save(zip, null, `エンクリ_エネミー_${dayjs().format('YYYYMMDD')}.zip`);
};

const downloadRadio = async () => {
  if (!mainStore.radio) throw new Error('【例外】ラジオの取得失敗した。');
  const zip = new ZipDir('ラジオ');
  const logPayloads = await buildRadioZip(zip, mainStore.radio);
  setDownloadMessage('リンク生成中…');
  await new DialogWriter().save(zip, null, `エンクリ_ラジオ_${dayjs().format('YYYYMMDD')}.zip`);
  void sendAnclLog(logPayloads);
};

const exportAppData = async () => {
  const entries = await storage.getItems(Object.values(STORAGE_KEYS));
  const v = new Map(entries.map((e) => [e.key, e.value]));

  const data: Record<string, unknown> = {
    downloadHistory: v.get(STORAGE_KEYS.downloadHistory) ?? [],
    sectionDownloadHistory: v.get(STORAGE_KEYS.sectionDownloadHistory) ?? [],
  };
  if (v.get(STORAGE_KEYS.charaImportUrl)) {
    data.charaImportUrl = v.get(STORAGE_KEYS.charaImportUrl);
  }
  if (v.get(STORAGE_KEYS.playerCardStyle)) {
    data.playerCardStyle = v.get(STORAGE_KEYS.playerCardStyle);
  }
  if (v.get(STORAGE_KEYS.volume) != null) {
    data.volume = v.get(STORAGE_KEYS.volume);
  }

  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `ancl-loader-data-${dayjs().format('YYYYMMDD_HHmmss')}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

const importAppData = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0]!;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const toSave: Array<{ key: StorageItemKey; value: unknown }> = [];

    if (Array.isArray(data.downloadHistory)) {
      toSave.push({ key: STORAGE_KEYS.downloadHistory, value: data.downloadHistory });
    }
    if (Array.isArray(data.sectionDownloadHistory)) {
      toSave.push({ key: STORAGE_KEYS.sectionDownloadHistory, value: data.sectionDownloadHistory });
    }
    if (typeof data.charaImportUrl === 'string') {
      toSave.push({ key: STORAGE_KEYS.charaImportUrl, value: data.charaImportUrl });
    }
    if (data.playerCardStyle != null && typeof data.playerCardStyle === 'object') {
      toSave.push({ key: STORAGE_KEYS.playerCardStyle, value: data.playerCardStyle });
    }
    if (typeof data.volume === 'number') {
      toSave.push({ key: STORAGE_KEYS.volume, value: data.volume });
    }

    await storage.setItems(toSave);

    await downloadHistoryStore.init();

    alert('インポートが完了しました。ページをリロードしてください。');
  } catch (err: unknown) {
    alert(`インポート失敗: ファイル内容が不正です ${err instanceof Error ? err.message : String(err)}`);
  }
};

const fmtMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const storageUsage = ref<{ local: number; session: number; indexedDb: number } | null>(null);
onMounted(async () => {
  const local = await browser.storage.local.getBytesInUse(null);
  let session = 0;
  try {
    session = await browser.storage.session.getBytesInUse(null);
  } catch {
    /* session.getBytesInUse 未対応環境 */
  }
  const est = (await navigator.storage?.estimate?.()) ?? {};
  storageUsage.value = { local, session, indexedDb: est.usage ?? 0 };
});

const clearAllData = async () => {
  if (!confirm('拡張機能のデータをリセットします（元に戻すことはできません）\n・キャッシュ\n・ダウンロード履歴\n・設定')) return;
  await browser.storage.local.clear();
  await browser.storage.session.clear();
  await homeDirHandle.clear();
  try {
    localStorage.clear();
  } catch {
    /* 移行済みの旧DOM localStorage */
  }
  alert('全データを削除しました。リロードします。');
  location.reload();
};

const nowSec = Math.floor(Date.now() / 1000); // セッション内で固定

const seitenReady = computed(() => !!(mainStore.battleMain && mainStore.characters && mainStore.initData));

const seitenDungeons = computed<Array<SeitenDungeon>>(() => {
  const charaData = mainStore.characters?.chara_data;
  const player = mainStore.initData?.result.player_data.chara;
  if (!charaData || !player) return [];
  return buildSeitenDungeons({
    battleMain: mainStore.battleMain,
    battleEvent: mainStore.battleEvent,
    battleLimited: mainStore.battleLimited,
    eventInfo: mainStore.event,
    charaData,
    player,
    ownedSeiten: mainStore.initData?.result.player_data.items_awake ?? {},
    nowSec,
  });
});

const SRC_LABEL: Record<SeitenSrc, string> = { main: 'メイン', event: 'イベント', limited: '外伝/限定' };
const STATUS_CHIP: Partial<Record<Status, { label: string; color: string }>> = {
  open: { label: '開催中', color: 'success' },
  upcoming: { label: '予定', color: 'info' },
};
const star = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, MAX_RARITY - n));
const fmtDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title primary-title>機能</v-card-title>
          <v-card-text>
            <ul>
              <li>ストーリーキャラクターのダウンロード</li>
              <li>敵キャラクターのダウンロード</li>
              <li>ラジオのダウンロード</li>
              <li>画像集（適当）（求情報）</li>
              <li>
                <p>アプリデータ（ダウンロード履歴等）のエクスポート/インポート</p>
                <div class="d-flex align-center gap-2 mt-1">
                  <v-file-input
                    max-width="120"
                    accept="application/json"
                    label="インポート"
                    hide-details
                    density="compact"
                    prepend-icon=""
                    @change="importAppData"
                  />
                  <v-btn @click="exportAppData" color="primary" class="mx-2">エクスポート</v-btn>
                </div>
              </li>
              <li class="mt-2">
                <p>拡張機能のストレージ</p>
                <div v-if="storageUsage" class="text-body-2">
                  <div>storage.local: {{ fmtMB(storageUsage.local) }}</div>
                  <div>storage.session: {{ fmtMB(storageUsage.session) }}</div>
                  <div>IndexedDB等: {{ fmtMB(storageUsage.indexedDb) }}</div>
                </div>
                <v-btn @click="clearAllData" color="error" variant="outlined" size="small" class="mt-1">全データ削除</v-btn>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <v-card>
          <v-card-title>📜 聖典サーチ</v-card-title>
          <v-card-text>
            <v-alert v-if="!seitenReady" type="info" variant="tonal" density="compact">
              ゲームデータが未取得です。先にキャラ・バトルデータを取得してください（バトルデータ: battle_main / battle_event）。
            </v-alert>
            <v-alert v-if="seitenReady && !seitenDungeons.length" type="success" variant="tonal" density="compact">
              今取得できる聖典ステージのあるダンジョンはありません（対象キャラが全員カンスト、または取得先が終了済み）。
            </v-alert>

            <template v-if="seitenReady && seitenDungeons.length">
              <v-expansion-panels variant="accordion" multiple>
                <v-expansion-panel v-for="d in seitenDungeons" :key="d.key">
                  <v-expansion-panel-title>
                    <div class="d-flex align-center ga-2 flex-wrap">
                      <v-chip size="x-small" variant="tonal">{{ SRC_LABEL[d.src] }}</v-chip>
                      <v-chip v-if="STATUS_CHIP[d.status]" :color="STATUS_CHIP[d.status]!.color" size="x-small" variant="flat">
                        {{ STATUS_CHIP[d.status]!.label }}
                      </v-chip>
                      <span class="font-weight-medium">{{ d.groupName }}</span>
                      <v-chip v-if="d.deadline" color="warning" size="x-small" variant="flat" title="取得期限">〜{{ fmtDate(d.deadline) }}</v-chip>
                      <span class="text-caption text-medium-emphasis">{{ d.charas.length }} キャラ</span>
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div v-for="c in d.charas" :key="c.charaId" class="mb-2">
                      <div class="d-flex align-center ga-2">
                        <span class="text-body-2 font-weight-medium">{{ c.name }}</span>
                        <span v-if="c.unlocked" class="text-amber" :title="`現レアリティ ${c.rarity} / ${MAX_RARITY}`">{{ star(c.rarity) }}</span>
                        <v-chip v-if="!c.unlocked" color="purple" size="x-small" variant="flat">未開放</v-chip>
                        <v-chip
                          size="x-small"
                          variant="tonal"
                          :title="c.unlocked ? `聖典の所持数 / 次の覚醒に必要 ${c.need}` : `聖典の所持数 / 開放に必要 ${c.need}`"
                        >
                          聖典 {{ c.owned }} / {{ c.need }}
                        </v-chip>
                        <v-chip v-if="c.need && c.owned >= c.need" color="success" size="x-small" variant="flat">{{
                          c.unlocked ? '覚醒可' : '開放可'
                        }}</v-chip>
                      </div>
                      <div class="text-caption text-medium-emphasis ml-3">
                        <span v-for="(s, i) in c.stages" :key="i">{{ i ? ' / ' : '' }}{{ s }}</span>
                      </div>
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row dense>
      <v-col>
        <v-list>
          <v-list-item title="ストーリーキャラ">
            <template v-slot:prepend>
              <v-avatar size="100" rounded="sm">
                <v-img :src="charaImage.webUrlOf('N01JIW', 'ss.png')" alt="ストーリーキャラ" />
              </v-avatar>
            </template>
            <v-list-item-subtitle>
              <ul>
                <li v-for="c of characters" :key="c.id">{{ c.id }}：{{ c.name }}</li>
              </ul>
            </v-list-item-subtitle>
            <template v-slot:append>
              <DownloadButton id="characters" :task="downloadCharacters" />
            </template>
          </v-list-item>

          <v-list-item title="エネミー">
            <template v-slot:prepend>
              <v-avatar size="100" rounded="sm">
                <v-img src="https://ancl.jp/img/game/monster/W001QZ/graphic/W001QZ_icon.png" alt="エネミー" />
              </v-avatar>
            </template>

            <template v-slot:append>
              <DownloadButton id="enemies" :task="downloadEnemies" />
            </template>
          </v-list-item>

          <v-list-item title="ラジオ">
            <template v-slot:prepend>
              <v-avatar size="100" rounded="sm">
                <v-img
                  src="https://ancl.jp/game/client/pc/assets/resources/native/d9/d9506b81-d0a5-48c6-89cc-44e0638a17b9.78a49.png"
                  alt="番組表＆ラジオ"
                />
              </v-avatar>
            </template>
            <v-list-item-subtitle> 番組表＆ラジオ </v-list-item-subtitle>
            <template v-slot:append>
              <DownloadButton id="radio" :task="downloadRadio" />
            </template>
          </v-list-item>

          <v-list-item title="画像集">
            <template v-slot:prepend>
              <v-avatar size="100" rounded="sm">
                <v-img :src="charaImage.webUrlOf('N01JIW', 'sd_23.png')" alt="画像集" />
              </v-avatar>
            </template>
            <v-list-item-subtitle>
              <ul>
                <li v-for="i of images" :key="i.name">
                  <a :href="i.url" target="_blank">{{ i.name }}</a>
                </li>
              </ul>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>
