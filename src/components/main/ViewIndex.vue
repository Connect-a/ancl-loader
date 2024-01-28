<script setup lang="ts">
import { computed, reactive } from 'vue';
import JSZip from 'jszip';
import type { Character } from '@/@types';
import { downloadCharacter } from '@/repository/downloadCharacter';
import { downloadStory, fillStoryData } from '@/repository/downloadStory';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import {
  type AdditionalData,
  useAdditionalDataStore,
  type AdditionalDataType,
} from '@/store/additionalDataStore';

const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();
const additionalDataStore = useAdditionalDataStore();

const state = reactive({
  page: 1,
  search: '',
  filterNotDownloadedYet: false,
  charaImportUrl: localStorage.getItem('charaImportUrl') ?? '',
  loadStatusMessage: '',
  workingCharaId: '',
});

const enableStidMap = computed(() => {
  if (!mainStore.stories) return new Map();
  if (!mainStore.initData) return new Map();

  return new Map(
    Object.entries(mainStore.stories.chara?.story ?? {}).flatMap(([charaId, stories]) =>
      stories
        .filter((s) => {
          if (additionalDataStore.storyAdditionalData.find((x) => x.stid === s.st_id)) return true;
          const like = mainStore.initData?.result.player_data.story.chara[charaId];
          if (!like) return false;
          return s.order <= like;
        })
        .map((s) => [s.st_id, s]),
    ),
  );
});

const loadAdditionalChara = async () => {
  if (state.charaImportUrl) localStorage.setItem('charaImportUrl', state.charaImportUrl);

  state.charaImportUrl = localStorage.getItem('charaImportUrl') ?? '';
  const charaList = (await (await fetch(state.charaImportUrl)).text()).split('\n');
  if (charaList.length <= 1) return;

  additionalDataStore.setAdditionalData(
    charaList.map((x) => {
      const [charaId, charaName, stid, storyId] = x.split('_');
      let t: AdditionalDataType = 'story';
      if (charaId === 'voice') t = 'voice';
      if (charaId === 'radio') t = 'radio';
      return {
        type: t,
        charaId,
        charaName,
        stid: Number(stid),
        storyId,
      } as AdditionalData;
    }),
  );

  state.search = '';
};

const items = computed(() => {
  const s = state.search.replace(/[\u3041-\u3096]/g, (m) =>
    String.fromCharCode(m.charCodeAt(0) + 0x60),
  );
  return Object.values(mainStore.characters?.chara_data ?? {})
    .filter((x) => x.name.includes(s) || x.kana.includes(s))
    .filter((x) => x.chara_id !== '000000')
    .filter((x) =>
      state.filterNotDownloadedYet
        ? !downloadHistoryStore.downloadHistory.find((h) => h?.id === x.chara_id)
        : true,
    )
    .sort((a, b) => a.order - b.order);
});

