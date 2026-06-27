<script setup lang="ts">
import { onMounted, ref, watch, type Ref } from 'vue';
import { storage } from '@wxt-dev/storage';
import type { ZipEntry, SortMode } from './types';
import ZipEntryGrid from './ZipEntryGrid.vue';
import EntryPlayer from '@/components/EntryPlayer.vue';
import HomeDirSelect from '@/components/HomeDirSelect.vue';
import DownloadConfirmButton from '@/components/DownloadConfirmButton.vue';
import { useHomeDir } from '@/composables/useHomeDir';
import { downloadSharedResources } from '@/repository/download/story';
import { DirectoryWriter, DialogWriter } from '@/repository/download/writer';
import { runStoryCharactersDownload, runScannedStoryCharasDownload, fetchMergedCharacterList } from '@/repository/download/storyCharacters';
import { scanStoryCharas } from '@/components/storyPlayer/utils/scanStoryCharas';
import { createThumbnailLoader } from './utils/thumbnailLoader';

type EntryListConfig = { sortMode?: SortMode; cacheThumbnails?: boolean };
const entryListConfigItem = storage.defineItem<EntryListConfig>('local:entryListConfig');

type DlState =
  | { status: 'idle' }
  | { status: 'downloading' }
  | { status: 'done'; total: number; failed: number; skipped?: number }
  | { status: 'error'; message: string };

const home = useHomeDir();
const thumbnailLoader = createThumbnailLoader();

const sortMode = ref<SortMode>('name');
const selectedEntry = ref<ZipEntry | null>(null);
const dlSharedState = ref<DlState>({ status: 'idle' });
const dlStoryCharsState = ref<DlState>({ status: 'idle' });
const dlStoryCharsProgress = ref<{ done: number; total: number; label: string } | null>(null);
const dlScannedNpcState = ref<DlState>({ status: 'idle' });
const dlScannedNpcProgress = ref<{ phase: 'scan' | 'dl'; done: number; total: number; label: string } | null>(null);
const scannedNpcOverwrite = ref(false);
const storyCharsOverwrite = ref(false);

onMounted(async () => {
  const cfg = await entryListConfigItem.getValue();
  if (cfg?.sortMode) sortMode.value = cfg.sortMode;
  if (cfg?.cacheThumbnails === false) await thumbnailLoader.disableCache();
});

const prepareForScan = () => {
  selectedEntry.value = null;
};

const runScan = async (scan: () => Promise<void>) => {
  prepareForScan();
  await scan();
};

// entries追従でcacheDir準備＋不在idの破棄。空配列もprepareに畳まれる
watch(
  () => home.entries.value,
  (list) => void thumbnailLoader.prepare(list, home.usableRoot.value),
  { immediate: true },
);

const reloadDirectory = () => runScan(() => home.reload());

// root確定時のみロード（cold時の二重スキャン回避）
watch(
  () => home.usableRoot.value,
  (root) => {
    if (root) void runScan(() => home.loadEntries());
    else selectedEntry.value = null;
  },
  { immediate: true },
);

const clearDirectory = async () => {
  prepareForScan();
  await home.clear();
};

const onEntrySelect = (entry: ZipEntry) => {
  selectedEntry.value = entry;
};

const onBack = () => {
  selectedEntry.value = null;
};

const persistConfig = () => void entryListConfigItem.setValue({ sortMode: sortMode.value, cacheThumbnails: thumbnailLoader.cacheEnabled.value });

const onSortModeChange = (mode: SortMode) => {
  sortMode.value = mode;
  persistConfig();
};

const onToggleCache = async () => {
  if (thumbnailLoader.cacheEnabled.value) {
    if (!window.confirm('サムネイルキャッシュをオフにします。保存済みのキャッシュ（.thumbnailsフォルダ）を削除します。よろしいですか？')) return;
    await thumbnailLoader.disableCache();
  } else {
    await thumbnailLoader.enableCache();
  }
  persistConfig();
};

const runDownload = async (state: Ref<DlState>, fn: () => Promise<{ total: number; failed: number }>) => {
  state.value = { status: 'downloading' };
  try {
    state.value = { status: 'done', ...(await fn()) };
  } catch (e) {
    state.value = { status: 'error', message: `ダウンロードエラー: ${e instanceof Error ? e.message : String(e)}` };
  }
};
// ホームDir設定時は `_共有リソース/` へ自動保存、未設定はダウンロードダイアログ
const downloadShared = () =>
  runDownload(dlSharedState, async () => {
    const root = home.usableRoot.value;
    const r = await downloadSharedResources(root ? new DirectoryWriter(root) : new DialogWriter());
    void reloadDirectory();
    return r;
  });

