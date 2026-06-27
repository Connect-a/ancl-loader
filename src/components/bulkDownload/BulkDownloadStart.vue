<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { mdiDownloadMultiple } from '@mdi/js';
import {
  getBulkDownloadOptions,
  setBulkDownloadOptions,
  getBulkDownloadNotify,
  setBulkDownloadNotify,
  type BulkDownloadItemSpec,
  type BulkDownloadItem,
  type BulkDownloadCandidate,
} from '@/scripts/bulkDownloadState';
import { sendMessage } from '@/scripts/extMessage';
import { useBulkDownloadState } from './composables/useBulkDownloadState';
import HomeDirSelect from '../HomeDirSelect.vue';
import StatusCard from './StatusCard.vue';

type BulkDownloadMode =
  | { kind: 'chara'; filtered: Array<BulkDownloadCandidate>; all: Array<BulkDownloadCandidate> }
  | { kind: 'section'; sections: Array<BulkDownloadCandidate>; domain: 'event' | 'main'; label: string }
  | { kind: 'asmr'; sections: Array<BulkDownloadCandidate>; label: string };
const props = defineProps<{ mode: BulkDownloadMode }>();

const { active, bulkDownload } = useBulkDownloadState();

const open = ref(false);
const intervalMin = ref(10);
const scope = ref<'filtered' | 'all'>('filtered');
const overwrite = ref(false);
const unlockedMode = ref<'priority' | 'only'>('priority');
const idDescending = ref(false);
const notify = ref(true);

const isChara = computed(() => props.mode.kind === 'chara');
const title = computed(() => (props.mode.kind === 'chara' ? '一括ダウンロード' : `${props.mode.label}の一括ダウンロード`));
const baseCandidates = computed<Array<BulkDownloadCandidate>>(() =>
  props.mode.kind === 'chara' ? (scope.value === 'all' ? props.mode.all : props.mode.filtered) : props.mode.sections,
);
const targetCandidates = computed(() => {
  let list = unlockedMode.value === 'only' ? baseCandidates.value.filter((c) => c.fullyUnlocked) : [...baseCandidates.value];
  if (idDescending.value) list = [...list].sort((a, b) => b.id.localeCompare(a.id));
  if (unlockedMode.value === 'priority') list = [...list].sort((a, b) => Number(b.fullyUnlocked) - Number(a.fullyUnlocked));
  return list;
});
const queueSpecs = computed<Array<BulkDownloadItemSpec>>(() => {
  const mode = props.mode;
  return targetCandidates.value.map((c) =>
    mode.kind === 'chara'
      ? { kind: 'chara', id: c.id, name: c.name ?? c.id }
      : mode.kind === 'asmr'
        ? { kind: 'asmr', id: c.id, name: c.name ?? c.id }
        : { kind: 'section', id: c.id, name: c.name ?? c.id, domain: mode.domain },
  );
});
const itemRows = computed<Array<BulkDownloadItem>>(() =>
  active.value && bulkDownload.value ? bulkDownload.value.items : queueSpecs.value.map((s): BulkDownloadItem => ({ ...s, status: 'pending' })),
);

const fmtSize = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const statusLabel = (r: BulkDownloadItem): string => {
  if (r.status === 'done') return r.complete === false ? '☑未完' : '☑';
  if (r.status === 'skipped') return 'スキップ';
  if (r.status === 'failed') return '失敗';
  return '—';
};
const start = () => {
  if (!queueSpecs.value.length) return;
  void sendMessage('bulkDownload/start', {
    intervalMin: intervalMin.value,
    items: queueSpecs.value,
    overwrite: overwrite.value,
  }).catch(() => {});
};
const onNotifyChange = (v: boolean | null) => {
  notify.value = v === true;
  void setBulkDownloadNotify(notify.value);
};
const persistOptions = () => {
  if (!isChara.value) return;
  void setBulkDownloadOptions({
    intervalMin: intervalMin.value,
    scope: scope.value,
    overwrite: overwrite.value,
    unlockedMode: unlockedMode.value,
    idDescending: idDescending.value,
  });
};

onMounted(async () => {
  notify.value = await getBulkDownloadNotify();
  if (!isChara.value) return;
  const o = await getBulkDownloadOptions();
  if (o.intervalMin) intervalMin.value = o.intervalMin;
  if (o.scope) scope.value = o.scope;
  if (typeof o.overwrite === 'boolean') overwrite.value = o.overwrite;
  if (o.unlockedMode) unlockedMode.value = o.unlockedMode;
  if (typeof o.idDescending === 'boolean') idDescending.value = o.idDescending;
});
</script>

