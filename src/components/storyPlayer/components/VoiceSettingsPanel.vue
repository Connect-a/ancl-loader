<script setup lang="ts">
import { ref, computed } from 'vue';
import { mdiClose, mdiTuneVariant, mdiOpenInNew } from '@mdi/js';
import { useAudioSettingsStore } from '@/store/audioSettingsStore';
import ParamSliders from './ParamSliders.vue';
import type { SpeakerEntry } from '../utils/frameVoice';
import type { VoicevoxValues, VoicevoxMethods } from '../composables/useVoicevox';
import type { WebSpeechValues, WebSpeechMethods } from '../composables/useVoice';

type VoicevoxPanelInfo = Pick<VoicevoxValues, 'available' | 'checking' | 'error' | 'styles' | 'url'> &
  Pick<VoicevoxMethods, 'getStyleId' | 'invalidateSpeakerCache'>;

const props = defineProps<{
  voicevox: VoicevoxPanelInfo;
  ttsSpeakers: ReadonlyArray<SpeakerEntry>;
  webSpeech: WebSpeechValues & WebSpeechMethods;
}>();

defineEmits<{
  close: [];
  toggleTts: [];
  connect: [];
  disconnect: [];
}>();

const VOICEVOX_PARAMS = [
  { key: 'speedScale', label: '速度', min: 0.5, max: 2.0, step: 0.1, digits: 1 },
  { key: 'pitchScale', label: '音高', min: -0.15, max: 0.15, step: 0.01, digits: 2 },
  { key: 'intonationScale', label: '抑揚', min: 0.0, max: 2.0, step: 0.1, digits: 1 },
] as const;

const WEB_SPEECH_PARAMS = [
  { key: 'rate', label: '速度', min: 0.5, max: 2.0, step: 0.1, digits: 1 },
  { key: 'pitch', label: '音高', min: 0, max: 2.0, step: 0.1, digits: 1 },
] as const;

const store = useAudioSettingsStore();

const expandedFor = ref<string | null>(null);

const gridColumns = computed(() => (props.voicevox.available ? 'auto auto minmax(0, 1fr) minmax(0, 1fr)' : 'auto auto minmax(0, 1fr)'));

const toggleExpand = (key: string) => {
  expandedFor.value = expandedFor.value === key ? null : key;
};

const updateVoicevoxStyle = (key: string, styleId: number) => {
  store.setVoicevoxStyle(key, styleId);
  props.voicevox.invalidateSpeakerCache(key);
};
</script>

