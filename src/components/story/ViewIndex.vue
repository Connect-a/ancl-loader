<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ZipDir } from '@/scripts/zip';
import type { Section, StoryElement } from '@/@types';
import { downloadStory, downloadBg, fillStoryData } from '@/repository/downloadStory';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';

const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();

const state = reactive({
  filterNotDownloadedYet: false,
  loadStatusMessage: '',
  workingSectionId: '',
});

const items = computed(() =>
  Object.values(mainStore.stories?.main?.section ?? {})
    .sort((a, b) => a.order - b.order)
    .filter((x) =>
      state.filterNotDownloadedYet
        ? !downloadHistoryStore.sectionDownloadHistory.find((h) => h.id === x.section_id)
        : true,
    )
    .map((x) => ({
      ...x,
      title: `${x.chapter} ${x.name} : ${x.section_id}`,
      subtitle: '',
    })),
);

const enableStidMap = computed(() => {
  if (!mainStore.stories?.main?.story) return new Map();
  if (!mainStore.initData?.result.player_data.story.main) return new Map();

  const [sectionId, opened] = Object.entries(mainStore.initData?.result.player_data.story.main)[0];

  return new Map(
    Object.entries(mainStore.stories?.main?.story).flatMap(([section, stories]) =>
      stories
        .filter((s) => {
          if (section.substring(2) < sectionId.substring(2)) return true;
          if (section.substring(2) === sectionId.substring(2) && s.order <= opened) return true;
          return false;
        })
        .map((s) => [s.st_id, s]),
    ),
  );
});

const download = async (section: Section) => {
  const tasks = new Array<Promise<unknown>>();
  state.loadStatusMessage = '開始中…';
  state.workingSectionId = section.section_id;

  const zip = new ZipDir(section.name);

  // ストーリー
  state.loadStatusMessage = 'ストーリーデータのダウンロード中…';
  const stories = mainStore.stories?.main.story[section.section_id];
  if (!stories) {
    state.loadStatusMessage = '【例外】ストーリーの取得失敗した。';
    throw '【例外】ストーリーの取得失敗した。';
  }

  const storyElements = new Array<StoryElement>();
  const filledStories = await fillStoryData(stories, enableStidMap.value);
  for await (const s of filledStories) {
    tasks.push(downloadStory(zip, s, section));
    storyElements.push(...s.elements);
  }

  tasks.push(downloadBg(zip, storyElements));
  tasks.push(
    zip.fileFromUrlAsync(
      `${section.section_id}.jpg`,
      `https://ancl.jp/img/game/event/section/${section.section_id}.jpg`,
    ),
  );
  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  await Promise.all(tasks);
  const blob = await zip.end();

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_${section.chapter}_${section.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  downloadHistoryStore.pushSectionDownloadHistory(section.section_id);

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

    <!-- 検索 -->
    <v-row dense align="center">
      <v-col cols="auto">
        <v-checkbox
          dense
          label="未ダウンロードのみ表示"
          v-model="state.filterNotDownloadedYet"
        ></v-checkbox>
      </v-col>
    </v-row>

    <!-- リスト -->
    <v-row dense>
      <v-col>
        <v-list :items="items ?? []" item-props>
          <template v-slot:prepend="{ item }">
            <v-img
              width="256"
              class="mx-2"
              :src="`https://ancl.jp/img/game/event/section/${item.section_id}.jpg`"
            />
          </template>
          <template v-slot:subtitle="{ item }">
            <ul>
              <li
                v-for="story of mainStore.stories?.main?.story[item.section_id] ?? []"
                :key="story.st_id"
                :style="[
                  enableStidMap.has(story.st_id) ? '' : { 'text-decoration': 'line-through' },
                ]"
              >
                {{ story.st_id }} : {{ story.name }}
              </li>
            </ul>
          </template>
          <template v-slot:append="{ item }">
            <v-container>
              <v-row dense no-gutters>
                <v-col>
                  <v-btn
                    @click="download(item)"
                    color="success"
                    :disabled="state.loadStatusMessage !== ''"
                    >{{
                      state.workingSectionId === item.section_id
                        ? state.loadStatusMessage
                        : 'ダウンロード'
                    }}</v-btn
                  >
                </v-col>
              </v-row>
              <v-row dense no-gutters>
                <v-col>
                  <p class="blue">
                    {{
                      downloadHistoryStore.sectionDownloadHistory.find(
                        (x) => x.id === item.section_id,
                      )?.date ?? '-'
                    }}
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
