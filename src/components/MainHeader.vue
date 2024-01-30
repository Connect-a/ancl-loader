<script setup lang="ts">
import { mdiGithub, mdiPlay, mdiOpenInNew, mdiRestart } from '@mdi/js';
import { runtime } from 'webextension-polyfill';
import { useRoute } from 'vue-router';
import { useMainStore } from '@/store';

const route = useRoute();
const mainStore = useMainStore();
const version = __APP_VERSION__;

const routeNameMap = new Map<string, string>([
  ['Home', 'キャラクター'],
  ['Story', 'メインストーリー'],
  ['EventStory', 'イベントストーリー'],
  ['Asmr', 'ASMR'],
  ['Player', 'プレイヤー'],
  ['Others', 'そのた'],
]);
</script>

<template>
  <v-app-bar app v-bind="$attrs">
    <v-app-bar-title class="font-weight-bold">エンクリローダー {{ version }}</v-app-bar-title>
    <v-spacer></v-spacer>
    <v-menu rounded offset-x offset-y close-on-click>
      <template v-slot:activator="on">
        <v-btn :disabled="!mainStore.loaded" v-bind="on.props" variant="outlined" class="mx-2">
          ▼{{ routeNameMap.get(route.name?.toString() ?? 'Home') }}</v-btn
        >
      </template>

      <v-list>
        <v-list-item :to="{ name: 'Home' }">
          <v-list-item-title>{{ routeNameMap.get('Home') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'Story' }">
          <v-list-item-title>{{ routeNameMap.get('Story') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'EventStory' }">
          <v-list-item-title>{{ routeNameMap.get('EventStory') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'Asmr' }">
          <v-list-item-title>{{ routeNameMap.get('Asmr') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'Others' }">
          <v-list-item-title>{{ routeNameMap.get('Others') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <template v-slot:append>
      <v-btn href="https://github.com/Connect-a/ancl-loader" target="_blank" :icon="mdiGithub" />
      <v-btn :to="{ name: 'Player' }" :icon="mdiPlay" color="blue" />
      <v-btn
        :href="`chrome-extension://${runtime.id}/index.html`"
        target="_blank"
        :icon="mdiOpenInNew"
        color="green"
        title="タブで開く"
      />
      <v-btn
        v-show="!mainStore.isAwaitGameData"
        @click="
          () => {
            mainStore.awaitRestore();
            $router.push({ name: 'Home' });
          }
        "
        :icon="mdiRestart"
        color="cyan"
        title="再読み込み待ち受け開始"
      />
      <v-progress-circular
        v-show="mainStore.isAwaitGameData"
        indeterminate
        :size="20"
        title="リロード待ち受け中…"
        @click="mainStore.cancelRestore"
      />
    </template>
  </v-app-bar>
</template>

<style>
.v-toolbar-title__placeholder {
  overflow: initial !important;
}
</style>