<template>
  <v-sheet color="grey-darken-3" class="border-t-thin border-b-thin border-opacity-10" :class="{ 'tts--off': !store.ttsEnabled }" @click.stop>
    <div class="px-3 py-2">
      <div class="d-flex align-center ga-2 mb-1">
        <span class="text-caption text-medium-emphasis">読み上げ (TTS)</span>
        <v-switch
          :model-value="store.ttsEnabled"
          :color="voicevox.available ? 'green' : 'primary'"
          :title="store.ttsEnabled ? (voicevox.available ? 'TTS (VOICEVOX)' : 'TTS (Web Speech)') : 'TTS読み上げ'"
          density="compact"
          hide-details
          class="flex-grow-0"
          @update:model-value="$emit('toggleTts')"
        />
        <v-spacer />
        <v-btn :icon="mdiClose" size="x-small" variant="text" title="閉じる" @click="$emit('close')" />
      </div>

      <div class="d-flex align-center ga-1 mb-1 tts-dim">
        <span class="text-caption text-no-wrap" :class="voicevox.available ? 'text-green-lighten-1' : 'text-medium-emphasis'">
          VOICEVOX
          <span v-if="voicevox.available" class="text-green">&#x2713;</span>
        </span>
        <v-text-field
          v-model="store.voicevoxUrl"
          placeholder="http://localhost:50021"
          density="compact"
          variant="outlined"
          hide-details
          class="text-caption"
        />
        <v-btn
          size="small"
          variant="tonal"
          :disabled="voicevox.checking || !store.voicevoxUrl"
          :loading="voicevox.checking"
          @click="$emit('connect')"
        >
          接続
        </v-btn>
        <v-btn v-if="voicevox.available" size="small" variant="tonal" color="error" @click="$emit('disconnect')"> 切断 </v-btn>
        <v-btn
          :icon="mdiOpenInNew"
          size="x-small"
          variant="text"
          density="compact"
          title="VOICEVOX設定画面を開く"
          :disabled="!voicevox.available"
          :href="`${store.voicevoxUrl.replace(/\/+$/, '')}/setting`"
          target="_blank"
          rel="noopener"
        />
      </div>

      <v-alert type="info" variant="tonal" density="compact" class="mb-2 text-caption tts-dim">
        <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener" class="text-blue-lighten-2">VOICEVOX</a>
        をインストールして起動すると、高品質な音声読み上げが利用できます。<br />
        標準のポート（50021）以外を使う場合は拡張機能のmanifest.json内のhost_permissionsも変更してください。<br />
        VOICEVOXが有効でも、合成に失敗したフレームはブラウザ読み上げに自動でフォールバックします。
      </v-alert>
      <v-alert v-if="voicevox.error" type="error" variant="tonal" density="compact" class="mb-2 text-caption tts-dim">
        {{ voicevox.error }}
      </v-alert>
    </div>

    <v-divider />
    <div class="overflow-y-auto px-3 py-2 tts-dim" style="max-height: 280px; scrollbar-gutter: stable">
      <div class="speaker-grid text-caption" :style="{ gridTemplateColumns: gridColumns }">
        <div class="text-medium-emphasis">話者</div>
        <div></div>
        <div v-if="voicevox.available" class="text-medium-emphasis">VOICEVOX</div>
        <div class="text-medium-emphasis">ブラウザ読み上げ</div>

        <template v-for="spk in ttsSpeakers" :key="spk.key">
          <div class="text-amber text-no-wrap cursor-pointer" @click="toggleExpand(spk.key)">{{ spk.label }}</div>
          <div class="d-flex justify-center">
            <v-btn
              :icon="mdiTuneVariant"
              size="x-small"
              variant="text"
              density="compact"
              :color="expandedFor === spk.key ? 'primary' : undefined"
              title="音声パラメータ"
              @click="toggleExpand(spk.key)"
            />
          </div>
          <div v-if="voicevox.available">
            <v-select
              :model-value="voicevox.getStyleId(spk.key)"
              @update:model-value="updateVoicevoxStyle(spk.key, $event as number)"
              :items="voicevox.styles"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              class="text-caption"
            />
          </div>
          <div>
            <v-select
              :model-value="webSpeech.settingOf(spk.key).voice"
              @update:model-value="webSpeech.setSetting(spk.key, 'voice', $event as string)"
              :items="webSpeech.voiceItems"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              class="text-caption"
            />
          </div>
          <v-expand-transition>
            <div v-if="expandedFor === spk.key" class="expand-content">
              <template v-if="voicevox.available">
                <div class="text-medium-emphasis mb-1">&lt;VOICEVOX&gt;</div>
                <ParamSliders
                  :params="VOICEVOX_PARAMS"
                  :values="store.voicevoxParamsOf(spk.key)"
                  @update="(k, v) => store.setVoicevoxParam(spk.key, k, v)"
                  @end="voicevox.invalidateSpeakerCache(spk.key)"
                  class="mb-3"
                />
              </template>
              <div class="text-medium-emphasis mb-1">&lt;ブラウザ読み上げ&gt;</div>
              <ParamSliders
                :params="WEB_SPEECH_PARAMS"
                :values="webSpeech.settingOf(spk.key)"
                @update="(k, v) => webSpeech.setSetting(spk.key, k, v)"
              />
            </div>
          </v-expand-transition>
        </template>
      </div>
    </div>
  </v-sheet>
</template>

<style scoped>
.speaker-grid {
  display: grid;
  align-items: center;
  column-gap: 8px;
  row-gap: 10px;
}
/* 全列を跨ぐ全幅。折りたたみ時はv-ifで行ごと消える（空行が残らない） */
.expand-content {
  grid-column: 1 / -1;
}
/* OFF時はタイトル/トグル行を除いた領域 (.tts-dim) を暗くする */
.tts-dim {
  transition: opacity 0.2s ease;
}
.tts--off .tts-dim {
  opacity: 0.4;
}
</style>
