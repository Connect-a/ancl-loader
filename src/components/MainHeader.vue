<script setup lang="ts">
import { mdiGithub, mdiPlay, mdiFolderPlay, mdiOpenInNew, mdiRestart, mdiInformation, mdiStop, mdiPackageUp, mdiKeyAlert } from '@mdi/js';
import { ref, onMounted } from 'vue';
import { browser } from 'wxt/browser';
import { useRoute } from 'vue-router';
import { useMainStore, TOKEN_ERROR_MESSAGE } from '@/store';
import { checkForUpdate, type UpdateInfo } from '@/scripts/updateCheck';

const route = useRoute();
const mainStore = useMainStore();
const version = __APP_VERSION__;

const updateInfo = ref<UpdateInfo | null>(null);
onMounted(async () => {
  updateInfo.value = await checkForUpdate();
});

const routeNameMap = new Map<string, string>([
  ['Home', 'キャラクター'],
  ['Story', 'ストーリー'],
  ['Asmr', 'ASMR'],
  ['Player', 'プレイヤー'],
  ['News', 'お知らせ'],
  ['Others', 'そのた'],
  ['FolderPlayer', 'フォルダプレイヤー'],
  ['BulkDownload', '一括ダウンロード'],
]);

const navRouteNames = ['Home', 'Story', 'Asmr', 'Others'] as const;
</script>

<template>
  <v-app-bar app v-bind="$attrs">
    <v-app-bar-title class="font-weight-bold d-none d-sm-flex">エンクリローダー {{ version }}</v-app-bar-title>
    <v-spacer></v-spacer>
    <v-menu rounded offset-x offset-y close-on-click>
      <template v-slot:activator="on">
        <v-btn :disabled="!mainStore.loaded" v-bind="on.props" variant="outlined" class="mx-2">
          ▼{{ routeNameMap.get(route.name?.toString() ?? 'Home') }}</v-btn
        >
      </template>

      <v-list>
        <v-list-item v-for="name in navRouteNames" :key="name" :to="{ name }">
          <v-list-item-title>{{ routeNameMap.get(name) }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <template v-slot:append>
      <v-btn
        v-if="updateInfo"
        :href="updateInfo.releaseUrl"
        target="_blank"
        :icon="mdiPackageUp"
        color="amber"
        class="update-pulse"
        :title="`新しいバージョン ${updateInfo.latestVersion} があります`"
      />
      <v-btn href="https://github.com/Connect-a/ancl-loader" target="_blank" :icon="mdiGithub" />
      <v-btn :to="{ name: 'Player' }" :icon="mdiPlay" color="blue" title="プレイヤー" />
      <v-btn :to="{ name: 'FolderPlayer' }" :icon="mdiFolderPlay" color="blue" title="フォルダプレイヤー" />
      <v-btn :to="{ name: 'News' }" :icon="mdiInformation" color="blue" />
      <v-btn
        :href="`chrome-extension://${browser.runtime.id}/popup.html#${route.fullPath}`"
        target="_blank"
        :icon="mdiOpenInNew"
        color="green"
        title="タブで開く"
      />
      <v-chip
        v-if="mainStore.tokenState === 'error'"
        size="small"
        variant="flat"
        color="error"
        :prepend-icon="mdiKeyAlert"
        :title="TOKEN_ERROR_MESSAGE"
        class="mr-2"
      >
        要再読込
      </v-chip>
      <v-btn
        v-if="!mainStore.isAwaitGameData"
        icon
        color="cyan"
        title="再読み込み待ち受け開始"
        @click="
          async () => {
            await mainStore.awaitRestore();
            $router.push({ name: 'Home' });
          }
        "
      >
        <v-icon>{{ mdiRestart }}</v-icon>
      </v-btn>
      <v-btn
        v-if="mainStore.isAwaitGameData"
        icon
        color="red-lighten-1"
        title="リロード待ち受け中。クリックでキャンセル。"
        @click="mainStore.cancelRestore"
      >
        <v-progress-circular indeterminate :size="24" :width="2" color="white" />
        <v-icon size="12" class="position-absolute">{{ mdiStop }}</v-icon>
      </v-btn>
    </template>
  </v-app-bar>
</template>

<style>
.v-toolbar-title__placeholder {
  overflow: initial !important;
}

@keyframes ancl-update-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.update-pulse {
  animation: ancl-update-pulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .update-pulse {
    animation: none;
  }
}
</style>
