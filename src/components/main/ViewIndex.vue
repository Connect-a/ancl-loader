<script setup lang="ts">
import { mdiPlay } from '@mdi/js';
import { storage } from '@wxt-dev/storage';
import { computed, onMounted, reactive, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BulkDownloadStart from '@/components/bulkDownload/BulkDownloadStart.vue';
import DownloadButton from '@/components/DownloadButton.vue';
import EntryPlayer from '@/components/EntryPlayer.vue';
import type { ZipEntry } from '@/components/folderPlayer/types';
import { useDownloadAction, setDownloadMessage } from '@/composables/useDownloadAction';
import { useHomeDir } from '@/composables/useHomeDir';
import { createDefaultDetailFilter, getBattleTypeText, isCollabGroup, type SortTarget, type StatMode } from '@/constants/characterAttributes';
import { charaImage } from '@/repository/assetMap';
import { downloadCharacter } from '@/repository/download';
import { isFullyUnlocked } from '@/scripts/anclData';
import type { BulkDownloadCandidate } from '@/scripts/bulkDownloadState';
import { calcCharaStats, type Character } from '@/scripts/character';
import { useMainStore } from '@/store';
import { useAdditionalDataStore } from '@/store/additionalDataStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { normalizeForSearch } from '@/utils/search';
import CharaBattleAttributes from './components/CharaBattleAttributes.vue';
import CharaDetailCard from './components/CharaDetailCard.vue';
import DetailFilterFieldset from './components/DetailFilterFieldset.vue';
import SortFieldset from './components/SortFieldset.vue';

const route = useRoute();
const router = useRouter();
const mainStore = useMainStore();
const downloadHistoryStore = useDownloadHistoryStore();
const additionalDataStore = useAdditionalDataStore();
const charaDetailCardRef = useTemplateRef<InstanceType<typeof CharaDetailCard>>('charaDetailCardRef');
const home = useHomeDir();

const charaListState = reactive({
  page: 1,
  keyword: '',
  profileKeyword: '',
  filter: createDefaultDetailFilter(),
  showBattleIcons: true,
  sortOpen: true,
  filterOpen: true,
  sort: 'id' as SortTarget,
  sortDesc: false,
  statMode: 'base' as StatMode,
});
const charaListStateItem = storage.defineItem<Partial<typeof charaListState>>('local:charaListState');
const charaListStateReady = ref(false);
const dl = useDownloadAction();
const playEntry = ref<ZipEntry | null>(null);

const itemsSrc = computed(() => {
  const playerCharaMap = mainStore.initData?.result.player_data.chara ?? {};
  const settings = mainStore.initData?.result.settings;
  const acquisitionOrderMap = new Map(Object.keys(playerCharaMap).map((id, i) => [id, i + 1]));
  const charaStories = mainStore.stories?.chara?.story ?? {};
  return Object.values(mainStore.characters?.chara_data ?? {}).map((x) => {
    const pChara = playerCharaMap[x.chara_id];
    const stats = calcCharaStats(x, pChara, charaListState.statMode, settings);
    const battleTypeText = getBattleTypeText(x.dmg_type, x.ele_type, x.category);
    return {
      ...x,
      battleTypeText,
      currentRarity: pChara?.rarity ?? NaN,
      currentOverlap: pChara?.overlap ?? NaN,
      hasOverlapStory: charaStories[x.chara_id]?.some((s) => (s.open?.like ?? 0) > 8) ?? false,
      sortTarget: {
        rarity: x.rarity,
        lv: pChara?.lv ?? NaN,
        rank: pChara?.rank ?? NaN,
        currentRarity: pChara?.rarity ?? NaN,
        overlap: pChara?.overlap ?? NaN,
        likeLv: pChara?.like_lv ?? NaN,
        agi: x.agi,
        pos: x.pos,
        hp: stats.hp,
        atk: stats.atk,
        cri: stats.cri,
        def: stats.def,
        res: stats.res,
        b: parseInt(x.profile.size.split('-')[0] ?? 'NaN'),
        w: parseInt(x.profile.size.split('-')[1] ?? 'NaN'),
        h: parseInt(x.profile.size.split('-')[2] ?? 'NaN'),
        height: parseInt(x.profile.height.replace('cm', '').trim()),
        weight: parseInt(x.profile.weight.trim()),
        birthDate: parseInt(
          `${x.profile.birth.split('月')[0]?.padStart(2, '0') ?? ''}${x.profile.birth.split('月')[1]?.split('日')[0]?.padStart(2, '0') ?? ''}`,
        ),
        acquisitionOrder: acquisitionOrderMap.get(x.chara_id) ?? NaN,
      } satisfies Record<Exclude<SortTarget, 'id'>, number>,
      searchTarget: {
        id: normalizeForSearch(x.chara_id),
        name: normalizeForSearch(x.name),
        kana: normalizeForSearch(x.kana),
        group: normalizeForSearch(x.profile.group),
        cvName: normalizeForSearch(x.profile.cv_name),
        illust: normalizeForSearch(x.profile.illust),
        battleTypeText: normalizeForSearch(battleTypeText),
        birth: normalizeForSearch(x.profile.birth),
      },
    };
  });
});

const filteredItems = computed(() => {
  const s = normalizeForSearch(charaListState.keyword ?? '');
  const ps = normalizeForSearch(charaListState.profileKeyword ?? '');
  const f = charaListState.filter;
  return itemsSrc.value
    .filter((x) => x.searchTarget.name.includes(s) || x.searchTarget.kana.includes(s) || x.searchTarget.id.includes(s))
    .filter((x) => x.chara_id !== '000000')
    .filter(
      (x) =>
        !ps ||
        x.searchTarget.group.includes(ps) ||
        x.searchTarget.cvName.includes(ps) ||
        x.searchTarget.illust.includes(ps) ||
        x.searchTarget.battleTypeText.includes(ps) ||
        x.searchTarget.birth.startsWith(ps),
    )
    .filter((x) => !f.notDownloadedYet || !downloadHistoryStore.downloadedDateMap.has(x.chara_id))
    .filter((x) => !f.acquiredCharacter || x.sortTarget.acquisitionOrder > 0)
    .filter((x) => !f.excludeCollab || !isCollabGroup(x.profile.group))
    .filter((x) => !f.dmgType?.length || f.dmgType.includes(x.dmg_type))
    .filter((x) => !f.eleType?.length || f.eleType.includes(x.ele_type))
    .filter((x) => !f.category?.length || f.category.includes(x.category))
    .filter((x) => !f.rarity?.length || f.rarity.includes(x.rarity))
    .filter((x) => !f.currentRarity?.length || f.currentRarity.includes(x.currentRarity))
    .filter((x) => !f.overlap?.length || f.overlap.includes(x.currentOverlap))
    .filter((x) => !f.hasOverlapStory || x.hasOverlapStory);
});

const items = computed(() => {
  const sort = charaListState.sort;
  // chara_dataは元々キャラID昇順
  if (sort === 'id') return charaListState.sortDesc ? filteredItems.value.toReversed() : filteredItems.value;

  return filteredItems.value
    .filter((x) => !Number.isNaN(x.sortTarget[sort]))
    .sort((a, b) => {
      if (a.sortTarget[sort] === b.sortTarget[sort]) return a.chara_id < b.chara_id ? -1 : 1;
      return (a.sortTarget[sort] - b.sortTarget[sort]) * (charaListState.sortDesc ? -1 : 1);
    });
});

const charaDetailTargetId = computed(() => (typeof route.query.chara === 'string' ? route.query.chara : ''));

const navCharaId = computed(() => {
  const idx = items.value.findIndex((x) => x.chara_id === charaDetailTargetId.value);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: items.value[idx - 1]?.chara_id ?? null,
    next: items.value[idx + 1]?.chara_id ?? null,
  };
});

