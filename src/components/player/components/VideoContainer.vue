<script setup lang="ts">
import { computed, reactive } from 'vue';
import { mdiArrowExpandHorizontal, mdiPlaySpeed } from '@mdi/js';

export type VideoMedia = {
  name: string;
  blob: Blob;
};

const props = defineProps<{ media: VideoMedia; volume: number }>();
const state = reactive({
  expandMovie: false,
  loop: true,
  loopRange: new Array<number>(0, 0),
  playbackRate: 1,
  duration: 0,
  playing: false,
  volume: 1,
});

const srcUrl = computed(() => URL.createObjectURL(props.media.blob));

const emit = defineEmits<{
  clickExpand: [];
}>();

const getVideo = () => document.getElementById(props.media.name) as HTMLVideoElement;

const toggleControl = (event: ToggleEvent) => {
  const v = getVideo();
  switch (event.newState) {
    case 'open':
      v.controls = true;
      return;
    case 'closed':
      v.controls = false;
      return;
    default:
      return;
  }
};

const onLoaded = () => {
  const v = getVideo();
  state.duration = v.duration;
  state.loopRange.splice(1, 1, state.duration);

  v.ontimeupdate = (_ev) => {
    if (v.currentTime < state.loopRange[0]) v.currentTime = state.loopRange[0];

    if (v.currentTime > state.loopRange[1]) {
      if (state.loop) v.currentTime = state.loopRange[0];
      if (!state.loop) {
        v.pause();
        v.currentTime = state.loopRange[0];
        state.playing = false;
      }
    }
  };

  v.onended = (_ev) => {
    if (state.loop) v.play();

    state.playing = false;
  };
};

// control
const togglePlay = () => {
  state.playing = !state.playing;
  if (state.playing) getVideo().pause();
  if (!state.playing) getVideo().play();
};

const setPlaybackRate = (rate?: number) => {
  const v = getVideo();
  if (rate) state.playbackRate = rate;
  // HACK:微小値は設定不可でExceptionとなるためreturnする。
  if (state.playbackRate < 0.07) return;
  v.playbackRate = state.playbackRate;
};

const fullscreen = () => getVideo().requestFullscreen();
const pip = () => getVideo().requestPictureInPicture();
</script>

<template>
  <figure id="videoContainer" data-fullscreen="false">
    <details @toggle="toggleControl">
      <summary>CTRL</summary>
      <v-card density="compact" tabindex="-1" @keydown.space.prevent="togglePlay" class="focusable">
        <v-card-text class="pa-2">
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
          <!-- <v-slider v-model="state.volume" :prepend-icon="mdiVolumeHigh" density="compact" min="0" :max="1" step="0.01"
            hide-details /> -->
        </v-card-text>
        <v-card-actions class="pa-2">
          <v-btn
            size="x-small"
            variant="outlined"
            @click="pip"
            color="grey"
            title="ピクチャインピクチャ"
            >PiP
          </v-btn>
          <v-btn
            size="x-small"
            variant="outlined"
            @click="emit('clickExpand')"
            color="grey"
            title="広げる"
            >Expand
          </v-btn>
        </v-card-actions>
      </v-card>
    </details>
    <video
      :id="props.media.name"
      :src="srcUrl"
      style="width: 100%"
      loop
      autoplay
      @click="togglePlay"
      @dblclick="fullscreen"
      @loadeddata="onLoaded"
    />
  </figure>
</template>
