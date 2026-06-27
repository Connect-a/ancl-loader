<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline } from '@mdi/js';
import { computed } from 'vue';
import { useMainStore } from '@/store';

const mainStore = useMainStore();

const props = defineProps<{
  charaId: string;
}>();

const isAcquired = computed(() => props.charaId in (mainStore.initData?.result.player_data.chara ?? {}));

const storyReleaseState = computed<'all' | 'partial' | 'none'>(() => {
  const charaStories = mainStore.stories?.chara?.story[props.charaId];
  if (!charaStories?.length) return 'none';
  const released = charaStories.filter((s) => mainStore.charaEnableStidMap.has(s.st_id)).length;
  if (released === charaStories.length) return 'all';
  if (released > 0) return 'partial';
  return 'none';
});

const storyChipConfig = computed(() => {
  if (storyReleaseState.value === 'all') {
    return { color: 'green', icon: mdiCheckCircleOutline, text: 'ストーリー開放済み' };
  }
  return { color: 'orange', icon: mdiAlertCircleOutline, text: '未開放ストーリーあり' };
});
</script>

<template>
  <div class="d-flex flex-wrap ga-1">
    <v-chip v-if="isAcquired" color="green" :prepend-icon="mdiCheckCircleOutline" variant="outlined" size="small">所持済み</v-chip>
    <v-chip v-if="!isAcquired" variant="outlined" size="small">未所持</v-chip>
    <v-chip
      v-if="isAcquired || storyReleaseState !== 'none'"
      :color="storyChipConfig.color"
      :prepend-icon="storyChipConfig.icon"
      variant="outlined"
      size="small"
      >{{ storyChipConfig.text }}</v-chip
    >
  </div>
</template>
