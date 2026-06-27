<script setup lang="ts">
import { onMounted } from 'vue';
import StatusCard from './StatusCard.vue';
import { useBulkDownloadState } from './composables/useBulkDownloadState';
import { clearBulkDownloadBadge } from '@/scripts/bulkDownloadAlert';

const { bulkDownload } = useBulkDownloadState();

// この画面を見た＝既読として持続バッジをクリア
onMounted(() => void clearBulkDownloadBadge());
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>一括ダウンロード状況</v-card-title>
      <v-card-text>
        <StatusCard />
        <p v-if="!bulkDownload" class="text-medium-emphasis mb-0">実行中・完了の一括ダウンロードはありません。</p>
        <p class="text-body-2 text-medium-emphasis mt-3 mb-1">再開・新規の設定は各一覧から行えます。</p>
        <div class="d-flex ga-2">
          <v-btn :to="{ name: 'Home' }" variant="outlined" size="small">キャラ一覧へ</v-btn>
          <v-btn :to="{ name: 'Story' }" variant="outlined" size="small">ストーリーへ</v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>
