<script setup lang="ts">
import { mdiFolderCog, mdiCloseCircle } from '@mdi/js';
import { useHomeDir } from '@/composables/useHomeDir';

const { supported, dirName, permission, select, requestPermission, clear } = useHomeDir();

const MDN_URL = 'https://developer.mozilla.org/ja/docs/Web/API/Window/showDirectoryPicker';
const FLAG_URL = 'brave://flags/#native-file-system-api';
const POLICY_URL = 'https://chromeenterprise.google/policies/#DefaultFileSystemWriteGuardSetting';
</script>

<template>
  <v-alert v-if="!supported" type="error" variant="tonal" density="compact">
    <p>このブラウザは <a :href="MDN_URL" target="_blank" rel="noopener noreferrer">File System Access API</a> に非対応か無効です。</p>
    <p>Chrome系の対応しているブラウザで開いてください。</p>
    <p>Braveの有効化フラグ: <a :href="FLAG_URL" target="_blank" rel="noopener noreferrer">brave://flags/#native-file-system-api</a></p>
    <p><a :href="POLICY_URL" target="_blank" rel="noopener noreferrer">ポリシーで無効の場合</a></p>
  </v-alert>
  <div v-if="supported" class="d-flex align-center ga-2 flex-wrap">
    <v-btn :prepend-icon="mdiFolderCog" size="small" color="primary" @click="select">
      {{ dirName ? 'ホームディレクトリを変更' : 'ホームディレクトリを選択' }}
    </v-btn>
    <template v-if="dirName">
      <span class="text-body-2">{{ dirName }}</span>
      <v-chip size="x-small" :color="permission === 'granted' ? 'success' : 'warning'" @click="permission !== 'granted' && requestPermission()">
        {{ permission === 'granted' ? '許可済み' : '要許可（クリック）' }}
      </v-chip>
      <v-btn :icon="mdiCloseCircle" size="x-small" variant="text" title="クリア" @click="clear" />
    </template>
  </div>
</template>
