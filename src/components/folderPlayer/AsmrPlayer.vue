<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { mdiArrowLeft, mdiPlay } from '@mdi/js';
import { Unzipper, type IUnzipper } from '@/scripts/zip';
import { BlobUrlRegistry } from '@/scripts/blobUrlRegistry';
import type { ZipEntry } from './types';

type ChapterItem = {
  name: string;
  order: number;
  audioPath: string;
  imagePath: string | null;
  thumbnailUrl: string;
};

const props = defineProps<{
  entry: ZipEntry;
}>();

const emit = defineEmits<{
  close: [];
}>();

const chapterThumbnailUrls = new BlobUrlRegistry();
const selectedChapterUrls = new BlobUrlRegistry();

let zip: IUnzipper | null = null;
const chapters = ref<Array<ChapterItem>>([]);
const selectedChapter = ref<ChapterItem | null>(null);
const selectedChapterAudioUrl = ref('');
const selectedChapterImageUrl = ref('');
const loadingEntry = ref(false);
const loadingChapter = ref(false);
const error = ref('');

const reset = () => {
  zip = null;
  chapterThumbnailUrls.revokeAll();
  selectedChapterUrls.revokeAll();
  chapters.value = [];
  selectedChapter.value = null;
  selectedChapterAudioUrl.value = '';
  selectedChapterImageUrl.value = '';
  error.value = '';
};

const loadEntry = async (entry: ZipEntry) => {
  reset();
  loadingEntry.value = true;

  try {
    zip = await Unzipper.open(await entry.fileHandle.getFile());

    const audioFiles = zip.entries.filter((e) => !e.directory && e.filename.endsWith('.m4a'));
    for (const af of audioFiles) {
      const pathParts = af.filename.split('/');
      if (pathParts.length < 2) continue;
      const folderPath = pathParts.slice(0, -1).join('/');
      const [orderStr, ...nameParts] = pathParts.at(-2)!.split('_');
      const order = Number(orderStr) || 0;
      const name = nameParts.join('_') || pathParts.at(-2)!;
      const imageFile = zip.entries.find((e) => !e.directory && e.filename.startsWith(`${folderPath}/`) && /\.jpe?g$/i.test(e.filename));
      chapters.value.push({ name, order, audioPath: af.filename, imagePath: imageFile?.filename ?? null, thumbnailUrl: '' });
    }
    chapters.value.sort((a, b) => a.order - b.order);
    await Promise.all(
      chapters.value.map(async (chapter) => {
        if (!chapter.imagePath) return;
        const blob = await zip!.readFileAsBlobAsync(chapter.imagePath);
        if (blob) chapter.thumbnailUrl = chapterThumbnailUrls.create(blob);
      }),
    );
  } catch (e) {
    error.value = `ZIP読み込みエラー: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    loadingEntry.value = false;
  }
};

watch(
  () => props.entry,
  (e) => void loadEntry(e),
  { immediate: true },
);
onBeforeUnmount(() => reset());

const selectChapter = async (chapter: ChapterItem) => {
  if (!zip) return;
  selectedChapterUrls.revokeAll();
  selectedChapterAudioUrl.value = '';
  selectedChapterImageUrl.value = '';
  selectedChapter.value = chapter;
  loadingChapter.value = true;

  try {
    const audioBlob = await zip.readFileAsBlobAsync(chapter.audioPath);
    if (audioBlob) selectedChapterAudioUrl.value = selectedChapterUrls.create(audioBlob);
    const imageBlob = await zip.readFileAsBlobAsync(chapter.imagePath ?? '');
    if (imageBlob) selectedChapterImageUrl.value = selectedChapterUrls.create(imageBlob);
  } finally {
    loadingChapter.value = false;
  }
};
</script>

<template>
  <v-btn :prepend-icon="mdiArrowLeft" variant="text" size="small" class="mb-2" @click="emit('close')">一覧に戻る</v-btn>
  <v-progress-circular v-if="loadingEntry" indeterminate class="d-block mx-auto my-4" />
  <v-alert v-if="!loadingEntry && error" type="error" variant="tonal" density="compact" class="mb-2">{{ error }}</v-alert>
  <v-card v-if="!loadingEntry" color="blue darken-4" density="compact">
    <v-card-title>{{ entry.name }}</v-card-title>
    <v-card-text>
      <v-list density="compact">
        <v-list-item
          v-for="chapter in chapters"
          :key="chapter.order"
          :active="selectedChapter?.order === chapter.order"
          :disabled="loadingChapter"
          @click="selectChapter(chapter)"
        >
          <template #prepend>
            <v-img v-if="chapter.thumbnailUrl" :src="chapter.thumbnailUrl" width="80" :aspect-ratio="16 / 9" cover class="rounded mr-3" />
            <v-icon v-if="!chapter.thumbnailUrl" :icon="mdiPlay" />
          </template>
          <template #title>{{ chapter.name }}</template>
        </v-list-item>
      </v-list>
      <v-progress-circular v-if="loadingChapter" indeterminate class="d-block mx-auto my-4" />
      <template v-if="!loadingChapter && selectedChapter">
        <v-img v-if="selectedChapterImageUrl" :src="selectedChapterImageUrl" max-height="300" contain rounded="sm" class="mb-2" />
        <audio v-if="selectedChapterAudioUrl" :key="selectedChapterAudioUrl" :src="selectedChapterAudioUrl" controls autoplay class="w-100" />
      </template>
    </v-card-text>
  </v-card>
</template>
