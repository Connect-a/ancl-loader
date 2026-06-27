<script setup lang="ts">
import { computed } from 'vue';
import type { Character } from '@/scripts/character';
import { useMainStore } from '@/store';
import { dmgTypeIcons, categoryIcons, eleTypeIcons, overlapChars, MAX_RARITY, type AttributeIcon } from '@/constants/characterAttributes';

const props = defineProps<{
  chara: Character;
}>();

const mainStore = useMainStore();
const playerChara = computed(() => mainStore.initData?.result.player_data.chara[props.chara.chara_id]);
const battleIcons = computed(() =>
  [dmgTypeIcons.get(props.chara.dmg_type), categoryIcons.get(props.chara.category), eleTypeIcons.get(props.chara.ele_type)].filter(
    (v): v is AttributeIcon => !!v,
  ),
);
</script>

<template>
  <div class="d-flex align-center ga-1">
    <v-icon
      v-for="(v, i) in battleIcons"
      :key="i"
      :icon="v.icon"
      :color="v.color"
      size="small"
      class="bg-grey-darken-2 rounded-circle pa-1"
      :title="v.title"
    />
    <span class="mx-1">
      <span class="text-amber">{{ '★'.repeat(chara.rarity) }}</span>
      <span v-if="playerChara?.rarity != null && playerChara.rarity > chara.rarity" class="text-light-blue-lighten-3">{{
        '★'.repeat(playerChara.rarity - chara.rarity)
      }}</span>
      <span class="text-medium-emphasis">{{ '☆'.repeat(MAX_RARITY - (playerChara?.rarity ?? chara.rarity)) }}</span>
      <span class="text-cyan ml-1" title="天衣覚醒">{{ overlapChars[playerChara?.overlap ?? 0] ?? '⬤' }}</span>
    </span>
    <template v-if="playerChara">
      <v-chip size="x-small" density="compact" label variant="tonal" title="レベル">Lv{{ playerChara.lv }}</v-chip>
      <v-chip size="x-small" density="compact" label variant="tonal" title="ランク">Rk{{ playerChara.rank }}</v-chip>
    </template>
  </div>
</template>