const bulkDownloadCandidatesFrom = (ids: ReadonlyArray<string>): Array<BulkDownloadCandidate> => {
  const storyMap = mainStore.stories?.chara.story ?? {};
  const enabled = mainStore.charaEnableStidMap;
  return ids.map((id) => ({
    id,
    name: mainStore.characters?.chara_data?.[id]?.name ?? id,
    fullyUnlocked: isFullyUnlocked(storyMap[id] ?? [], enabled),
  }));
};
const bulkDownloadFilteredCandidates = computed(() => bulkDownloadCandidatesFrom(items.value.map((c) => c.chara_id)));
const bulkDownloadAllCandidates = computed(() =>
  bulkDownloadCandidatesFrom(Object.keys(mainStore.characters?.chara_data ?? {}).filter((id) => id !== '000000')),
);

const downloadChara = (character: Character): Promise<void> => {
  setDownloadMessage('ダウンロード中…');
  return downloadCharacter(character);
};

const showCharaDetail = (charaId: string) => router.replace({ query: { chara: charaId } });
const closeCharaDetail = () => router.replace({ query: {} });
const focusCharaDetailCard = () => (charaDetailCardRef.value?.$el as HTMLElement)?.focus({ preventScroll: true });

const setKeyword = (keyword: string) => {
  charaListState.keyword = keyword;
  charaListState.profileKeyword = '';
  closeCharaDetail();
};

