<script setup lang="ts">
import { computed, nextTick, reactive } from 'vue';
import type { Character } from '@/@types';
import { downoadCharacter } from '@/repository/downloadCharacter';
import { useMainStore } from '@/store';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { useAdditionalDataStore } from '@/store/additionalDataStore';
import CharaDetailCard from './components/CharaDetailCard.vue';
import { mdiCancel } from '@mdi/js';

type SortTarget = 'b' | 'w' | 'h' | 'height' | 'weight' | 'birthDate';
const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();
const additionalDataStore = useAdditionalDataStore();

const state = reactive({
  page: 1,
  keyword: '',
  profileKeyword: '',
  filterNotDownloadedYet: false,
  filterAcquiredCharacter: false,
  sort: '' as SortTarget | '',
  charaImportUrl: localStorage.getItem('charaImportUrl') ?? '',
  loadingStatusMessage: '',
  workingCharaId: '',
  charaDetailDialog: {
    targetId: '',
    show: false,
    showLargeImage: false,
  },
});

const getBattleTypeText = (chara: Character) => {
  const dmgTypeMap = new Map([
    [1, '【物理】'],
    [2, '【魔法】'],
  ]);
  const eleTypeMap = new Map([
    [1, '日'],
    [2, '月'],
    [3, '火'],
    [4, '水'],
    [5, '木'],
    [6, '金'],
    [7, '土'],
  ]);
  const categoryMap = new Map([
    [1, 'アタッカー'],
    [2, 'サポーター'],
    [3, 'ヒーラー'],
    [4, 'タンク'],
  ]);
  return `${dmgTypeMap.get(chara.dmg_type) ?? '【？？？】'}${eleTypeMap.get(chara.ele_type) ?? '？？？'}属性${categoryMap.get(chara.category) ?? '？？？'}`;
};

const itemsSrc = computed(() => {
  const caharaIdSet = new Set(Object.keys(mainStore.initData?.result.player_data.chara ?? {}));
  return Object.values(mainStore.characters?.chara_data ?? {}).map((x) => ({
    ...x,
    acquired: caharaIdSet.has(x.chara_id),
    battleTypeText: getBattleTypeText(x),
    sortTarget: {
      b: parseInt(x.profile.size.split('-')[0]),
      w: parseInt(x.profile.size.split('-')[1]),
      h: parseInt(x.profile.size.split('-')[2]),
      height: parseInt(x.profile.height.replace('cm', '').trim()),
      weight: parseInt(x.profile.weight.trim()),
      birthDate: parseInt(
        `${x.profile.birth.split('月')[0]?.padStart(2, '0') ?? ''}${x.profile.birth.split('月')[1]?.split('日')[0]?.padStart(2, '0') ?? ''}`,
      ),
    } as Record<SortTarget, number>,
  }));
});

const items = computed(() => {
  const s = (state.keyword ?? '').replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60));
  const filtered = itemsSrc.value
    .filter((x) => x.name.includes(s) || x.name.includes(state.keyword) || x.kana.includes(s) || x.chara_id.includes(s))
    .filter((x) => x.chara_id !== '000000')
    .filter((x) =>
      state.profileKeyword && state.profileKeyword !== '/'
        ? `${x.profile.group}/${x.profile.cv_name}/${x.profile.illust}/${x.battleTypeText}`.includes(state.profileKeyword)
        : true,
    )
    .filter((x) => (state.filterNotDownloadedYet ? !downloadHistoryStore.downloadHistory.find((h) => h?.id === x.chara_id) : true))
    .filter((x) => (state.filterAcquiredCharacter ? x.acquired : true));

  if (!state.sort) return filtered;

  // NOTE: 処理負荷軽減のためsortについてメソッドチェーンを分離
  return filtered
    .filter((x) => x.sortTarget[state.sort as SortTarget])
    .sort((a, b) => {
      if (a.sortTarget[state.sort as SortTarget] === b.sortTarget[state.sort as SortTarget]) return a.name.localeCompare(b.name);
      return a.sortTarget[state.sort as SortTarget] - b.sortTarget[state.sort as SortTarget];
    });
});

const download = async (character: Character) => {
  state.loadingStatusMessage = 'ダウンロード中...';
  state.workingCharaId = character.chara_id;
  await downoadCharacter(character);
  state.loadingStatusMessage = '';
  state.workingCharaId = '';
};

const showCharaDetail = (charaId: string) => {
  state.charaDetailDialog.targetId = charaId;
  state.charaDetailDialog.show = true;
  nextTick(() => document.getElementById('chara-detail-card')?.focus());
};

const setKeyword = (keyword: string) => {
  state.keyword = keyword;
  state.profileKeyword = '';
  state.charaDetailDialog.show = false;
};

