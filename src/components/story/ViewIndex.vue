<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { Section } from '@/@types';
import { runSectionDownload } from '@/repository/download';
import { DialogWriter } from '@/repository/download/writer';
import BulkDownloadStart from '@/components/bulkDownload/BulkDownloadStart.vue';
import { eventAssets } from '@/repository/assetMap';
import { isFullyUnlocked } from '@/scripts/anclData';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { useAdditionalDataStore } from '@/store/additionalDataStore';
import DownloadButton from '@/components/DownloadButton.vue';
import { setDownloadMessage } from '@/composables/useDownloadAction';

type StoryTab = 'main' | 'event' | 'limited';

const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();
const additionalDataStore = useAdditionalDataStore();

const state = reactive({
  tab: 'main' as StoryTab,
  filterNotDownloadedYet: false,
});

// メインだけ別domain・別enableStidMap・章付きタイトル・orderソート
const isMain = computed(() => state.tab === 'main');
const target = computed(() =>
  state.tab === 'main' ? mainStore.stories?.main : state.tab === 'event' ? mainStore.stories?.event : mainStore.stories?.limited,
);
const enableStidMap = computed(() => (isMain.value ? mainStore.mainEnableStidMap : mainStore.eventEnableStidMap));
const domain = computed((): 'main' | 'event' => (isMain.value ? 'main' : 'event'));
const storyList = computed(() => target.value?.story ?? {});

const bulkDownloadLabel = computed(() =>
  state.tab === 'main' ? 'メインストーリー' : state.tab === 'event' ? 'イベントストーリー' : '限定ストーリー',
);
const bulkDownloadSections = computed(() =>
  Object.values(target.value?.section ?? {}).map((s) => {
    const stories = storyList.value[s.section_id] ?? [];
    return {
      id: s.section_id,
      name: s.name,
      fullyUnlocked: isFullyUnlocked(stories, enableStidMap.value),
    };
  }),
);

const items = computed(() => {
  const sections = Object.values(target.value?.section ?? {});
  sections.sort((a, b) => (isMain.value ? a.order - b.order : a.section_id.localeCompare(b.section_id)));
  return sections
    .filter((x) => !state.filterNotDownloadedYet || !downloadHistoryStore.sectionDownloadedDateMap.has(x.section_id))
    .map((x) => ({
      ...x,
      title: isMain.value ? `${x.chapter} ${x.name} : ${x.section_id}` : `${x.name} : ${x.section_id}`,
      subtitle: '',
    }));
});

const downloadSection = async (section: Section) => {
  const stories = storyList.value[section.section_id];
  if (!stories) {
    throw new Error('【例外】ストーリーの取得失敗した。');
  }

  await runSectionDownload(new DialogWriter(), {
    section,
    stories,
    enableStidMap: enableStidMap.value,
    domain: domain.value,
    // イベント/限定はevent_idが必要
    eventId: isMain.value ? undefined : mainStore.sectionEventIdMap.get(section.section_id),
    storyAdditional: additionalDataStore.storyAdditionalData,
    token: mainStore.token,
    onStatus: setDownloadMessage,
  });
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
                ストーリーのダウンロード
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

    <v-row dense class="mt-3">
      <v-col>
        <v-card>
          <v-tabs v-model="state.tab" bg-color="primary">
            <v-tab value="main">メインストーリー</v-tab>
            <v-tab value="event">イベントストーリー</v-tab>
            <v-tab value="limited">限定ストーリー</v-tab>
          </v-tabs>
          <v-card-title class="d-flex align-center ga-2 flex-wrap">
            <v-checkbox v-model="state.filterNotDownloadedYet" density="compact" hide-details label="未ダウンロードのみ表示" />
            <v-spacer />
            <BulkDownloadStart :mode="{ kind: 'section', sections: bulkDownloadSections, domain, label: bulkDownloadLabel }" />
          </v-card-title>
          <v-list :items="items ?? []" item-props>
            <template v-slot:prepend="{ item }">
              <v-img width="256" class="mx-2" :src="eventAssets.sectionThumb(item.section_id)" />
            </template>
            <template v-slot:subtitle="{ item }">
              <ul>
                <li
                  v-for="story of storyList[item.section_id] ?? []"
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
                    <DownloadButton :id="item.section_id" requires-token :task="() => downloadSection(item)" />
                  </v-col>
                </v-row>
                <v-row dense no-gutters>
                  <v-col class="d-flex align-center gap-1">
                    <p class="blue">{{ downloadHistoryStore.sectionDownloadedDateMap.get(item.section_id)?.date ?? '-' }}</p>
                    <v-chip
                      v-if="downloadHistoryStore.sectionDownloadedDateMap.get(item.section_id)?.complete === false"
                      size="x-small"
                      color="incomplete"
                      >未完</v-chip
                    >
                  </v-col>
                </v-row>
              </v-container>
            </template>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