const download = async (character: Character) => {
  state.loadStatusMessage = '開始中…';
  state.workingCharaId = character.chara_id;

  const zip = new JSZip();
  const charaDir = zip.folder(character.name);
  if (!charaDir) {
    state.loadStatusMessage = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // 基本
  state.loadStatusMessage = '基本情報のダウンロード中…';
  await downloadCharacter(charaDir, character, document.createElement('canvas'));

  // スケルトン
  {
    const skeletonDir = charaDir.folder('skeleton');
    const types = ['spine_n', 'spine_w'];
    const extensions = ['.atlas', '.json', '.png'];
    for (const t of types) {
      const d = skeletonDir?.folder(t);
      for (const e of extensions) {
        const r = await fetch(
          `https://ancl.jp/img/game/chara/${character.chara_id}/${t}/skeleton${e}`,
        );
        if (!r.ok) continue;
        d?.file(`skeleton${e}`, r.blob());
      }
    }
  }

  // ストーリー
  state.loadStatusMessage = 'ストーリーデータのダウンロード中…';
  const stories = mainStore.stories?.chara.story[character.chara_id];
  if (!stories) {
    state.loadStatusMessage = '【例外】ストーリーの取得失敗した。';
    throw '【例外】ストーリーの取得失敗した。';
  }

  const filledStories = await fillStoryData(stories, enableStidMap.value);
  const stidLoggingTasks = new Array<Promise<Response>>();
  for await (const s of filledStories) {
    await downloadStory(charaDir, s, character);
    if (!s.storyId) continue;
    stidLoggingTasks.push(
      fetch(
        `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${character.chara_id}_${character.name}_${s.st_id}_${s.storyId}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`,
        {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          credentials: 'same-origin',
        },
      ),
    );
  }

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.generateAsync({ type: 'blob' });

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_${character.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(stidLoggingTasks);
  downloadHistoryStore.pushDownloadHistory(character.chara_id);

  state.loadStatusMessage = '';
  state.workingCharaId = '';
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
              <li>キャラクターの基本情報ダウンロード</li>
              <li>
                キャラクターのストーリーダウンロード
                <ul>
                  <li>好感度が足りていても解放されていなければダウンロード不可</li>
                  <li>ストーリー解放したらヘッダーのボタンから再読み込み</li>
                </ul>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <!-- 検索 -->
    <v-row
      dense
      align="center"
      v-if="mainStore.characters?.chara_data && mainStore.stories?.chara?.story"
    >
      <v-col>
        <v-text-field v-model="state.search" label="キャラ名検索" outlined dense class="ma-3" />
        <template v-if="state.search === 'opensesame'">
          <v-text-field label="URL" v-model="state.charaImportUrl" />
          <v-btn @click="loadAdditionalChara">ロード</v-btn>
        </template>
      </v-col>
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
        <v-data-iterator
          v-if="mainStore.loaded"
          :items="items"
          :page="state.page"
          itemsPerPage="30"
        >
          <template v-slot:default="{ items }">
            <v-list-item
              v-for="item in items"
              :key="item.raw.chara_id"
              :title="`${item.raw.name} : ${item.raw.chara_id}`"
            >
              <template v-slot:prepend>
                <v-avatar size="100" rounded="sm">
                  <v-img
                    :src="`https://ancl.jp/img/game/chara/${item.raw.chara_id}/graphic/${item.raw.chara_id}_ss.png`"
                    :alt="`${item.raw.title}`"
                  />
                </v-avatar>
              </template>
              <v-list-item-subtitle>
                <ul>
                  <li
                    v-for="story of mainStore.stories?.chara?.story[item.raw.chara_id]"
                    :key="story.st_id"
                    :style="[
                      enableStidMap.has(story.st_id) ? '' : { 'text-decoration': 'line-through' },
                    ]"
                  >
                    {{ story.st_id }} : {{ story.name }}
                  </li>
                </ul>
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-container>
                  <v-row dense no-gutters>
                    <v-col>
                      <v-btn
                        @click="download(item.raw)"
                        color="primary"
                        :disabled="state.loadStatusMessage !== ''"
                        >{{
                          state.workingCharaId === item.raw.chara_id
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
                          downloadHistoryStore.downloadHistory.find(
                            (x) => x?.id === item.raw.chara_id,
                          )?.date ?? '-'
                        }}
                      </p>
                    </v-col>
                  </v-row>
                </v-container>
              </template>
            </v-list-item>
          </template>
          <template v-slot:header="{ pageCount }">
            <v-pagination v-model="state.page" :length="pageCount"></v-pagination>
          </template>
          <template v-slot:footer="{ pageCount }">
            <v-pagination v-model="state.page" :length="pageCount"></v-pagination>
          </template>
        </v-data-iterator>

        <!-- <v-list v-if="mainStore.loaded" item-props>
          <v-list-item v-for="item in items" :key="item.chara_id" :title="item.title">
            <template v-slot:prepend>
              <v-avatar size="100" rounded="sm">
                <v-img :src="`https://ancl.jp/img/game/chara/${item.chara_id}/graphic/${item.chara_id}_ss.png`"
                  :alt="`${item.title}`" />
              </v-avatar>
            </template>
            <v-list-item-subtitle>
              <ul>
                <li v-for="story of mainStore.stories?.chara?.story[item.chara_id]" :key="story.st_id" :style="[
                  enableStidMap.has(story.st_id)
                    ? ''
                    : { 'text-decoration': 'line-through' },
                ]">
                  {{ story.st_id }} : {{ story.name }}
                </li>
              </ul>
            </v-list-item-subtitle>
            <template v-slot:append>
              <v-container>
                <v-row dense no-gutters>
                  <v-col>
                    <v-btn @click="download(item)" color="primary" :disabled="state.loadStatusMessage !== ''">{{
                      state.workingCharaId === item.chara_id ? state.loadStatusMessage : 'ダウンロード'
                    }}</v-btn>
                  </v-col>
                </v-row>
                <v-row dense no-gutters>
                  <v-col>
                    <p class="blue">
                      {{ downloadHistoryStore.downloadHistory.find((x) => x?.id === item.chara_id)?.date ?? '-' }}
                    </p>
                  </v-col>
                </v-row>
              </v-container>
            </template>
          </v-list-item>
        </v-list> -->
      </v-col>
    </v-row>
  </v-container>
</template>
