<script setup lang="ts">
import { computed, ref } from 'vue';
import { mdiPlay } from '@mdi/js';
import { useMainStore } from '@/store';
import { useAdditionalDataStore } from '@/store/additionalDataStore';
import DownloadButton from '@/components/DownloadButton.vue';
import BulkDownloadStart from '@/components/bulkDownload/BulkDownloadStart.vue';
import { setDownloadMessage } from '@/composables/useDownloadAction';
import { runAsmrSectionDownload } from '@/repository/download/asmr';
import { toAsmrAdditionalChapters } from '@/repository/gameDataResolver';
import { enabledAsmrSectionIds, asmrPriceYen } from '@/repository/asmrSection';
import { AnchorWriter } from '@/repository/download/writer';
import { eventAssets } from '@/repository/assetMap';
import type { BulkDownloadCandidate } from '@/scripts/bulkDownloadState';
import type { AsmrSection } from '@/@types';

const mainStore = useMainStore();
const additionalDataStore = useAdditionalDataStore();

const nowSec = Math.floor(Date.now() / 1000);
type AsmrPurchaseStatus = 'free' | 'owned' | 'purchasable' | 'unavailable';
const badgeMap = new Map<AsmrPurchaseStatus, { label: string; color: string }>([
  ['free', { label: '無料', color: 'success' }],
  ['owned', { label: '購入済み', color: 'grey' }],
  ['purchasable', { label: '購入可能', color: 'primary' }],
  ['unavailable', { label: '購入不能', color: 'grey-darken-1' }],
]);

// 二重展開防止で解決済みの行はボタンをdisabled。未開放でも試聴可
const loadingId = ref('');
const sampleUrls = ref(new Map<string, string>());

const additionalChapters = computed(() => toAsmrAdditionalChapters(additionalDataStore.voiceAdditionalData ?? []));
const enableSectionIdSet = computed(() => enabledAsmrSectionIds(mainStore.voice, mainStore.initData, additionalChapters.value));
const ownedVoice = computed(() => new Set(mainStore.initData?.result.player_data.voice ?? []));
// 無料(num0)→所持→課金(期間内=購入可/期間外=不能)
const statusOf = (s: AsmrSection): AsmrPurchaseStatus => {
  if (s.pay.data.num === 0) return 'free';
  if (ownedVoice.value.has(s.section_id)) return 'owned';
  const { start_time, end_time } = s.limit;
  const inWindow = (!start_time || nowSec >= start_time) && (!end_time || nowSec <= end_time);
  return inWindow ? 'purchasable' : 'unavailable';
};
// 一括DLは開放済みセクションのみ
const bulkDownloadSections = computed<Array<BulkDownloadCandidate>>(() =>
  Object.values(mainStore.voice?.all.section ?? {})
    .filter((s) => enableSectionIdSet.value.has(s.section_id))
    .map((s) => ({ id: s.section_id, name: s.name, fullyUnlocked: true })),
);
const items = computed(() =>
  Object.values(mainStore.voice?.all?.section ?? {})
    .map((x) => ({ ...x, title: `${x.section_id} : ${x.name}`, badge: badgeMap.get(statusOf(x))! }))
    .sort((a, b) => a.section_id.localeCompare(b.section_id)),
);

// サンプルのchapterHTMLから先頭voiceを引いて再生URLにする
const playSample = async (section: AsmrSection): Promise<void> => {
  if (loadingId.value === section.section_id || sampleUrls.value.has(section.section_id) || !section.sample_id) return;
  loadingId.value = section.section_id;
  try {
    const html = await (await fetch(eventAssets.asmrHtml(section.sample_id))).text();
    const voicePath = html.match(/\/(voice\/.+?\.m4a)/)?.[1];
    if (voicePath) sampleUrls.value.set(section.section_id, eventAssets.voice(section.sample_id, voicePath.replace('voice/', '')));
  } catch {
    /* 取得失敗は無視 */
  } finally {
    loadingId.value = '';
  }
};

const downloadSection = async (section: AsmrSection): Promise<void> => {
  await runAsmrSectionDownload(
    new AnchorWriter(),
    section,
    enableSectionIdSet.value.has(section.section_id) ? (mainStore.voice?.all.chapter[section.section_id] ?? []) : [],
    additionalChapters.value,
    mainStore.token,
    setDownloadMessage,
  );
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
                ASMRのダウンロード
                <ul>
                  <li>解放されていないASMRは情報が取れないためサンプル等のみダウンロード可能</li>
                  <li>ASMRを解放したらヘッダーのボタンから再読み込み</li>
                </ul>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <v-card>
          <v-card-title class="d-flex align-center ga-2 flex-wrap">
            <v-spacer />
            <BulkDownloadStart :mode="{ kind: 'asmr', sections: bulkDownloadSections, label: 'ASMR' }" />
          </v-card-title>
          <v-card-text>
            <div v-for="item in items" :key="item.section_id" class="mb-6">
              <div class="d-flex align-center ga-4 flex-nowrap">
                <v-img width="256" class="flex-grow-0" :src="eventAssets.sectionThumb(item.img)" />
                <div>
                  <div class="d-flex align-center ga-2 mb-1">
                    <v-chip size="small" variant="flat" :color="item.badge.color">{{ item.badge.label }}</v-chip>
                    <span v-if="asmrPriceYen(item)" class="text-caption text-medium-emphasis">{{ asmrPriceYen(item)?.toLocaleString() }}円</span>
                  </div>
                  <div class="text-subtitle-1 mb-1">{{ item.title }}</div>
                  <ul class="ma-0">
                    <li
                      v-for="chapter of mainStore.voice?.all.chapter[item.section_id]"
                      :key="chapter.ch_id"
                      :style="[enableSectionIdSet.has(item.section_id) ? '' : { 'text-decoration': 'line-through' }]"
                    >
                      {{ chapter.ch_id }} : {{ chapter.name }}
                    </li>
                  </ul>
                </div>
              </div>

              <div class="d-flex align-center ga-2 flex-nowrap mt-3">
                <DownloadButton :id="item.section_id" requires-token :task="() => downloadSection(item)" />
                <v-btn
                  v-if="item.sample_id"
                  :prepend-icon="mdiPlay"
                  :loading="loadingId === item.section_id"
                  :disabled="sampleUrls.has(item.section_id)"
                  variant="tonal"
                  @click="playSample(item)"
                >
                  サンプル試聴
                </v-btn>
                <audio v-if="sampleUrls.get(item.section_id)" :src="sampleUrls.get(item.section_id)" controls autoplay />
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
