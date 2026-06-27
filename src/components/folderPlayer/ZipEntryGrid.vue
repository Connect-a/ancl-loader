<script setup lang="ts">
import { computed, ref } from 'vue';
import { mdiClose, mdiRefresh, mdiSortAlphabeticalAscending, mdiSortCalendarAscending, mdiImageMultiple } from '@mdi/js';
import { normalizeForSearch } from '@/utils/search';
import type { ZipEntry, EntryCategory, SortMode } from './types';

type EntrySection = { category: EntryCategory; entries: Array<ZipEntry> };

const props = defineProps<{
  entries: Array<ZipEntry>;
  thumbnailUrlOf: (id: string) => string | undefined;
  requestThumbnail: (entry: ZipEntry) => void;
  cacheThumbnails: boolean;
  reloading?: boolean;
}>();

const emit = defineEmits<{
  select: [entry: ZipEntry];
  reload: [];
  clear: [];
  'toggle-cache': [];
}>();

const CATEGORY_ORDER: Array<EntryCategory> = ['キャラクター', 'イベント', 'メインストーリー', 'ASMR', 'ストーリーキャラ', 'その他'];

const filterText = ref('');
const sortMode = defineModel<SortMode>('sortMode', { default: 'name' });

const NO_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="4" fill="#eeeeee"/><circle cx="23" cy="24" r="5" fill="#c2c2c2"/><path d="M14 46l13-15 8 9 7-7 8 13z" fill="#c2c2c2"/></svg>',
)}`;

const sections = computed((): Array<EntrySection> => {
  const q = normalizeForSearch(filterText.value);
  const filtered = q ? props.entries.filter((e) => normalizeForSearch(e.name).includes(q)) : props.entries;
  const sorted =
    sortMode.value === 'date'
      ? [...filtered].sort((a, b) => b.fileDate.getTime() - a.fileDate.getTime())
      : [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const grouped = Object.groupBy(sorted, (e) => e.category);
  return CATEGORY_ORDER.map((cat) => ({ category: cat, entries: grouped[cat] ?? [] })).filter((s) => s.entries.length > 0);
});
</script>

<template>
  <v-card density="compact">
    <v-card-title class="d-flex align-center ga-2">
      <span>{{ entries.length }}件</span>
      <v-text-field
        v-model="filterText"
        placeholder="フィルタ"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        style="max-width: 200px"
      />
      <v-spacer />
      <v-btn
        :icon="mdiImageMultiple"
        variant="text"
        size="small"
        density="compact"
        :color="cacheThumbnails ? 'primary' : undefined"
        title="サムネキャッシュ"
        @click="emit('toggle-cache')"
      />
      <v-btn-toggle v-model="sortMode" density="compact" variant="outlined" mandatory>
        <v-btn :value="'name'" :icon="mdiSortAlphabeticalAscending" size="small" density="default" title="名前順" />
        <v-btn :value="'date'" :icon="mdiSortCalendarAscending" size="small" density="default" title="日付順（新しい順）" />
      </v-btn-toggle>
      <v-btn :icon="mdiRefresh" variant="text" size="small" density="compact" :loading="reloading" title="再読み込み" @click="emit('reload')" />
      <v-btn :icon="mdiClose" variant="text" size="small" density="compact" title="フォルダ選択をクリア" @click="emit('clear')" />
    </v-card-title>
    <v-card-text>
      <details v-for="section in sections" :key="section.category" class="mb-1" open>
        <summary class="text-subtitle-2 text-medium-emphasis">{{ section.category }} ({{ section.entries.length }})</summary>
        <div class="d-flex flex-wrap align-start ga-2 mt-1">
          <div
            v-for="entry in section.entries"
            :key="entry.id"
            v-intersect.once="(isIntersecting: boolean) => isIntersecting && requestThumbnail(entry)"
            :class="['entry-card cursor-pointer', { 'entry-card-incomplete': entry.incomplete }]"
            @click="emit('select', entry)"
          >
            <div class="position-relative">
              <img :src="thumbnailUrlOf(entry.id) ?? NO_IMAGE" height="64" class="d-block rounded" />
              <v-chip
                v-if="entry.incomplete"
                size="x-small"
                color="incomplete"
                variant="flat"
                class="entry-incomplete-chip position-absolute pointer-events-none"
                >未完</v-chip
              >
            </div>
            <p :class="['entry-name overflow-hidden text-break ma-0 mt-1 text-center', { 'text-incomplete': entry.incomplete }]" :title="entry.name">
              {{ entry.name }}
            </p>
          </div>
        </div>
      </details>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.entry-card {
  display: inline-grid;
  grid-template-columns: min-content;
}
.entry-card-incomplete {
  outline: 1px solid rgb(var(--v-theme-incomplete));
  outline-offset: 2px;
  border-radius: 2px;
}
.entry-incomplete-chip {
  top: 2px;
  right: 2px;
  font-size: 0.5rem;
  height: 16px;
}
.entry-name {
  font-size: 0.6rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
