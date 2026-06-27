<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { sendMessage } from '@/scripts/extMessage';
import { useBulkDownloadState } from './composables/useBulkDownloadState';
import { bulkDownloadStats, type BulkDownloadPhase } from '@/scripts/bulkDownloadState';

const { bulkDownload, active } = useBulkDownloadState();

const fmtSize = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const PHASE_TEXT: Record<BulkDownloadPhase, string> = {
  scanning: '確認中',
  running: 'DL中',
  waiting: '待機中',
  done: '完了',
  stopped: '停止',
  error: 'エラー',
};

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)));
onUnmounted(() => clearInterval(timer));

const stats = computed(() => (bulkDownload.value ? bulkDownloadStats(bulkDownload.value.items) : null));
const currentName = computed(() => {
  const b = bulkDownload.value;
  if (!b || (b.phase !== 'running' && b.phase !== 'waiting')) return '';
  return b.items.find((i) => i.status === 'pending')?.name ?? '';
});
const alertType = computed(() => (bulkDownload.value?.phase === 'error' ? 'error' : active.value ? 'info' : 'success'));
const statusText = computed(() => (bulkDownload.value ? PHASE_TEXT[bulkDownload.value.phase] : ''));
const isTokenError = computed(() => bulkDownload.value?.phase === 'error' && bulkDownload.value.tokenError);
const remainSec = computed(() => {
  const b = bulkDownload.value;
  if (b?.phase !== 'waiting' || !b.nextDownloadAt) return null;
  return Math.ceil((b.nextDownloadAt - now.value) / 1000);
});
const remainText = computed(() => {
  const s = remainSec.value;
  if (s === null || s <= 0) return '';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
const overdue = computed(() => remainSec.value !== null && remainSec.value <= 0);
const scanning = computed(() => bulkDownload.value?.phase === 'scanning');
const busy = computed(() => bulkDownload.value?.phase === 'running' || overdue.value || scanning.value);
const sizeText = computed(() => {
  const s = stats.value;
  if (!s || s.done === 0) return '';
  return `DL済 ${fmtSize(s.bytes)} / 推定合計 ${fmtSize((s.bytes / s.done) * s.total)}`;
});
const etaText = computed(() => {
  const s = stats.value;
  const b = bulkDownload.value;
  if (!s || !b || !active.value || !s.pending) return '';
  const m = s.pending * b.intervalMin;
  const h = Math.floor(m / 60);
  return h ? `約${h}時間${m % 60}分` : `約${m}分`;
});

const stop = () => void sendMessage('bulkDownload/stop').catch(() => {});
</script>

<template>
  <v-alert v-if="bulkDownload" :type="alertType" variant="tonal" density="compact">
    <div>
      {{ currentName || '—' }}（{{ stats?.processed ?? 0 }} / {{ stats?.total ?? 0 }}）
      <span :class="{ 'text-orange font-weight-medium': active }">
        <template v-if="scanning">フォルダを確認中…</template>
        <template v-if="!scanning"
          >{{ statusText }}<span v-if="remainText"> あと {{ remainText }}</span
          ><span v-if="overdue"> まもなく開始…</span></template
        >
        <v-progress-circular v-if="busy" indeterminate size="14" width="2" class="ml-2" />
      </span>
    </div>
    <div>
      （DL {{ stats?.done ?? 0 }} / スキップ {{ stats?.skipped ?? 0 }} / 失敗 {{ stats?.failed ?? 0 }}）<span v-if="sizeText">
        ／ {{ sizeText }}</span
      >
    </div>
    <div v-if="etaText">完了まで {{ etaText }}</div>
    <div v-if="bulkDownload.phase === 'error' && bulkDownload.lastError">エラー: {{ bulkDownload.lastError }}</div>
    <div v-if="isTokenError" class="mt-1">トークンを更新したら、もう一度「開始」してください。</div>
    <div v-if="active" class="mt-2">
      <v-btn color="error" variant="outlined" size="small" @click="stop">停止（中断）</v-btn>
    </div>
  </v-alert>
</template>