<template>
  <v-btn :prepend-icon="mdiDownloadMultiple" :color="active ? 'primary' : undefined" variant="outlined" size="small" @click="open = true">
    <v-progress-circular v-if="active" indeterminate size="14" width="2" class="mr-1" />
    {{ active ? '一括ダウンロード中…' : '一括ダウンロード' }}
  </v-btn>

  <v-dialog v-model="open" max-width="600">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" density="compact" class="mb-3">
          ユーザーによる手動やマクロでの連続ダウンロードを抑制するための、大きく安全な間隔をとった一括自動ダウンロード機能。<br />
          ダウンロード中は<strong>ブラウザを閉じないこと</strong>。タブは閉じてもよい。
          <br />トークン切れによるダウンロード中断を極力回避するため先行して「v1」APIから必要なIDの取得をかけている。
          <template v-if="props.mode.kind === 'section'"><br />解放されていないストーリーは取得できないため、未完として保存される。</template>
        </v-alert>
        <p class="text-body-2 mb-2">保存先のホームディレクトリを選択してください。</p>
        <HomeDirSelect />

        <div class="d-flex align-center ga-3 mt-3 flex-wrap">
          <template v-if="isChara">
            <span class="text-body-2">範囲</span>
            <v-btn-toggle
              v-model="scope"
              @update:model-value="persistOptions"
              mandatory
              density="compact"
              variant="outlined"
              divided
              :disabled="active"
            >
              <v-btn value="filtered" size="small">検索結果</v-btn>
              <v-btn value="all" size="small">全キャラ</v-btn>
            </v-btn-toggle>
          </template>
          <span class="text-body-2">間隔</span>
          <v-btn-toggle
            v-model="intervalMin"
            @update:model-value="persistOptions"
            mandatory
            density="compact"
            variant="outlined"
            divided
            :disabled="active"
          >
            <v-btn :value="3" size="small">3分</v-btn>
            <v-btn :value="5" size="small">5分</v-btn>
            <v-btn :value="10" size="small">10分（推奨）</v-btn>
          </v-btn-toggle>
        </div>

        <div class="d-flex align-center ga-3 mt-3 flex-wrap">
          <span class="text-body-2">既存</span>
          <v-btn-toggle
            v-model="overwrite"
            @update:model-value="persistOptions"
            mandatory
            density="compact"
            variant="outlined"
            divided
            :disabled="active"
          >
            <v-btn :value="false" size="small">スキップ</v-btn>
            <v-btn :value="true" size="small">上書き</v-btn>
          </v-btn-toggle>
          <v-checkbox
            v-if="isChara"
            v-model="idDescending"
            @update:model-value="persistOptions"
            label="ID降順でダウンロード"
            density="compact"
            hide-details
            :disabled="active"
          />
        </div>
        <div v-if="!overwrite && isChara" class="text-caption text-medium-emphasis mt-1">
          ※ ストーリー未完でダウンロード済みのキャラについてもスキップされるため、必要に応じて「_キャラ（未開放あり）」フォルダから削除すること。
        </div>

        <div class="d-flex align-center ga-3 mt-3 flex-wrap">
          <span class="text-body-2">ストーリー開放済み</span>
          <v-btn-toggle
            v-model="unlockedMode"
            @update:model-value="persistOptions"
            mandatory
            density="compact"
            variant="outlined"
            divided
            :disabled="active"
          >
            <v-btn value="only" size="small">開放済みのみ</v-btn>
            <v-btn value="priority" size="small">開放済みを優先</v-btn>
          </v-btn-toggle>
        </div>

        <div class="d-flex align-center ga-3 mt-3 flex-wrap">
          <v-checkbox :model-value="notify" @update:model-value="onNotifyChange" label="完了とエラーの通知" density="compact" hide-details />
        </div>

        <div class="text-body-2 mt-3">サーチ対象 {{ itemRows.length }} 件</div>

        <details class="mt-2">
          <summary class="text-body-2" style="cursor: pointer">ダウンロード状況</summary>
          <div style="max-height: 320px; overflow-y: auto">
            <v-table density="compact">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>状態</th>
                  <th>日時</th>
                  <th class="text-right">サイズ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in itemRows" :key="r.id">
                  <td class="text-no-wrap">{{ r.name }}</td>
                  <td class="text-no-wrap">{{ statusLabel(r) }}</td>
                  <td class="text-no-wrap text-caption">{{ r.at ? new Date(r.at).toLocaleString() : '' }}</td>
                  <td class="text-right text-no-wrap">{{ r.bytes ? fmtSize(r.bytes) : '' }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </details>
        <div class="mt-1 d-flex align-center ga-2 flex-wrap">
          <v-btn color="primary" :disabled="active || !queueSpecs.length" @click="start">開始</v-btn>
        </div>

        <StatusCard class="mt-2" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="open = false">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
