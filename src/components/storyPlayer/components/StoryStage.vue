<script setup lang="ts">
import { computed, reactive } from 'vue';
import { getCharaStyle, getEmoticonStyle, getBgStyle, getZoomLayerStyle } from '../utils/layout';
import { defaultEmoticon } from '../types';
import type { StageApi } from '../composables/useStageState';

const props = defineProps<{
  stage: StageApi;
  movieUrls: ReadonlyArray<string>;
  videoControls: boolean;
}>();

// prop内refをtemplateでunwrapするためreactive化
const stageView = reactive(props.stage);
const slotPairs = computed(() => stageView.charaSlots.map((slot, i) => ({ slot, emoticon: stageView.emoticonSlots[i] ?? defaultEmoticon() })));
</script>

<template>
  <div class="story-stage">
    <div class="story-viewport">
      <div class="story-zoom-layer" :style="getZoomLayerStyle(stageView.stageZoom)">
        <div v-show="!stageView.hasMovie" class="story-bg" :style="getBgStyle(stageView.activeBgUrl, stageView.isSceneBg)"></div>

        <template v-for="(pair, i) in slotPairs" :key="i">
          <img v-show="pair.slot.visible && pair.slot.url" :src="pair.slot.url ?? undefined" class="story-chara" :style="getCharaStyle(pair.slot)" />
          <img
            v-show="pair.slot.visible && pair.emoticon.url"
            :src="pair.emoticon.url ?? undefined"
            class="story-emoticon"
            :style="getEmoticonStyle(pair.slot, pair.emoticon)"
          />
        </template>

        <video
          v-for="url in movieUrls"
          :key="url"
          :src="url"
          autoplay
          loop
          :controls="videoControls"
          class="story-movie"
          :class="{ 'movie-active': url === stageView.activeMovieUrl }"
          @click="videoControls && $event.stopPropagation()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-stage {
  position: absolute;
  inset: 0;
  container-type: size;
}

.story-viewport {
  position: absolute;
  width: 1280px;
  height: 720px;
  transform-origin: 0 0;
  --scale: min(100cqw / 1280px, 100cqh / 720px);
  transform: scale(var(--scale));
  left: calc((100cqw - 1280px * var(--scale)) / 2);
  top: calc((100cqh - 720px * var(--scale)) / 2);
  overflow: hidden;
}

.story-zoom-layer {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  transition: transform 0.6s ease;
}

.story-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: background-image 0.5s ease;
}

.story-chara {
  position: absolute;
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 1;
}

.story-emoticon {
  position: absolute;
  height: auto;
  pointer-events: none;
  z-index: 1;
}

.story-movie {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.movie-active {
  opacity: 1;
  z-index: 4;
}
</style>
