<script setup lang="ts">
import { useRoute } from 'vue-router';
import { storage } from 'webextension-polyfill';
import MainHeader from './components/MainHeader.vue';
import { useMainStore } from './store';
import { useAdditionalDataStore } from './store/additionalDataStore';
import { mdiCancel, mdiCheck } from '@mdi/js';
import { onBeforeUnmount } from 'vue';
const route = useRoute();
const mainStore = useMainStore();
const additionalDataStore = useAdditionalDataStore();
mainStore.init();
additionalDataStore.init();

// storage.localを監視し、変更があった時はmainStoreに反映する。
// mainStoreにデータが揃っているときはリストア完了を通知する。
storage.local.onChanged.addListener((changes) => {
  for (const key of Object.keys(changes)) {
    if (!changes[key].newValue) continue;
    mainStore.$patch({ [key]: changes[key].newValue });
  }
  if (mainStore.loaded) {
    mainStore.isAwaitGameData = false;
  }
});

onBeforeUnmount(mainStore.cancelRestore);
</script>

<template>
  <Suspense>
    <v-app>
      <MainHeader />
      <v-main>
        <v-container v-show="route.name?.toString() !== 'Player' && route.name?.toString() !== 'News' && !mainStore.loaded">
          <v-row>
            <v-col>
              <v-card v-if="!mainStore.loaded && !mainStore.isAwaitGameData">
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
                  <details>
                    <summary>ロード詳細</summary>
                    <v-banner density="compact" :icon="mainStore.token ? mdiCheck : mdiCancel" text="トークン"></v-banner>
                    <v-banner density="compact" :icon="mainStore.initData ? mdiCheck : mdiCancel" text="初期データ"></v-banner>
                    <v-banner density="compact" :icon="mainStore.specificVoice ? mdiCheck : mdiCancel" text="固有ボイス"></v-banner>
                    <v-banner density="compact" :icon="mainStore.characters ? mdiCheck : mdiCancel" text="キャラクター"></v-banner>
                    <v-banner density="compact" :icon="mainStore.stories ? mdiCheck : mdiCancel" text="ストーリー"></v-banner>
                    <v-banner density="compact" :icon="mainStore.enemy ? mdiCheck : mdiCancel" text="エネミー"></v-banner>
                    <v-banner density="compact" :icon="mainStore.battleEvent ? mdiCheck : mdiCancel" text="バトルイベント"></v-banner>
                    <v-banner density="compact" :icon="mainStore.radio ? mdiCheck : mdiCancel" text="ラジオ"></v-banner>
                    <v-banner density="compact" :icon="mainStore.voice ? mdiCheck : mdiCancel" text="ASMR"></v-banner>
                  </details>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>

        <Suspense v-show="route.name?.toString() === 'Player'">
          <template #default>
            <router-view></router-view>
          </template>
          <template #fallback>Loading...</template>
        </Suspense>
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