const downloadStoryChars = async () => {
  let root = home.usableRoot.value;
  if (!root) {
    // 未設定時はフォルダ選択にフォールバック（キャンセル/未対応はnull）
    root = await home.pickDirectory();
    if (!root) return;
  }
  dlStoryCharsState.value = { status: 'downloading' };
  dlStoryCharsProgress.value = { done: 0, total: 0, label: '' };
  try {
    const exclude = storyCharsOverwrite.value ? new Set<string>() : home.charaIds.value;
    const result = await runStoryCharactersDownload(new DirectoryWriter(root), exclude, (done, total, label) => {
      dlStoryCharsProgress.value = { done, total, label };
    });
    dlStoryCharsState.value = { status: 'done', ...result };
    void reloadDirectory();
  } catch (e) {
    dlStoryCharsState.value = { status: 'error', message: `ダウンロードエラー: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    dlStoryCharsProgress.value = null;
  }
};

const executeScannedNpcDownload = async () => {
  let root = home.usableRoot.value;
  if (!root) {
    root = await home.pickDirectory();
    if (!root) return;
  }
  dlScannedNpcState.value = { status: 'downloading' };
  dlScannedNpcProgress.value = { phase: 'scan', done: 0, total: 0, label: '' };
  try {
    const masterIds = (await fetchMergedCharacterList()).map((c) => c.id);
    const exclude = scannedNpcOverwrite.value ? new Set<string>(masterIds) : new Set<string>([...home.charaIds.value, ...masterIds]);
    const missing = await scanStoryCharas(home.entries.value, exclude, (done, total) => {
      dlScannedNpcProgress.value = { phase: 'scan', done, total, label: '' };
    });
    if (!missing.size) {
      dlScannedNpcState.value = { status: 'done', total: 0, failed: 0 };
      return;
    }
    const result = await runScannedStoryCharasDownload(new DirectoryWriter(root), missing, (done, total, label) => {
      dlScannedNpcProgress.value = { phase: 'dl', done, total, label };
    });
    dlScannedNpcState.value = { status: 'done', ...result };
    void reloadDirectory();
  } catch (e) {
    dlScannedNpcState.value = { status: 'error', message: `ダウンロードエラー: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    dlScannedNpcProgress.value = null;
  }
};
</script>

<template>
  <v-container>
    <v-row dense>
      <v-col>
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>フォルダプレイヤー</span>
            <v-spacer />
            <DownloadConfirmButton
              label="共有リソースDL"
              title="共有リソースDL"
              :loading="dlSharedState.status === 'downloading'"
              @execute="downloadShared"
            >
              <template #description>
                ストーリーの共有リソース（BGM/SE/エモーティコン等）を取得し、ホームディレクトリの <code>_共有リソース/</code> に保存します。<br />
                ホームディレクトリ未設定時はファイル保存ダイアログで保存先を選びます。
              </template>
            </DownloadConfirmButton>
            <DownloadConfirmButton
              class="ml-2"
              label="ストーリーキャラDL"
              title="ストーリーキャラDL"
              :loading="dlStoryCharsState.status === 'downloading'"
              @open="storyCharsOverwrite = false"
              @execute="downloadStoryChars"
            >
              <template #description> ストーリー専用キャラ＋主人公を <code>_ストーリーキャラ/</code> 配下へ一括保存します。<br /> </template>
              <template #options>
                <v-checkbox v-model="storyCharsOverwrite" density="compact" hide-details label="上書き再DLする" />
              </template>
            </DownloadConfirmButton>
            <DownloadConfirmButton
              class="ml-2"
              label="登場NPC補完"
              title="登場NPC補完"
              :loading="dlScannedNpcState.status === 'downloading'"
              @open="scannedNpcOverwrite = false"
              @execute="executeScannedNpcDownload"
            >
              <template #description>
                ストーリーに登場するが通常のキャラ一覧に含まれないNPCのSD画像・参照ボイスを補完取得します。<br />
                ダウンロード済みのストーリーを走査して未取得のNPCを集め、 <code>_ストーリーキャラ/</code> 配下へ保存します。<br />
                ふる転キャラのストーリーに登場するNPCは ふる転扱いとして処理します。
              </template>
              <template #options>
                <v-checkbox v-model="scannedNpcOverwrite" density="compact" hide-details label="上書き再DLする" />
              </template>
            </DownloadConfirmButton>
          </v-card-title>
          <v-card-text>
            <HomeDirSelect />
            <v-alert
              v-if="dlSharedState.status === 'done'"
              :type="dlSharedState.failed ? 'warning' : 'success'"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              共有リソース: {{ dlSharedState.total }}件中{{ dlSharedState.total - dlSharedState.failed }}件成功<template v-if="dlSharedState.failed"
                >、{{ dlSharedState.failed }}件失敗</template
              >
            </v-alert>
            <v-alert v-if="dlSharedState.status === 'error'" type="error" variant="tonal" density="compact" class="mt-2">
              {{ dlSharedState.message }}
            </v-alert>
            <v-alert v-if="dlStoryCharsProgress" type="info" variant="tonal" density="compact" class="mt-2">
              ストーリーキャラDL中: {{ dlStoryCharsProgress.done }} / {{ dlStoryCharsProgress.total }}（{{ dlStoryCharsProgress.label }}）
              <v-progress-linear
                :model-value="dlStoryCharsProgress.total ? (dlStoryCharsProgress.done / dlStoryCharsProgress.total) * 100 : 0"
                class="mt-1"
              />
            </v-alert>
            <v-alert
              v-if="dlStoryCharsState.status === 'done'"
              :type="dlStoryCharsState.failed ? 'warning' : 'success'"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              ストーリーキャラ: {{ dlStoryCharsState.total }}件中{{ dlStoryCharsState.total - dlStoryCharsState.failed }}件成功<template
                v-if="dlStoryCharsState.failed"
                >、{{ dlStoryCharsState.failed }}件失敗</template
              >
            </v-alert>
            <v-alert v-if="dlStoryCharsState.status === 'error'" type="error" variant="tonal" density="compact" class="mt-2">
              {{ dlStoryCharsState.message }}
            </v-alert>
            <v-alert v-if="dlScannedNpcProgress" type="info" variant="tonal" density="compact" class="mt-2">
              {{ dlScannedNpcProgress.phase === 'scan' ? 'ストーリー走査中' : '登場NPC DL中' }}: {{ dlScannedNpcProgress.done }} /
              {{ dlScannedNpcProgress.total }}<template v-if="dlScannedNpcProgress.label">（{{ dlScannedNpcProgress.label }}）</template>
              <v-progress-linear
                :model-value="dlScannedNpcProgress.total ? (dlScannedNpcProgress.done / dlScannedNpcProgress.total) * 100 : 0"
                class="mt-1"
              />
            </v-alert>
            <v-alert
              v-if="dlScannedNpcState.status === 'done'"
              :type="dlScannedNpcState.failed ? 'warning' : 'success'"
              variant="tonal"
              density="compact"
              class="mt-2"
            >
              登場NPC: {{ dlScannedNpcState.total }}体中{{ dlScannedNpcState.total - dlScannedNpcState.failed }}体取得<template
                v-if="dlScannedNpcState.failed"
                >、{{ dlScannedNpcState.failed }}体失敗</template
              ><template v-if="dlScannedNpcState.total === 0">（補完対象なし）</template>
            </v-alert>
            <v-alert v-if="dlScannedNpcState.status === 'error'" type="error" variant="tonal" density="compact" class="mt-2">
              {{ dlScannedNpcState.message }}
            </v-alert>
            <v-alert v-if="home.error.value" type="error" variant="tonal" density="compact" class="mt-2">
              {{ home.error.value }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="!selectedEntry && home.entries.value.length" dense>
      <v-col>
        <ZipEntryGrid
          :entries="home.entries.value"
          :thumbnail-url-of="thumbnailLoader.urlOf"
          :request-thumbnail="thumbnailLoader.ensureThumbnail"
          :sort-mode="sortMode"
          :cache-thumbnails="thumbnailLoader.cacheEnabled.value"
          :reloading="home.isScanning.value"
          @update:sort-mode="onSortModeChange"
          @toggle-cache="onToggleCache"
          @select="onEntrySelect"
          @reload="reloadDirectory"
          @clear="clearDirectory"
        />
      </v-col>
    </v-row>

    <v-row v-if="selectedEntry" dense>
      <v-col>
        <EntryPlayer :entry="selectedEntry" :shared-zip="home.sharedZip.value" :chara-handle-map="home.charaHandleMap.value" @close="onBack" />
      </v-col>
    </v-row>
  </v-container>
</template>
