<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { assets, type Asset } from '@/scripts/resolver/asset';
import type { NormalizedStoryElement } from '../types';

type FrameListEntry = { speaker: string; text: string; index: number; iconId: string };

const props = defineProps<{
  open: boolean;
  elements: ReadonlyArray<NormalizedStoryElement>;
  currentIndex: number;
  resolveAsset: (asset: Asset) => Promise<string | null>;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  jump: [index: number];
}>();

const frameIcons = ref(new Map<string, string>());
const frameList = computed<Array<FrameListEntry>>(() =>
  props.elements.flatMap((el, index) => (el.text ? [{ speaker: el.speaker, text: el.text, index, iconId: el.backlog_icon_id }] : [])),
);
watch(
  frameList,
  async (list) => {
    const iconIds = new Set(list.map((e) => e.iconId).filter((id) => id && id !== '1'));
    for (const id of iconIds) {
      const url = await props.resolveAsset(assets.charaImage(id, 'ss.png'));
      if (url) frameIcons.value.set(id, url);
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) nextTick(() => document.querySelector('.backlog-current-frame')?.scrollIntoView({ block: 'center' }));
  },
);
</script>

<template>
  <v-navigation-drawer :model-value="open" @update:model-value="emit('update:open', $event)" location="left" temporary width="400" @click.stop>
    <template #prepend>
      <v-list-subheader class="px-4">バックログ</v-list-subheader>
    </template>
    <v-list density="compact" style="--v-list-item-subtitle-opacity: 0.7">
      <v-list-item
        v-for="entry in frameList"
        :key="entry.index"
        :class="['cursor-pointer border-b-thin border-opacity-25', { 'backlog-current-frame': entry.index === currentIndex }]"
        @click="emit('jump', entry.index)"
      >
        <template #prepend>
          <v-avatar :image="frameIcons.get(entry.iconId)" rounded="0" size="40" class="mr-3" />
        </template>
        <v-list-item-title class="text-amber text-caption">{{ entry.speaker }}</v-list-item-title>
        <v-list-item-subtitle class="text-body-2 text-pre-line">{{ entry.text }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
.backlog-current-frame {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  background: rgba(var(--v-theme-primary), 0.18);
}
</style>
