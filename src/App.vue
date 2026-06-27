<script setup lang="ts">
import { useRoute } from 'vue-router';
import MainHeader from './components/MainHeader.vue';
import MigrationDialog from './components/MigrationDialog.vue';
import { useMainStore } from './store';
import { useAdditionalDataStore } from './store/additionalDataStore';
import { useDownloadHistoryStore } from './store/downloadHistoryStore';
import { mdiChevronUp } from '@mdi/js';
import { ref, computed } from 'vue';
import { useGoTo } from 'vuetify';
import { checkMigrationNeeded } from '@/scripts/storageMigration';

const route = useRoute();
const goTo = useGoTo();
const mainStore = useMainStore();
const additionalDataStore = useAdditionalDataStore();
const downloadHistoryStore = useDownloadHistoryStore();

const showScrollTop = ref(false);
const showMigrationDialog = ref(false);
const initError = ref<string | null>(null);

// presenceは_rawの有無のみで判定しdecodeしない
const LOAD_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'token', label: 'トークン' },
  { key: 'initData', label: '初期データ' },
  { key: 'specificVoice', label: '固有ボイス' },
  { key: 'characters', label: 'キャラクター' },
  { key: 'stories', label: 'ストーリー' },
  { key: 'enemy', label: 'エネミー' },
  { key: 'battleEvent', label: 'バトルイベント' },
  { key: 'battleMain', label: 'バトルメイン' },
  { key: 'battleLimited', label: 'バトル限定/外伝' },
  { key: 'event', label: 'イベント情報' },
  { key: 'radio', label: 'ラジオ' },
  { key: 'voice', label: 'ASMR' },
];
const loadStatus = computed(() =>
  LOAD_FIELDS.map((f) => {
    const ok = mainStore.rawPresence[f.key];
    return { label: f.label, ok, loading: !ok && mainStore.capturingFields.includes(f.key) };
  }),
);
const pageReady = computed(() => (route.meta.requiredFields ?? []).every((k) => mainStore.rawPresence[k]));

const onScroll = () => (showScrollTop.value = window.scrollY > 300);
const handleMigrationComplete = () => {
  showMigrationDialog.value = false;
  window.location.reload();
};

(async () => {
  try {
    if (await checkMigrationNeeded()) {
      showMigrationDialog.value = true;
    } else {
      await Promise.all([mainStore.init(), additionalDataStore.init(), downloadHistoryStore.init()]);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    initError.value = msg;
    console.error('初期化エラー:', e);
  }
})();
</script>

<template>
  <Suspense>
    <v-app>
      <MainHeader />
      <v-main>
        <v-alert v-if="initError" type="error" variant="tonal" class="ma-4"> 初期化エラー: {{ initError }} </v-alert>

        <MigrationDialog v-if="showMigrationDialog" @migration-complete="handleMigrationComplete" />

        <template v-if="!showMigrationDialog && !initError">
          <v-container v-show="!pageReady">
            <v-row>
              <v-col>
                <v-card v-if="!pageReady && !mainStore.isAwaitGameData">
                  <v-card-title primary-title>🚨ヘッダーの情報更新ボタンを押すべき</v-card-title>
                </v-card>
                <v-card v-if="mainStore.isAwaitGameData">
                  <v-card-title primary-title>📡最新のゲームデータを待ち受け中…</v-card-title>
                  <v-card-text>
                    <p>エンジェリックリンクを開いて「ゲームスタート」してください。</p>
                    <ul>
                      <li>
                        <a href="https://play.games.dmm.com/game/angelic/" target="_blank" rel="noopener noreferrer">エンジェリックリンク</a>
                      </li>
                      <li>
                        <a href="https://play.games.dmm.co.jp/game/angelicr/" target="_blank" rel="noopener noreferrer">エンジェリックリンクR🔞</a>
                      </li>
                    </ul>
                    <div class="d-flex flex-wrap ga-1">
                      <v-chip
                        v-for="s in loadStatus"
                        :key="s.label"
                        size="x-small"
                        variant="flat"
                        :color="s.ok ? 'success' : s.loading ? 'info' : 'orange'"
                      >
                        <v-progress-circular v-if="s.loading" indeterminate size="10" width="2" class="mr-1" />
                        {{ s.label }}
                      </v-chip>
                    </div>
                    <p class="text-caption text-medium-emphasis mt-1 mb-0">
                      ※ 固有ボイスは再取得できたときのみ上書きされます（取得できなくても以前の値を保持）。
                    </p>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-container>

          <Suspense v-if="pageReady">
            <template #default>
              <router-view></router-view>
            </template>
            <template #fallback>Loading...</template>
          </Suspense>
        </template>
        <v-fab v-model="showScrollTop" v-scroll="onScroll" :icon="mdiChevronUp" color="primary" size="large" app appear @click="goTo(0)" />
      </v-main>
    </v-app>
    <template #fallback>Loading...</template>
  </Suspense>
</template>

<style scoped></style>

<style>
ul {
  padding-inline-start: 40px;
}

.v-theme--dark select {
  background-color: snow !important;
  color: dimgray !important;
}

.v-theme--light select {
  background-color: dimgray !important;
  color: snow !important;
}

select {
  width: 100% !important;
  appearance: auto !important;
}

.v-list-item-title {
  white-space: unset !important;
}

.v-list-item-subtitle {
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
}

summary {
  cursor: pointer;
}
</style>
