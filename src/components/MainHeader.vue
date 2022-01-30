<template>
  <v-app-bar app color="deep-purple accent-4" style="font-size:1.5em">
    <v-app-bar-title class="font-weight-bold">エンクリローダー 0.9.9</v-app-bar-title>

    <v-spacer></v-spacer>
    <v-menu rounded offset-x offset-y close-on-click>
      <template v-slot:activator="on">
        <v-btn
          :disabled="!props.enable || !loaded"
          v-bind="on.props"
          color="primary"
          dark
          class="mx-2"
        >▼{{ routeNameMap.get(route.name?.toString() ?? 'Home') }}</v-btn>
      </template>

      <v-list color="deep-purple accent-1" class="text-white">
        <v-list-item :to="{ name: 'Home' }">
          <v-list-item-title>{{ routeNameMap.get('Home') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'Story' }">
          <v-list-item-title>{{ routeNameMap.get('Story') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'EventStory' }">
          <v-list-item-title>{{ routeNameMap.get('EventStory') }}</v-list-item-title>
        </v-list-item>
        <v-list-item :to="{ name: 'Others' }">
          <v-list-item-title>{{ routeNameMap.get('Others') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-btn href="https://github.com/Connect-a/ancl-loader" target="_blank" icon color="transparent">
      <Icon icon="mdi:github" />
    </v-btn>

    <v-btn :to="{ name: 'Player' }" icon color="blue" class="mx-2">
      <Icon icon="mdi:play" />
    </v-btn>
    <v-btn
      :href="`chrome-extension://${extensionId}/popup.html`"
      target="_blank"
      icon
      color="green"
      class="mx-2"
    >
      <Icon icon="mdi:fullscreen" />
    </v-btn>
    <v-btn
      @click="emit('clickPowerButton')"
      icon
      :color="props.enable ? 'cyan' : ''"
      :variant="props.enable ? `contained` : `outlined`"
      class="mx-2"
    >
      <Icon icon="mdi:power" />
    </v-btn>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import * as browser from "webextension-polyfill";
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { AllStories, Characters } from '@/@types';

const extensionId = chrome.runtime.id;
const route = useRoute();
const state = reactive({
  stories: await browser.runtime.sendMessage({ type: "getStories" }) as AllStories,
  characters: await browser.runtime.sendMessage({ type: "getCharacters" }) as Characters
});

const loaded = computed(() => !!(state.characters?.chara_data && state.stories?.chara?.story));

const routeNameMap = new Map<string, string>([
  ['Home', 'キャラクター'],
  ['Story', 'メインストーリー'],
  ['EventStory', 'イベントストーリー'],
  ['Others', 'そのた'],
  ['Player', 'プレイヤー'],
]);

const props = defineProps<{ enable: boolean; }>();
const emit = defineEmits<{
  (e: "clickPowerButton"): void;
}>();
</script>
