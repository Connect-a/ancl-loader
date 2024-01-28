<script setup lang="ts">
import { onBeforeMount, reactive, watch } from 'vue';
import {
  mdiArrowExpandHorizontal,
  mdiPlaySpeed,
  mdiVolumeHigh,
  mdiPlay,
  mdiPause,
  mdiRepeat,
  mdiDelete,
} from '@mdi/js';

const props = defineProps<{
  media: {
    name: string;
    blob: Blob;
  };
  volume: number;
}>();

const state = reactive({
  audio: new Audio(),
  loop: true,
  loopRange: new Array<number>(0, 0),
  playbackRate: 1,
  duration: 0,
  playing: false,
  volume: 1,
});

const emit = defineEmits<{
  (_e: 'clickCloseBtn'): void;
}>();

watch(
  () => [props.volume, state.volume],
  () => (state.audio.volume = (props.volume / 100) * state.volume),
);

// Audioイベント
{
  state.audio.ondurationchange = (_ev) => {
    state.duration = state.audio.duration;
    state.loopRange.splice(1, 1, state.audio.duration);
  };

  state.audio.ontimeupdate = (_ev) => {
    if (state.audio.currentTime < state.loopRange[0]) state.audio.currentTime = state.loopRange[0];

    if (state.audio.currentTime > state.loopRange[1]) {
      if (state.loop) state.audio.currentTime = state.loopRange[0];
      if (!state.loop) {
        state.audio.pause();
        state.audio.currentTime = state.loopRange[0];
        state.playing = false;
      }
    }
  };

  state.audio.onended = (_ev) => {
    if (state.loop) state.audio.play();

    state.playing = false;
  };
}

// control
const play = () => {
  state.playing = true;
  state.audio.play();
};
const pause = () => {
  state.playing = false;
  state.audio.pause();
};
const togglePlay = () => {
  if (state.playing) pause();
  if (!state.playing) play();
  state.playing = !state.playing;
};

const setPlaybackRate = (rate?: number) => {
  if (rate) state.playbackRate = rate;
  // HACK:微小値は設定不可でExceptionとなるためreturnする。
  if (state.playbackRate < 0.07) return;
  state.audio.playbackRate = state.playbackRate;
};

const onClickClose = () => {
  state.audio.remove();
  emit('clickCloseBtn');
};

onBeforeMount(() => {
  state.audio.volume = props.volume / 100;
  state.audio.src = URL.createObjectURL(props.media.blob);
});
</script>
<template>
  <v-card density="compact" tabindex="-1" @keydown.space.prevent="togglePlay" class="focusable">
    <v-card-text>
      <v-range-slider
        v-model="state.loopRange"
        :prepend-icon="mdiArrowExpandHorizontal"
        density="compact"
        min="0"
        :max="state.duration"
        step="0.01"
        hide-details
      />
      <v-slider
        v-model="state.playbackRate"
        :prepend-icon="mdiPlaySpeed"
        density="compact"
        min="0"
        :max="3"
        step="0.01"
        hide-details
        @update:modelValue="setPlaybackRate"
        @click:prepend="() => setPlaybackRate(1)"
      />
      <v-slider
        v-model="state.volume"
        :prepend-icon="mdiVolumeHigh"
        density="compact"
        min="0"
        :max="1"
        step="0.01"
        hide-details
      />
    </v-card-text>
    <v-card-actions>
      <v-btn
        v-if="!state.playing"
        size="x-small"
        :icon="mdiPlay"
        color="primary"
        variant="outlined"
        @click="play"
      />
      <v-btn
        v-if="state.playing"
        size="x-small"
        :icon="mdiPause"
        color="primary"
        variant="outlined"
        @click="pause"
      />
      <v-btn
        size="x-small"
        :icon="mdiRepeat"
        :variant="state.loop ? 'flat' : 'outlined'"
        :color="state.loop ? 'green' : 'white'"
        @click="state.loop = !state.loop"
      />
      <v-spacer />
      <v-btn size="x-small" :icon="mdiDelete" variant="outlined" @click="onClickClose" />
    </v-card-actions>
  </v-card>
</template>
