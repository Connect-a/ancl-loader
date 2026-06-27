<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { mdiClose, mdiVolumeMute, mdiVolumeHigh } from '@mdi/js';
import { useAudioSettingsStore } from '@/store/audioSettingsStore';

defineEmits<{
  close: [];
}>();

const store = useAudioSettingsStore();
const { bgmVolume, bgmMuted, zipVoiceVolume, zipVoiceMuted, voicevoxVolume, voicevoxMuted, webSpeechVolume, webSpeechMuted, seVolume, seMuted } =
  storeToRefs(store);

const rows = [
  { label: 'BGM', volume: bgmVolume, muted: bgmMuted },
  { label: 'ボイス', volume: zipVoiceVolume, muted: zipVoiceMuted },
  { label: 'VOICEVOX', volume: voicevoxVolume, muted: voicevoxMuted },
  { label: 'ブラウザ読み上げ', volume: webSpeechVolume, muted: webSpeechMuted },
  { label: 'SE', volume: seVolume, muted: seMuted },
];
</script>

<template>
  <v-sheet color="grey-darken-3" class="border-t-thin border-b-thin border-opacity-10 px-3 py-2" @click.stop>
    <div class="d-flex align-center mb-1">
      <span class="text-caption text-medium-emphasis">音量</span>
      <v-spacer />
      <v-btn :icon="mdiClose" size="x-small" variant="text" title="閉じる" @click="$emit('close')" />
    </div>
    <div v-for="row in rows" :key="row.label" class="d-flex align-center ga-1 mb-1">
      <span class="text-caption sound-label">{{ row.label }}</span>
      <v-btn :icon="row.muted.value ? mdiVolumeMute : mdiVolumeHigh" size="x-small" variant="text" @click="row.muted.value = !row.muted.value" />
      <v-slider v-model="row.volume.value" :disabled="row.muted.value" min="0" max="1" step="0.05" hide-details density="compact" />
    </div>
  </v-sheet>
</template>

<style scoped>
.sound-label {
  min-width: 100px;
}
</style>
