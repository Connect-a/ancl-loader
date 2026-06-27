<script setup lang="ts">
import { computed } from 'vue';
import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import {
  dmgTypeIcons,
  categoryIcons,
  eleTypeIcons,
  overlapChars,
  createDefaultDetailFilter,
  type DetailFilter,
  type AttributeIcon,
} from '@/constants/characterAttributes';

const filter = defineModel<DetailFilter>('filter', { required: true });
const open = defineModel<boolean>('open', { default: true });

type SummaryItem = { kind: 'icon'; icon: AttributeIcon } | { kind: 'text'; label: string };

const filterSummaryGroups = computed(() => {
  const f = filter.value;
  const groups: Array<Array<SummaryItem>> = [];
  if (f.notDownloadedYet) groups.push([{ kind: 'text', label: '未DL' }]);
  if (f.acquiredCharacter) groups.push([{ kind: 'text', label: '所持済み' }]);
  if (f.excludeCollab) groups.push([{ kind: 'text', label: 'コラボ除外' }]);
  if (f.hasOverlapStory) groups.push([{ kind: 'text', label: '天衣EP' }]);
  const icons = (keys: Array<number>, map: Map<number, AttributeIcon>) =>
    keys.flatMap((k) => {
      const v = map.get(k);
      return v ? [{ kind: 'icon' as const, icon: v }] : [];
    });
  if (f.dmgType?.length) groups.push(icons(f.dmgType, dmgTypeIcons));
  if (f.category?.length) groups.push(icons(f.category, categoryIcons));
  if (f.eleType?.length) groups.push(icons(f.eleType, eleTypeIcons));
  if (f.rarity?.length) groups.push(f.rarity.map((v) => ({ kind: 'text' as const, label: `★${v}` })));
  if (f.currentRarity?.length) groups.push(f.currentRarity.map((v) => ({ kind: 'text' as const, label: `現★${v}` })));
  if (f.overlap?.length) groups.push(f.overlap.map((v) => ({ kind: 'text' as const, label: overlapChars[v] ?? '?' })));
  return groups;
});

const hasActiveFilter = computed(() => filterSummaryGroups.value.length > 0);

const reset = () => {
  Object.assign(filter.value, createDefaultDetailFilter());
};
</script>

<template>
  <fieldset class="rounded border-thin pa-2" style="border-color: rgba(var(--v-border-color), var(--v-border-opacity))">
    <legend
      class="text-subtitle-2 text-medium-emphasis px-1 d-inline-flex align-center ga-2 cursor-pointer"
      style="min-height: 40px"
      @click="open = !open"
    >
      <v-icon :icon="open ? mdiChevronUp : mdiChevronDown" size="small" />
      フィルタ
      <v-slide-x-transition>
        <v-btn v-if="hasActiveFilter" variant="outlined" size="small" class="mx-2" @click.stop="reset">リセット</v-btn>
      </v-slide-x-transition>
      <v-slide-x-transition>
        <span v-if="hasActiveFilter" class="d-inline-flex align-center text-info" @click.stop>
          <template v-for="(group, gi) in filterSummaryGroups" :key="gi">
            <span v-if="gi > 0" class="text-medium-emphasis mx-1">/</span>
            <template v-for="(item, ii) in group" :key="ii">
              <v-icon v-if="item.kind === 'icon'" :icon="item.icon.icon" :color="item.icon.color" size="x-small" :title="item.icon.title" />
              <span v-else class="text-caption">{{ item.label }}</span>
            </template>
          </template>
        </span>
      </v-slide-x-transition>
    </legend>
    <div v-show="open">
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <v-checkbox density="compact" hide-details label="未ダウンロード" v-model="filter.notDownloadedYet" />
        <v-checkbox density="compact" hide-details label="所持済み" v-model="filter.acquiredCharacter" />
        <v-checkbox density="compact" hide-details label="コラボ・限定除外" v-model="filter.excludeCollab" />
        <v-checkbox density="compact" hide-details label="天衣覚醒エピソードあり" v-model="filter.hasOverlapStory" />
      </div>
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <v-label text="タイプ" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.dmgType" multiple>
          <v-chip v-for="[key, v] of dmgTypeIcons" :key="key" :value="key" filter :title="v.title">
            <v-icon :icon="v.icon" size="small" :color="v.color" />
          </v-chip>
        </v-chip-group>
        <v-label text="役割" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.category" multiple>
          <v-chip v-for="[key, v] of categoryIcons" :key="key" :value="key" filter :title="v.title">
            <v-icon :icon="v.icon" size="small" :color="v.color" />
          </v-chip>
        </v-chip-group>
      </div>
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <v-label text="属性" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.eleType" multiple>
          <v-chip v-for="[key, v] of eleTypeIcons" :key="key" :value="key" filter :title="v.title">
            <v-icon :icon="v.icon" size="small" :color="v.color" />
          </v-chip>
        </v-chip-group>
      </div>
      <div class="d-flex align-center flex-wrap ga-2 mb-1">
        <v-label text="元レアリティ" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.rarity" multiple>
          <v-chip :value="1" filter><span class="text-amber">★1</span></v-chip>
          <v-chip :value="2" filter><span class="text-amber">★2</span></v-chip>
          <v-chip :value="3" filter><span class="text-amber">★3</span></v-chip>
        </v-chip-group>
        <v-label text="天衣覚醒" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.overlap" multiple>
          <v-chip v-for="(ch, i) in overlapChars" :key="i" :value="i" filter>
            <span class="text-cyan">{{ ch }}</span>
          </v-chip>
        </v-chip-group>
      </div>
      <div class="d-flex align-center flex-wrap ga-2">
        <v-label text="現在レアリティ" class="text-subtitle-1 text-medium-emphasis" />
        <v-chip-group v-model="filter.currentRarity" multiple>
          <v-chip v-for="n in 5" :key="n" :value="n" filter
            ><span class="text-light-blue-lighten-3">★{{ n }}</span></v-chip
          >
        </v-chip-group>
      </div>
    </div>
  </fieldset>
</template>
