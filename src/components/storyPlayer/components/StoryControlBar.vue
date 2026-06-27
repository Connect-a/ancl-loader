<script setup lang="ts">
import { reactive, computed } from 'vue';
import {
  mdiMenuLeft,
  mdiMenuRight,
  mdiReplay,
  mdiPause,
  mdiPlaySpeed,
  mdiVolumeHigh,
  mdiAccountVoice,
  mdiFormatListBulleted,
  mdiSquare,
  mdiAlertCircle,
  mdiPlayPause,
  mdiTune,
} from '@mdi/js';
import type { NormalizedStoryElement, Panel } from '../types';
import { textSizeFactor } from '../utils/storySource';
import type { PlaybackApi } from '../composables/usePlayback';
import type { VoiceApi } from '../composables/useVoice';

type ControlBarPlayback = Pick<
  PlaybackApi,
  | 'currentIndex'
  | 'current'
  | 'hasPrev'
  | 'hasNext'
  | 'hasMovie'
  | 'autoPlay'
  | 'navigateTo'
  | 'goNext'
  | 'goPrev'
  | 'replayCurrent'
  | 'toggleAutoPlay'
>;
type ControlBarVoice = Pick<VoiceApi, 'voiceBarSegments' | 'voiceBarTooltip' | 'ttsEnabled' | 'voicevox'>;

const props = defineProps<{
  playback: ControlBarPlayback;
  voice: ControlBarVoice;
  elements: ReadonlyArray<NormalizedStoryElement>;
  reservedLines: number;
  showPrefetchWarning: boolean;
  activePanel: Panel | null;
  videoControls: boolean;
  episodeItems: Array<{ title: string; value: string }>;
  sourcePath: string;
  backlogOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  changeEpisode: [sourcePath: string];
  togglePanel: [panel: Panel];
  toggleFrameList: [];
  toggleVideoControls: [];
}>();

const playbackView = reactive(props.playback);
const voiceView = reactive(props.voice);

const textScale = computed(() => textSizeFactor(playbackView.current?.text_size ?? '1'));
</script>

<template>
  <v-sheet color="grey-darken-3" class="border-t-thin border-opacity-10 text-white" @click.stop>
    <div v-if="voiceView.voiceBarSegments.length" class="d-flex ga-0 align-center" style="height: 4px" :title="voiceView.voiceBarTooltip">
      <div
        v-for="(seg, i) in voiceView.voiceBarSegments"
        :key="i"
        class="voice-bar-seg cursor-pointer"
        :class="[seg, { current: i === playbackView.currentIndex }]"
        @click.stop="playbackView.navigateTo(i)"
      />
    </div>
    <div class="d-flex align-center px-3 pt-2 ga-1 cursor-pointer" @click="playbackView.goNext">
      <span class="text-subtitle-1 text-amber font-weight-bold d-inline-block" style="min-height: 1lh">{{
        playbackView.current?.speaker || ''
      }}</span>
      <v-progress-circular v-if="voiceView.voicevox.synthesizing" indeterminate size="14" width="2" color="primary" class="ml-1" />
      <v-icon
        v-if="showPrefetchWarning"
        :icon="mdiAlertCircle"
        size="14"
        color="warning"
        class="ml-1 cursor-pointer"
        title="合成エラーが続いたため先読みを停止しました。読み上げ設定から再接続してください。"
        @click.stop="emit('togglePanel', 'voice')"
      />
      <v-spacer />
      <span class="text-caption text-medium-emphasis">{{ playbackView.currentIndex + 1 }} / {{ elements.length }}</span>
    </div>
    <p
      class="px-3 py-2 ma-0 text-body-1 text-pre-line cursor-pointer"
      :style="{ lineHeight: '1.6', boxSizing: 'content-box', minHeight: reservedLines + 'lh' }"
      @click="playbackView.goNext"
    >
      <span :style="textScale > 1 ? { fontSize: textScale * 100 + '%' } : undefined">{{ playbackView.current?.text }}</span>
    </p>
    <div class="d-flex align-center px-2 pb-2 ga-1">
      <v-btn icon size="small" variant="text" :disabled="!playbackView.hasPrev" @click="playbackView.goPrev" title="前へ">
        <v-icon :icon="mdiMenuLeft" size="x-large" />
      </v-btn>
      <v-btn :icon="mdiReplay" size="small" variant="text" @click="playbackView.replayCurrent" title="ボイス再生" />
      <v-btn icon size="small" variant="text" :disabled="!playbackView.hasNext" @click="playbackView.goNext" title="次へ">
        <v-icon :icon="mdiMenuRight" size="x-large" />
      </v-btn>
      <v-btn
        :icon="playbackView.autoPlay ? mdiPause : mdiPlaySpeed"
        size="small"
        variant="text"
        :color="playbackView.autoPlay ? 'warning' : undefined"
        @click="playbackView.toggleAutoPlay"
        :title="playbackView.autoPlay ? 'オート停止' : 'オート再生'"
      />
      <v-btn :icon="mdiSquare" size="small" variant="text" @click="emit('close')" title="停止" />
      <v-btn
        :icon="mdiFormatListBulleted"
        size="small"
        variant="text"
        :color="backlogOpen ? 'primary' : undefined"
        @click="emit('toggleFrameList')"
        title="バックログ"
      />
      <v-select
        v-if="episodeItems.length"
        :model-value="sourcePath"
        :items="episodeItems"
        item-title="title"
        item-value="value"
        label="エピソード"
        density="compact"
        variant="outlined"
        hide-details
        class="text-caption text-medium-emphasis flex-grow-0"
        :list-props="{ class: 'text-medium-emphasis' }"
        @update:model-value="(v) => emit('changeEpisode', v as string)"
      />
      <v-spacer />
      <v-btn
        :icon="mdiVolumeHigh"
        size="x-small"
        variant="text"
        :color="activePanel === 'volume' ? 'primary' : undefined"
        @click="emit('togglePanel', 'volume')"
        title="音量"
      />
      <v-btn
        :icon="mdiAccountVoice"
        size="x-small"
        variant="text"
        :color="voiceView.ttsEnabled ? 'success' : activePanel === 'voice' ? 'primary' : undefined"
        @click="emit('togglePanel', 'voice')"
        title="読み上げ設定"
      />
      <v-btn
        :icon="mdiTune"
        size="x-small"
        variant="text"
        :color="activePanel === 'audioControls' ? 'primary' : undefined"
        @click="emit('togglePanel', 'audioControls')"
        title="音声コントロール"
      />
      <v-btn
        :icon="mdiPlayPause"
        size="x-small"
        variant="text"
        :color="videoControls ? 'primary' : undefined"
        :disabled="!playbackView.hasMovie"
        @click="emit('toggleVideoControls')"
        title="動画コントロール"
      />
    </div>
  </v-sheet>
</template>

<style scoped>
.voice-bar-seg {
  flex: 1 1 0;
  height: 100%;
  &.seg-zip,
  &.seg-none {
    background: #90caf9;
  }
  &.seg-cached {
    background: #4caf50;
  }
  &.seg-loading {
    background: #ff9800;
    animation: pulse 0.8s ease-in-out infinite alternate;
  }
  &.seg-pending {
    background: rgba(255, 255, 255, 0.15);
  }
  &.current {
    background: #fff;
    height: 8px;
    border-radius: 1px;
  }
}
@keyframes pulse {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}
</style>