const setProfileKeyword = (keyword: string) => {
  charaListState.profileKeyword = keyword;
  charaListState.keyword = '';
  closeCharaDetail();
};

const playChara = async (charaId: string) => {
  await home.loadEntries();
  playEntry.value = home.entries.value.find((e) => e.charaId === charaId) ?? null;
};

let debounceTimer: ReturnType<typeof setTimeout>;
watch(charaListState, (snapshot) => {
  if (!charaListStateReady.value) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void charaListStateItem.setValue(JSON.parse(JSON.stringify(snapshot))), 1000);
});

watch(
  () => [
    charaListState.keyword,
    charaListState.profileKeyword,
    charaListState.filter,
    charaListState.sort,
    charaListState.sortDesc,
    charaListState.statMode,
  ],
  () => {
    if (charaListStateReady.value) charaListState.page = 1;
  },
  { deep: true },
);

onMounted(async () => {
  const saved = await charaListStateItem.getValue();
  if (saved) Object.assign(charaListState, saved);
  charaListStateReady.value = true;
});
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
    <v-row dense>
      <v-col>
        <v-text-field v-model="charaListState.keyword" label="キャラ名・ID検索" clearable outlined dense hide-details />
      </v-col>
      <v-col>
        <v-text-field v-model="charaListState.profileKeyword" label="プロフィール検索" clearable outlined dense hide-details />
      </v-col>
    </v-row>
    <v-row v-if="charaListState.keyword === 'opensesame'" dense>
      <v-col>
        <v-text-field label="URL" v-model="additionalDataStore.charaImportUrl" />
        <v-btn
          @click="
            additionalDataStore.setAdditionalData();
            charaListState.keyword = '';
          "
          >ロード</v-btn
        >
      </v-col>
    </v-row>
    <v-row dense>
      <v-col :cols="charaListState.sortOpen || charaListState.filterOpen ? 12 : undefined">
        <SortFieldset
          class="h-100"
          v-model:sort="charaListState.sort"
          v-model:sortDesc="charaListState.sortDesc"
          v-model:open="charaListState.sortOpen"
          v-model:statMode="charaListState.statMode"
        />
      </v-col>
      <v-col :cols="charaListState.sortOpen || charaListState.filterOpen ? 12 : undefined">
        <DetailFilterFieldset class="h-100" v-model:filter="charaListState.filter" v-model:open="charaListState.filterOpen" />
      </v-col>
      <v-col cols="12" class="d-flex align-center ga-2">
        <v-checkbox density="compact" hide-details label="バトル情報表示" v-model="charaListState.showBattleIcons" />
        <v-spacer />
        <v-chip v-if="home.dirName.value && home.permission.value !== 'granted'" size="small" color="warning" @click="home.requestPermission()">
          再生フォルダの再許可（クリック）
        </v-chip>
        <BulkDownloadStart :mode="{ kind: 'chara', filtered: bulkDownloadFilteredCandidates, all: bulkDownloadAllCandidates }" />
      </v-col>
    </v-row>

    <EntryPlayer
      :entry="playEntry"
      :shared-zip="home.sharedZip.value"
      :chara-handle-map="home.charaHandleMap.value"
      mode="dialog"
      @close="playEntry = null"
    />
    <v-row dense>
      <v-col>
        <v-data-iterator :items="items" :page="charaListState.page" itemsPerPage="30">
          <template v-slot:default="{ items }">
            <v-list-item v-for="item in items" :key="item.raw.chara_id">
              <template v-slot:title>
                <CharaBattleAttributes v-if="charaListState.showBattleIcons" :chara="item.raw" />
                <span class="text-cyan text-decoration-underline cursor-pointer" @click="showCharaDetail(item.raw.chara_id)">{{
                  item.raw.name
                }}</span>
                <span> : {{ item.raw.chara_id }}</span>
              </template>
              <template v-slot:prepend>
                <v-btn @click="showCharaDetail(item.raw.chara_id)" size="100" rounded="sm" class="mx-2">
                  <v-avatar size="100" rounded="sm">
                    <v-img :src="charaImage.webUrlOf(item.raw.chara_id, 'ss.png')" :alt="`${item.raw.name}`" />
                  </v-avatar>
                </v-btn>
              </template>
              <v-list-item-subtitle>
                <div class="d-flex align-center ga-2">
                  <ul>
                    <li
                      v-for="story of mainStore.stories?.chara?.story[item.raw.chara_id]"
                      :key="story.st_id"
                      :style="[mainStore.charaEnableStidMap.has(story.st_id) ? '' : { 'text-decoration': 'line-through' }]"
                    >
                      {{ story.st_id }} : {{ story.name }}
                    </li>
                  </ul>
                  <v-btn
                    v-if="home.charaIds.value.has(item.raw.chara_id)"
                    :prepend-icon="mdiPlay"
                    color="blue"
                    variant="outlined"
                    size="small"
                    @click="playChara(item.raw.chara_id)"
                  >
                    再生
                  </v-btn>
                </div>
              </v-list-item-subtitle>
              <template v-slot:append>
                <v-container>
                  <v-row dense no-gutters>
                    <v-col>
                      <p>{{ item.raw.sortTarget.acquisitionOrder ? '' : '(未所持)' }}</p>
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col>
                      <DownloadButton :id="item.raw.chara_id" requires-token :task="() => downloadChara(item.raw)" />
                    </v-col>
                  </v-row>
                  <v-row dense no-gutters>
                    <v-col class="d-flex align-center gap-1">
                      <p>
                        {{ downloadHistoryStore.downloadedDateMap.get(item.raw.chara_id)?.date ?? '-' }}
                      </p>
                      <v-chip
                        v-if="
                          downloadHistoryStore.downloadedDateMap.has(item.raw.chara_id) &&
                          downloadHistoryStore.downloadedDateMap.get(item.raw.chara_id)?.complete !== true
                        "
                        size="x-small"
                        color="incomplete"
                      >
                        {{ downloadHistoryStore.downloadedDateMap.get(item.raw.chara_id)?.complete === false ? '未完' : '？' }}
                      </v-chip>
                    </v-col>
                  </v-row>
                </v-container>
              </template>
            </v-list-item>
          </template>
          <template v-slot:header="{ pageCount }">
            <v-pagination v-model="charaListState.page" :length="pageCount"></v-pagination>
          </template>
          <template v-slot:footer="{ pageCount }">
            <v-pagination v-model="charaListState.page" :length="pageCount"></v-pagination>
          </template>
        </v-data-iterator>
      </v-col>
    </v-row>
    <v-dialog
      :model-value="!!charaDetailTargetId"
      @update:model-value="
        (v: boolean) => {
          if (!v) closeCharaDetail();
        }
      "
      :persistent="dl.isBusy()"
      :close-on-back="false"
      scrollable
      scroll-strategy="none"
      fullscreen
      @after-enter="focusCharaDetailCard"
    >
      <CharaDetailCard
        v-if="charaDetailTargetId"
        ref="charaDetailCardRef"
        :targetId="charaDetailTargetId"
        :items="itemsSrc"
        :prevCharaId="navCharaId.prev"
        :nextCharaId="navCharaId.next"
        v-model:statMode="charaListState.statMode"
        @clickEsc="closeCharaDetail"
        @clickProfileKeyword="setProfileKeyword"
        @clickKeyword="setKeyword"
        @changeTargetId="showCharaDetail"
      />
    </v-dialog>
  </v-container>
</template>
