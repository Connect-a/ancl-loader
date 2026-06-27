import { defineStore } from 'pinia';
import { ref, watch, onScopeDispose } from 'vue';
import { storage } from '@wxt-dev/storage';

export type WebSpeechSetting = { voice: string; rate: number; pitch: number };
export type VoicevoxParams = { speedScale: number; pitchScale: number; intonationScale: number };

const defaultVoicevoxParams = (): VoicevoxParams => ({
  speedScale: 1.0,
  pitchScale: 0.0,
  intonationScale: 1.0,
});

const defaultWebSpeechSetting = (): WebSpeechSetting => ({
  voice: '',
  rate: 1.7,
  pitch: 1.0,
});

const audioSettingsItem = storage.defineItem<Record<string, unknown>>('local:audioSettings');

// 保持するvolume値は0–1のパーセンテージ。実音量 = storedVolume * VOLUME_MASTER[channel]。
export const VOLUME_MASTER = {
  bgm: 0.5,
  se: 0.5,
  zipVoice: 1.0,
  voicevox: 1.0,
  webSpeech: 1.0,
} as const;

export const useAudioSettingsStore = defineStore('audioSettings', () => {
  const bgmVolume = ref(0.5);
  const bgmMuted = ref(false);
  const zipVoiceVolume = ref(0.5);
  const zipVoiceMuted = ref(false);
  const voicevoxVolume = ref(0.5);
  const voicevoxMuted = ref(false);
  const webSpeechVolume = ref(0.5);
  const webSpeechMuted = ref(false);
  const seVolume = ref(0.5);
  const seMuted = ref(false);

  const ttsEnabled = ref(true);

  const voicevoxUrl = ref('http://localhost:50021');
  const voicevoxSpeakerId = ref<number | null>(null);
  const voicevoxStyleMap = ref<Record<string, number>>({});
  const voicevoxParamsMap = ref<Record<string, VoicevoxParams>>({});

  const webSpeechSettings = ref<Record<string, WebSpeechSetting>>({});

  const voicevoxParamsOf = (speaker: string): VoicevoxParams => voicevoxParamsMap.value[speaker || ''] ?? defaultVoicevoxParams();

  const setVoicevoxParam = (speaker: string, key: keyof VoicevoxParams, value: number) => {
    const k = speaker || '';
    if (!(k in voicevoxParamsMap.value)) voicevoxParamsMap.value[k] = defaultVoicevoxParams();
    voicevoxParamsMap.value[k]![key] = value;
  };

  const setVoicevoxStyle = (speaker: string, styleId: number) => {
    voicevoxStyleMap.value[speaker || ''] = styleId;
  };

  // 旧データで欠けたキーは既定値で補完する。
  const webSpeechSettingOf = (speaker: string): WebSpeechSetting => ({
    ...defaultWebSpeechSetting(),
    ...webSpeechSettings.value[speaker || ''],
  });

  const setWebSpeechSetting = (speaker: string, key: keyof WebSpeechSetting, value: string | number) => {
    const k = speaker || '';
    if (!(k in webSpeechSettings.value)) webSpeechSettings.value[k] = defaultWebSpeechSetting();
    (webSpeechSettings.value[k] as Record<string, unknown>)[key] = value;
  };

  // load中のwatch起動で同じ値が即saveされる（ラウンドトリップ）のを防ぐ。
  const isLoading = ref(false);
  let loadPromise: Promise<void> | null = null;

  // 冪等（複数回呼んでも1度しか実行されない）。
  const load = (): Promise<void> => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      isLoading.value = true;
      try {
        const cfg = await audioSettingsItem.getValue();
        if (!cfg) return;

        if (typeof cfg['bgmVolume'] === 'number') bgmVolume.value = cfg['bgmVolume'];
        if (typeof cfg['bgmMuted'] === 'boolean') bgmMuted.value = cfg['bgmMuted'];
        if (typeof cfg['zipVoiceVolume'] === 'number') zipVoiceVolume.value = cfg['zipVoiceVolume'];
        if (typeof cfg['zipVoiceMuted'] === 'boolean') zipVoiceMuted.value = cfg['zipVoiceMuted'];
        // 旧ttsVoice* をvoicevox / webSpeech両方の既定値として使う（後続の専用キーで上書きされる）。
        if (typeof cfg['ttsVoiceVolume'] === 'number') {
          voicevoxVolume.value = cfg['ttsVoiceVolume'];
          webSpeechVolume.value = cfg['ttsVoiceVolume'];
        }
        if (typeof cfg['ttsVoiceMuted'] === 'boolean') {
          voicevoxMuted.value = cfg['ttsVoiceMuted'];
          webSpeechMuted.value = cfg['ttsVoiceMuted'];
        }
        if (typeof cfg['voicevoxVolume'] === 'number') voicevoxVolume.value = cfg['voicevoxVolume'];
        if (typeof cfg['voicevoxMuted'] === 'boolean') voicevoxMuted.value = cfg['voicevoxMuted'];
        if (typeof cfg['webSpeechVolume'] === 'number') webSpeechVolume.value = cfg['webSpeechVolume'];
        if (typeof cfg['webSpeechMuted'] === 'boolean') webSpeechMuted.value = cfg['webSpeechMuted'];
        if (typeof cfg['seVolume'] === 'number') seVolume.value = cfg['seVolume'];
        if (typeof cfg['seMuted'] === 'boolean') seMuted.value = cfg['seMuted'];
        if (typeof cfg['ttsEnabled'] === 'boolean') ttsEnabled.value = cfg['ttsEnabled'];
        if (typeof cfg['voicevoxUrl'] === 'string') voicevoxUrl.value = cfg['voicevoxUrl'];
        if (typeof cfg['voicevoxSpeakerId'] === 'number') voicevoxSpeakerId.value = cfg['voicevoxSpeakerId'];
        if (typeof cfg['voicevoxStyleMap'] === 'object') Object.assign(voicevoxStyleMap.value, cfg['voicevoxStyleMap']);
        if (typeof cfg['voicevoxParamsMap'] === 'object') Object.assign(voicevoxParamsMap.value, cfg['voicevoxParamsMap']);
        if (typeof cfg['webSpeechSettings'] === 'object') Object.assign(webSpeechSettings.value, cfg['webSpeechSettings']);
      } finally {
        isLoading.value = false;
      }
    })();
    return loadPromise;
  };

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  onScopeDispose(() => clearTimeout(debounceTimer));
  watch(
    [
      bgmVolume,
      bgmMuted,
      zipVoiceVolume,
      zipVoiceMuted,
      voicevoxVolume,
      voicevoxMuted,
      webSpeechVolume,
      webSpeechMuted,
      seVolume,
      seMuted,
      ttsEnabled,
      voicevoxUrl,
      voicevoxSpeakerId,
      voicevoxStyleMap,
      voicevoxParamsMap,
      webSpeechSettings,
    ],
    () => {
      if (isLoading.value) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void audioSettingsItem.setValue({
          bgmVolume: bgmVolume.value,
          bgmMuted: bgmMuted.value,
          zipVoiceVolume: zipVoiceVolume.value,
          zipVoiceMuted: zipVoiceMuted.value,
          voicevoxVolume: voicevoxVolume.value,
          voicevoxMuted: voicevoxMuted.value,
          webSpeechVolume: webSpeechVolume.value,
          webSpeechMuted: webSpeechMuted.value,
          seVolume: seVolume.value,
          seMuted: seMuted.value,
          ttsEnabled: ttsEnabled.value,
          voicevoxUrl: voicevoxUrl.value,
          voicevoxSpeakerId: voicevoxSpeakerId.value,
          voicevoxStyleMap: { ...voicevoxStyleMap.value },
          voicevoxParamsMap: { ...voicevoxParamsMap.value },
          webSpeechSettings: { ...webSpeechSettings.value },
        });
      }, 1000);
    },
    { deep: true },
  );

  return {
    bgmVolume,
    bgmMuted,
    zipVoiceVolume,
    zipVoiceMuted,
    voicevoxVolume,
    voicevoxMuted,
    webSpeechVolume,
    webSpeechMuted,
    seVolume,
    seMuted,
    ttsEnabled,
    voicevoxUrl,
    voicevoxSpeakerId,
    voicevoxStyleMap,
    voicevoxParamsMap,
    webSpeechSettings,
    load,
    voicevoxParamsOf,
    setVoicevoxParam,
    setVoicevoxStyle,
    webSpeechSettingOf,
    setWebSpeechSetting,
  };
});
