<script setup lang="ts">
import { reactive, ref, nextTick } from 'vue';
import { mdiChevronLeft, mdiChevronRight, mdiClose, mdiArrowSplitHorizontal, mdiArrowSplitVertical, mdiMagnifyPlus } from '@mdi/js';
import type { SidePanelApi } from '../composables/useSidePanel';

const props = defineProps<{ sidePanel: SidePanelApi }>();
// prop内refはtemplateで自動unwrapされないためreactiveでまとめて .valueを解消
const panel = reactive(props.sidePanel);

const imgBox = ref<HTMLElement | null>(null);
const centerScroll = () => {
  const el = imgBox.value;
  if (!el) return;
  el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
};
const toggleOriginalSize = () => {
  panel.toggleOriginalSize();
  nextTick(centerScroll);
};

// はみ出していない時は早期returnでno-op
const startPan = (e: PointerEvent) => {
  const el = imgBox.value;
  if (!el) return;
  if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = el.scrollLeft;
  const startTop = el.scrollTop;
  el.setPointerCapture(e.pointerId);
  const onMove = (ev: PointerEvent) => {
    el.scrollLeft = startLeft - (ev.clientX - startX);
    el.scrollTop = startTop - (ev.clientY - startY);
  };
  const onUp = () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
};
</script>

<template>
  <v-sheet
    tag="aside"
    color="grey-darken-4"
    class="d-flex flex-column overflow-hidden flex-shrink-0"
    :width="panel.vertical ? undefined : `${panel.ratio * 100}%`"
    :height="panel.vertical ? `${panel.ratio * 100}%` : undefined"
  >
    <div class="pa-1 flex-shrink-0">
      <div class="d-flex align-center ga-1">
        <v-btn-toggle :model-value="panel.tab" @update:model-value="panel.changeTab" mandatory density="compact" class="flex-grow-1">
          <v-btn value="sd" size="x-small">SD</v-btn>
          <v-btn value="standing" size="x-small">立ち絵</v-btn>
          <v-btn value="gravure" size="x-small">グラビア</v-btn>
          <v-btn value="other" size="x-small">その他</v-btn>
        </v-btn-toggle>
        <v-btn
          :icon="mdiMagnifyPlus"
          size="x-small"
          variant="text"
          title="原寸表示"
          :color="panel.originalSize ? 'primary' : undefined"
          @click="toggleOriginalSize"
        />
        <v-btn
          :icon="panel.vertical ? mdiArrowSplitVertical : mdiArrowSplitHorizontal"
          size="x-small"
          variant="text"
          title="画面分割縦横切替"
          @click="panel.toggleOrientation"
        />
        <v-btn :icon="mdiClose" size="x-small" variant="text" title="閉じる" @click="panel.toggle" />
      </div>
      <div v-if="panel.currentImages.length" class="d-flex align-center mt-1">
        <v-btn
          :icon="mdiChevronLeft"
          size="small"
          variant="outlined"
          rounded="0"
          class="mx-1"
          :disabled="!panel.hasPrevImage"
          @click="panel.imagePrev"
        />
        <v-select
          :model-value="panel.selectedImageKey"
          :items="panel.imageSelectItems"
          item-title="title"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          class="text-caption"
          @update:model-value="panel.selectImage"
        >
          <template #selection="{ item }">
            <span class="text-truncate">{{ item.title }}</span>
          </template>
        </v-select>
        <v-btn
          :icon="mdiChevronRight"
          size="small"
          variant="outlined"
          rounded="0"
          class="mx-1"
          :disabled="!panel.hasNextImage"
          @click="panel.imageNext"
        />
      </div>
    </div>
    <div ref="imgBox" class="d-flex flex-grow-1 overflow-auto pa-1" :class="{ 'pan-grab': panel.originalSize }" @pointerdown="startPan">
      <img
        v-if="panel.imageUrl"
        :src="panel.imageUrl"
        class="panel-img"
        :class="panel.originalSize ? 'flex-shrink-0' : 'side-panel-img-fit'"
        draggable="false"
        @load="centerScroll"
      />
      <p v-if="!panel.imageUrl" class="text-caption text-medium-emphasis ma-0">画像なし</p>
    </div>
  </v-sheet>
</template>

<style scoped>
/* margin:autoで収まる時は中央、はみ出す時はマージン0で全端スクロール可 (justify/align centerの届かないバグ回避) */
.panel-img {
  margin: auto;
}
.side-panel-img-fit {
  max-width: 100%;
  max-height: 100%;
}
.pan-grab {
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}
</style>
