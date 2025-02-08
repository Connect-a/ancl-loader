<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ZipDir } from '@/scripts/zip';
import type { Section, StoryElement } from '@/@types';
import { downloadStory, downloadBg, fillStoryData } from '@/repository/downloadStory';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { useAdditionalDataStore } from '@/store/additionalDataStore';

const _eventAssetPath = `https://ancl.jp/img/game/asset/event`;
const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();
const additionalDataStore = useAdditionalDataStore();

const state = reactive({
  tab: 'event' as 'event' | 'limited',
  filterNotDownloadedYet: false,
  loadStatusMessage: '',
  workingSectionId: '',
});

const sectionEventIdMap = computed(
  () => new Map(Object.values(mainStore.battleEvent ?? {}).map((v) => [Object.entries(v.dungeons)[0][1].story_section, v.event_id])),
);

const storyList = computed(() => ({
  ...mainStore.stories?.event.story,
  ...mainStore.stories?.limited.story,
}));
const sectionOpenedMap = computed(
  () =>
    new Map<string, string>(
      Object.entries({
        ...mainStore.initData?.result?.player_data.story.event,
        ...mainStore.initData?.result?.player_data.story.limited,
      }),
    ),
);

const enableStidMap = computed(() => {
  if (!mainStore.stories) return new Map();
  if (!mainStore.initData) return new Map();

  return new Map(
    Object.entries(storyList.value).flatMap(([sectionId, stories]) =>
      stories
        .filter((s) => {
          if (additionalDataStore.storyAdditionalData.find((x) => x.stid === s.st_id)) return true;
          if (!sectionOpenedMap.value.has(sectionId)) return false;
          const open = Number.parseInt(sectionOpenedMap.value.get(sectionId)?.split('-')[1] ?? '0');
          return s.order <= open;
        })
        .map((s) => [s.st_id, s]),
    ),
  );
});

const items = computed(() => {
  let target = mainStore.stories?.event;
  if (state.tab === 'limited') target = mainStore.stories?.limited;

  return Object.values(target?.section ?? {})
    .sort((a, b) => a.section_id.localeCompare(b.section_id))
    .filter((x) => (state.filterNotDownloadedYet ? !downloadHistoryStore.sectionDownloadHistory.find((h) => h.id === x.section_id) : true))
    .map((x) => ({
      ...x,
      title: `${x.name} : ${x.section_id}`,
      subtitle: '',
    }));
});

const download = async (section: Section) => {
  const tasks = new Array<Promise<unknown>>();
  state.loadStatusMessage = '開始中…';
  state.workingSectionId = section.section_id;

  const zip = new ZipDir(section.name);

  // ストーリー
  state.loadStatusMessage = 'ストーリーデータのダウンロード中…';
  const stories = storyList.value[section.section_id];
  if (!stories) {
    state.loadStatusMessage = '【例外】ストーリーの取得失敗した。';
    throw '【例外】ストーリーの取得失敗した。';
  }

  const storyIdLoggingTasks = new Array<Promise<Response>>();
  const storyElements = new Array<StoryElement>();
  const filledStories = await fillStoryData(stories, enableStidMap.value);
  for await (const s of filledStories) {
    tasks.push(downloadStory(zip, s, section));
    storyElements.push(...s.elements);
    if (!s.storyId) continue;
    storyIdLoggingTasks.push(
      fetch(
        `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${encodeURIComponent(
          `${section.section_id}_${section.name}_${s.st_id}_${s.storyId}`,
        )}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`,
        {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          credentials: 'same-origin',
        },
      ),
    );
  }

  tasks.push(downloadBg(zip, storyElements));
  tasks.push(zip.fileFromUrlAsync(`${section.section_id}.jpg`, `https://ancl.jp/img/game/event/section/${section.section_id}.jpg`));
  // イベントロゴ、背景、BGM
  if (sectionEventIdMap.value.has(section.section_id)) {
    const eventId = sectionEventIdMap.value.get(section.section_id);
    tasks.push(zip.fileFromUrlAsync('logo.png', `${_eventAssetPath}/${eventId}/logo.png`));
    tasks.push(zip.fileFromUrlAsync('bgm.m4a', `${_eventAssetPath}/${eventId}/bgm.m4a`));
    tasks.push(zip.fileFromUrlAsync('bg.jpg', `${_eventAssetPath}/${eventId}/bg.jpg`));
    const resLeftChara = await fetch(`${_eventAssetPath}/${eventId}/left_chara.json`);
    if (resLeftChara.ok) {
      tasks.push(zip.fileAsync('left_chara.json', await resLeftChara.clone().blob()));
      const leftCharaJson = await resLeftChara.json();
      if (leftCharaJson) {
        if (Array.isArray(leftCharaJson?.howto)) {
          for (const x of Array.from(leftCharaJson.howto).flat()) {
            if (!`${x}`.startsWith('EVE')) continue;
            tasks.push(zip.fileFromUrlAsync(`${x}.jpg`, `${_eventAssetPath}/${eventId}/${x}.jpg`));
          }
        }
      }
    }
  }

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  await Promise.all(tasks);
  const blob = await zip.end();

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_イベントストーリー_${section.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  downloadHistoryStore.pushSectionDownloadHistory(section.section_id);

  await Promise.all(storyIdLoggingTasks);
  state.loadStatusMessage = '';
  state.workingSectionId = '';
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
              <li>
                イベントストーリーのダウンロード
                <ul>
                  <li>解放されていないストーリーは情報が取れないのでダウンロード不可</li>
                  <li>ストーリー解放したらヘッダーのボタンから再読み込み</li>
                </ul>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 検索 -->
    <v-row dense align="center">
      <v-col cols="auto">
        <v-checkbox dense label="未ダウンロードのみ表示" v-model="state.filterNotDownloadedYet"></v-checkbox>
      </v-col>
    </v-row>

    <!-- リスト -->
    <v-row dense>
      <v-col>
        <v-tabs v-model="state.tab" bg-color="primary">
          <v-tab value="main">メインストーリー</v-tab>
          <v-tab value="limited">限定ストーリー</v-tab>
        </v-tabs>
        <v-list :items="items ?? []" item-props>
          <template v-slot:prepend="{ item }">
            <v-img width="256" class="mx-2" :src="`https://ancl.jp/img/game/event/section/${item.section_id}.jpg`" />
          </template>
          <template v-slot:subtitle="{ item }">
            <ul>
              <li
                v-for="story of storyList[item.section_id]"
                :key="story.st_id"
                :style="[enableStidMap.has(story.st_id) ? '' : { 'text-decoration': 'line-through' }]"
              >
                {{ story.st_id }} : {{ story.name }}
              </li>
            </ul>
          </template>
          <template v-slot:append="{ item }">
            <v-container>
              <v-row dense no-gutters>
                <v-col>
                  <v-btn @click="download(item)" color="success" :disabled="state.loadStatusMessage !== ''">{{
                    state.workingSectionId === item.section_id ? state.loadStatusMessage : 'ダウンロード'
                  }}</v-btn>
                </v-col>
              </v-row>
              <v-row dense no-gutters>
                <v-col>
                  <p class="blue">
                    {{ downloadHistoryStore.sectionDownloadHistory.find((x) => x.id === item.section_id)?.date ?? '-' }}
                  </p>
                </v-col>
              </v-row>
            </v-container>
          </template>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>
