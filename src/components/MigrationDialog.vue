<script setup lang="ts">
import { ref } from 'vue';
import { mdiDownload, mdiDatabaseExport } from '@mdi/js';
import { migrateToStorageLocal, downloadBackup } from '@/scripts/storageMigration';

const emit = defineEmits<{
  migrationComplete: [];
}>();

const isMigrating = ref(false);
const migrationError = ref<string | null>(null);

const handleDownloadBackup = () => {
  try {
    downloadBackup();
  } catch (e: unknown) {
    migrationError.value = `バックアップ保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`;
  }
};

const handleMigrate = async () => {
  isMigrating.value = true;
  migrationError.value = null;

  const result = await migrateToStorageLocal();
  if (result.success) {
    emit('migrationComplete');
  } else {
    migrationError.value = result.error ?? '移行に失敗しました';
    isMigrating.value = false;
  }
};
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title>◆データ移行実施願い</v-card-title>
          <v-card-text>
            <p class="mb-2">
              エンクリローダーv2.8から、データの保存先が
              <a href="https://developer.mozilla.org/ja/docs/Web/API/Window/localStorage" target="_blank">localStorage</a>
              から
              <a href="https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/API/storage/local" target="_blank">Extension Storage</a>
              に変更されました。
              <br />
              不慮の事態に備えバックアップを保存してから「データ移行」ボタンを押してください。
            </p>
            <v-table density="compact" class="text-caption text-grey mb-4">
              <thead>
                <tr>
                  <th></th>
                  <th>localStorage</th>
                  <th>Extension Storage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>設計</td>
                  <td>古い</td>
                  <td>モダン</td>
                </tr>
                <tr>
                  <td>容量</td>
                  <td>小さい</td>
                  <td>大きい</td>
                </tr>
                <tr>
                  <td>サイトデータ削除</td>
                  <td>消える</td>
                  <td>影響なし</td>
                </tr>
                <tr>
                  <td>人間の</td>
                  <td>屑</td>
                  <td>鑑</td>
                </tr>
              </tbody>
            </v-table>
            <v-alert v-if="migrationError" type="error" variant="tonal" density="compact" class="mb-4">
              {{ migrationError }}
            </v-alert>

            <p class="text-caption text-grey mb-2">
              バックアップ形式は以前のバージョンと同等です。新バージョンがエラー等で使用できない場合は、以前のバージョンで拡張を上書きインストールし「その他」タブから設定をインポートしてください。
              <br />
              バックアップの保存やデータ移行に失敗したと思われる場合は
              <a href="https://github.com/Connect-a/ancl-loader/issues" target="_blank">GitHub Issues</a>
              にてご報告ください。
            </p>

            <v-btn block variant="outlined" :prepend-icon="mdiDownload" class="mb-2" @click="handleDownloadBackup"> バックアップを保存 </v-btn>
            <v-btn
              block
              color="primary"
              variant="elevated"
              :loading="isMigrating"
              :disabled="isMigrating"
              :prepend-icon="mdiDatabaseExport"
              @click="handleMigrate"
            >
              データ移行
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
