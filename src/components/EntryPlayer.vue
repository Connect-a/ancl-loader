<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { mdiClose, mdiArrowLeft } from '@mdi/js';
import StoryPlayer from '@/components/storyPlayer/StoryPlayer.vue';
import StoryList from '@/components/folderPlayer/StoryList.vue';
import AsmrPlayer from '@/components/folderPlayer/AsmrPlayer.vue';
import { useEntrySession } from '@/components/folderPlayer/composables/useEntrySession';
import type { ZipEntry } from '@/components/folderPlayer/types';
import type { IUnzipper } from '@/scripts/zip';

const props = defineProps<{
  entry: ZipEntry | null;
  sharedZip: IUnzipper | null;
  charaHandleMap: ReadonlyMap<string, FileSystemFileHandle>;
  mode?: 'inline' | 'dialog';
}>();
const emit = defineEmits<{ close: [] }>();

const entrySession = useEntrySession();
const playingSourcePath = ref('');

const isAsmr = computed(() => props.entry?.category === 'ASMR');
const dialogMode = computed(() => props.mode === 'dialog');
const title = computed(() => entrySession.manifest.value?.name || props.entry?.name || '');
const fultenWarning = computed(() =>
  entrySession.manifest.value?.group === 'ふるふる転生' ? 'ふるふる転生キャラはストーリー再生時に表示が崩れます' : null,
);

watch(
  () => props.entry,
  (e) => {
    playingSourcePath.value = '';
    if (e && e.category !== 'ASMR') void entrySession.selectEntry(e);
    else entrySession.clear();
  },
  { immediate: true },
);

const close = () => emit('close');
const play = (path: string) => (playingSourcePath.value = path);
const stopPlay = () => (playingSourcePath.value = '');
</script>

<template>
  <AsmrPlayer v-if="entry && isAsmr" :entry="entry" @close="close" />

  <v-dialog v-if="!isAsmr && dialogMode" :model-value="entry !== null" max-width="900" scrollable @update:model-value="(v) => !v && close()">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>{{ title || '再生' }}</span>
        <v-spacer />
        <v-btn :icon="mdiClose" variant="text" size="small" @click="close" />
      </v-card-title>
      <v-card-text>
        <StoryList
          :loading="entrySession.loading.value"
          :episodes="entrySession.manifest.value?.episodes ?? []"
          :thumbnails="entrySession.thumbnails.value"
          :error="entrySession.error.value"
          :warning="fultenWarning"
          @play="play"
        />
      </v-card-text>
    </v-card>
  </v-dialog>

  <div v-if="!isAsmr && !dialogMode && entry">
    <v-btn :prepend-icon="mdiArrowLeft" variant="text" size="small" class="mb-2" @click="close">一覧に戻る</v-btn>
    <v-card color="blue darken-4" density="compact">
      <v-card-title v-if="title">{{ title }}</v-card-title>
      <v-card-text>
        <StoryList
          :loading="entrySession.loading.value"
          :episodes="entrySession.manifest.value?.episodes ?? []"
          :thumbnails="entrySession.thumbnails.value"
          :error="entrySession.error.value"
          :warning="fultenWarning"
          @play="play"
        />
      </v-card-text>
    </v-card>
  </div>

  <v-dialog :model-value="playingSourcePath !== ''" fullscreen @update:model-value="(v) => !v && stopPlay()">
    <StoryPlayer
      v-if="entrySession.entryZip.value && entrySession.manifest.value && playingSourcePath"
      :key="playingSourcePath"
      :entry-zip="entrySession.entryZip.value"
      :shared-zip="sharedZip"
      :chara-handle-map="charaHandleMap"
      :manifest="entrySession.manifest.value"
      :source-path="playingSourcePath"
      :thumbnails="entrySession.thumbnails.value"
      @close="stopPlay"
    />
  </v-dialog>
</template>
