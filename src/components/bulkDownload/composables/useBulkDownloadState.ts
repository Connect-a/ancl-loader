import { ref, computed, onMounted, onScopeDispose } from 'vue';
import { getBulkDownloadState, isBulkDownloadActive, bulkDownloadStateItem, type BulkDownloadState } from '@/scripts/bulkDownloadState';

export const useBulkDownloadState = () => {
  const bulkDownload = ref<BulkDownloadState | null>(null);
  const active = computed(() => (bulkDownload.value ? isBulkDownloadActive(bulkDownload.value.phase) : false));
  let unwatch: (() => void) | undefined;
  onMounted(async () => {
    bulkDownload.value = await getBulkDownloadState();
    unwatch = bulkDownloadStateItem.watch((v) => (bulkDownload.value = v));
  });
  onScopeDispose(() => unwatch?.());
  return { bulkDownload, active };
};
