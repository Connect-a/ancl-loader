<script setup lang="ts">
import { computed } from 'vue';
import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import {
  sortTargetsBasic,
  sortTargetsPlayerSpecific,
  sortTargetsBattleStats,
  statModeLabels,
  type SortTarget,
  type StatMode,
} from '@/constants/characterAttributes';

const sort = defineModel<SortTarget>('sort', { required: true });
const sortDesc = defineModel<boolean>('sortDesc', { required: true });
const open = defineModel<boolean>('open', { default: true });
const statMode = defineModel<StatMode>('statMode', { required: true });

const currentStatModeLabel = computed(() => statModeLabels.find((m) => m.value === statMode.value)?.label);
const sortLabel = computed(() => {
  const label = [...sortTargetsBasic, ...sortTargetsPlayerSpecific, ...sortTargetsBattleStats].find((x) => x.key === sort.value)?.label;
  if (label && ['hp', 'atk', 'cri', 'def', 'res'].includes(sort.value)) return `${label}（${currentStatModeLabel.value}）`;
  return label;
});
const isAcquiredOnly = computed(() => ['lv', 'rank', 'currentRarity', 'overlap', 'likeLv', 'acquisitionOrder'].includes(sort.value));
</script>

<template>
  <fieldset class="rounded border-thin pa-2" style="border-color: rgba(var(--v-border-color), var(--v-border-opacity))">
    <legend
      class="text-subtitle-2 text-medium-emphasis px-1 d-inline-flex align-center ga-2 cursor-pointer"
      style="min-height: 40px"
      @click="open = !open"
    >
      <v-icon :icon="open ? mdiChevronUp : mdiChevronDown" size="small" />
      ソート
      <v-checkbox density="compact" hide-details label="降順" v-model="sortDesc" @click.stop />
      <span class="text-info text-caption" @click.stop>{{ sortLabel }} {{ sortDesc ? '↓' : '↑' }}</span>
      <span v-if="isAcquiredOnly" class="text-warning text-caption" @click.stop>（未所持キャラ非表示）</span>
    </legend>
    <div v-show="open">
      <v-btn-toggle v-model="sort" color="primary" mandatory>
        <v-btn v-for="item in sortTargetsBasic" :key="item.key" :value="item.key">{{ item.label }}</v-btn>
      </v-btn-toggle>
      <v-btn-toggle v-model="sort" color="primary" mandatory>
        <v-btn v-for="item in sortTargetsPlayerSpecific" :key="item.key" :value="item.key">{{ item.label }}</v-btn>
      </v-btn-toggle>
      <v-divider class="my-2" />
      <div class="d-flex align-center flex-wrap ga-2">
        <v-label text="育成状態" class="text-subtitle-2 text-medium-emphasis" />
        <v-radio-group v-model="statMode" inline density="compact" hide-details>
          <v-radio v-for="m in statModeLabels" :key="m.value" :label="m.label" :value="m.value" />
        </v-radio-group>
      </div>
      <v-btn-toggle v-model="sort" color="primary" mandatory class="mt-1">
        <v-btn v-for="item in sortTargetsBattleStats" :key="item.key" :value="item.key">{{ item.label }}</v-btn>
      </v-btn-toggle>
    </div>
  </fieldset>
</template>
