<script setup lang="ts">
import { mdiHeart, mdiPlay } from '@mdi/js';
import type { Episode } from '@/scripts/resolver/entryManifest';

defineProps<{
  loading: boolean;
  episodes: ReadonlyArray<Episode>;
  thumbnails: ReadonlyMap<string, string>;
  error?: string | null;
  warning?: string | null;
}>();

const emit = defineEmits<{
  play: [sourcePath: string];
}>();

const onItemClick = (e: Episode) => {
  if (e.playable && e.sourcePath) emit('play', e.sourcePath);
};
</script>

<template>
  <v-alert v-if="warning" type="warning" variant="flat" density="compact" class="mb-2">{{ warning }}</v-alert>

  <v-progress-circular v-if="loading" indeterminate class="d-block mx-auto my-4" />

  <v-list v-if="!loading && episodes.length" density="compact">
    <v-list-item v-for="e in episodes" :key="e.folderName" :disabled="!e.playable" @click="onItemClick(e)">
      <template #title>
        <span>{{ e.folderName }}</span>
        <v-icon v-if="e.isLoveScene" :icon="mdiHeart" size="x-small" color="pink" class="ml-1" />
      </template>
      <template #prepend>
        <v-img v-if="thumbnails.get(e.folderName)" :src="thumbnails.get(e.folderName)" width="80" :aspect-ratio="16 / 9" cover class="rounded mr-3" />
        <v-icon v-if="!thumbnails.get(e.folderName)" :icon="mdiPlay" :color="e.playable ? 'primary' : 'grey'" />
      </template>
    </v-list-item>
  </v-list>

  <v-alert v-if="!loading && !episodes.length" type="info" variant="tonal" density="compact"> 再生できるストーリーが見つかりません </v-alert>

  <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">{{ error }}</v-alert>
</template>