const setkProfileKeyword = (keyword: string) => {
  state.profileKeyword = keyword;
  state.keyword = '';
  state.charaDetailDialog.show = false;
};
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-expansion-panels>
          <v-expansion-panel title="機能">
            <v-expansion-panel-text>
              <ul>
                <li>キャラクターの基本情報ダウンロード</li>
                <li>
                  キャラクターのストーリーダウンロード
                  <ul>
                    <li>好感度が足りていても解放されていなければダウンロード不可</li>
                    <li>ストーリー解放したらヘッダーのボタンから再読み込み</li>
                  </ul>
                </li>
                <li>アイコンクリックでプロフィール表示</li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel title="⚠️使用上の注意⚠️">
            <v-expansion-panel-text>
              <ul>
                <li>短時間に連続で大量にダウンロードするとIPアドレスがテイクダウンされてエンジェリックリンクにアクセスできなくなる可能性あり</li>
                <li>安全に使いたいならダウンロードごとにおよそ5分の間隔を空けること。</li>
                <li>ダウンロード失敗（404）がWAFかCDN上で一定時間内に多く発生するとIPアドレスで弾かれているようす</li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
    <!-- 検索 -->
    <v-row dense align="center" v-show="mainStore.characters?.chara_data">
      <v-col>
        <v-text-field v-model="state.keyword" @input="state.page = 1" label="キャラ名・ID検索" clearable outlined dense class="my-3" />
        <v-text-field v-model="state.profileKeyword" @input="state.page = 1" label="プロフィール検索" clearable outlined dense class="my-3" />
        <template v-if="state.keyword === 'opensesame'">
          <v-text-field label="URL" v-model="state.charaImportUrl" />
          <v-btn
            @click="
              additionalDataStore.setAdditionalData(state.charaImportUrl);
              state.keyword = '';
            "
            >ロード</v-btn
          >
        </template>
      </v-col>
      <v-col cols="auto">
        <v-checkbox density="compact" hide-details label="未ダウンロードのみ表示" v-model="state.filterNotDownloadedYet"></v-checkbox>
        <v-checkbox density="compact" hide-details label="所持済みのみ表示" v-model="state.filterAcquiredCharacter"></v-checkbox>
      </v-col>
    </v-row>
    <v-row dense align="center" v-show="mainStore.characters?.chara_data">
      <v-col class="border">
        <v-label>ソート</v-label>
        <v-btn-toggle v-model="state.sort" color="primary">
          <v-btn value="b">b</v-btn>
          <v-btn value="w">w</v-btn>
          <v-btn value="h">h</v-btn>
          <v-btn value="height">height</v-btn>
          <v-btn value="weight">weight</v-btn>
          <v-btn value="birthDate">birthDate</v-btn>
          <v-btn :icon="mdiCancel" value="" />
        </v-btn-toggle>
      </v-col>
    </v-row>
    <!-- リスト -->
    <v-row dense v-if="mainStore.characters?.chara_data && mainStore.initData?.result">
      <v-col>
        <v-data-iterator v-if="mainStore.loaded" :items="items" :page="state.page" itemsPerPage="30">
          <template v-slot:default="{ items }">
            <v-list-item v-for="item in items" :key="item.raw.chara_id" :title="`${item.raw.name} : ${item.raw.chara_id}`">
              <!-- アバター画像-->
              <template v-slot:prepend>
                <v-btn @click="showCharaDetail(item.raw.chara_id)" size="100" rounded="sm" class="mx-2">
                  <v-avatar size="100" rounded="sm">
                    <v-img
                      :src="`https://ancl.jp/img/game/chara/${item.raw.chara_id}/graphic/${item.raw.chara_id}_ss.png`"
                      :alt="`${item.raw.name}`"
                    />
                  </v-avatar>
                </v-btn>
              </template>
              <!-- 話リスト -->
              <v-list-item-subtitle>
                <ul>
                  <li
                    v-for="story of mainStore.stories?.chara?.story[item.raw.chara_id]"
                    :key="story.st_id"
                    :style="[mainStore.enableStidMap.has(story.st_id) ? '' : { 'text-decoration': 'line-through' }]"
                  >
                    {{ story.st_id }} : {{ story.name }}
                  </li>
                </ul>
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-container>
                  <v-row dense no-gutters>
                    <v-col>
                      <p>{{ item.raw.acquired ? '' : '(未所持)' }}</p>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col>
                      <v-btn @click="download(item.raw)" color="primary" :disabled="state.loadingStatusMessage !== ''">{{
                        state.workingCharaId === item.raw.chara_id ? state.loadingStatusMessage : 'ダウンロード'
                      }}</v-btn>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col>
                      <p>
                        {{ downloadHistoryStore.downloadHistory.find((x) => x?.id === item.raw.chara_id)?.date ?? '-' }}
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
      </v-col>
    </v-row>
    <v-dialog v-model="state.charaDetailDialog.show" :persistant="state.workingCharaId" scrollable scroll-strategy="none" fullscreen tabindex="-1">
      <CharaDetailCard
        :targetId="state.charaDetailDialog.targetId"
        :items="items"
        :loadingStatusMessage="state.loadingStatusMessage"
        :workingCharaId="state.workingCharaId"
        @clickEsc="state.charaDetailDialog.show = false"
        @clickProfileKeyword="setkProfileKeyword"
        @clickKeyword="setKeyword"
        @clickDownload="download(items.find((x) => x.chara_id === state.charaDetailDialog.targetId) ?? ({} as Character))"
        @changeTargetId="state.charaDetailDialog.targetId = $event"
      />
    </v-dialog>
  </v-container>
</template>
