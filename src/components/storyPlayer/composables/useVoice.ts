import { ref, computed, onScopeDispose, type Ref, type ToRefs } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioSettingsStore, VOLUME_MASTER, type WebSpeechSetting } from '@/store/audioSettingsStore';
import { BlobUrlRegistry } from '@/scripts/blobUrlRegistry';
import type { Asset } from '@/scripts/resolver/asset';
import { buildSpeakerEntries } from '../utils/frameVoice';
import type { LoadedStory } from '../utils/loadStory';
import { useVoicevox } from './useVoicevox';

export type VoiceResolution =
  { type: 'url'; url: string; source: 'zip' | 'voicevox' } | { type: 'webSpeech'; text: string; speaker: string } | { type: 'none' };

export type WebSpeechValues = {
  voiceItems: Array<{ title: string; value: string }>;
};

export type WebSpeechMethods = {
  settingOf(speaker: string): WebSpeechSetting;
  setSetting(speaker: string, key: keyof WebSpeechSetting, value: string | number): void;
};

type WebSpeechApi = ToRefs<WebSpeechValues> & WebSpeechMethods;

const HAS_WEB_SPEECH = 'speechSynthesis' in window;
const isWebSpeechSpeaking = () => HAS_WEB_SPEECH && speechSynthesis.speaking;

export function useVoice(story: Ref<LoadedStory | null>) {
  const store = useAudioSettingsStore();
  const { ttsEnabled, webSpeechVolume, webSpeechMuted } = storeToRefs(store);

  const blobUrls = new BlobUrlRegistry();

  const frameVoices = computed(() => story.value?.frameVoices ?? []);
  const speakers = computed(() => story.value?.speakers ?? []);
  const ttsSpeakers = computed(() => buildSpeakerEntries(speakers.value));

  const voicevox = useVoicevox(blobUrls, frameVoices);

  const connectAndPrefetch = async (fromIndex: number) => {
    await voicevox.connect();
    if (voicevox.available.value) voicevox.startPrefetch(fromIndex);
  };

  const toggleTts = (fromIndex: number) => {
    ttsEnabled.value = !ttsEnabled.value;
    if (!ttsEnabled.value) return;
    if (voicevox.available.value) {
      voicevox.startPrefetch(fromIndex);
    } else if (voicevox.url.value && !voicevox.checking.value) {
      void connectAndPrefetch(fromIndex);
    }
  };

  const webSpeechVoices = ref<Array<SpeechSynthesisVoice>>([]);
  const webSpeechVoiceItems = computed(() => webSpeechVoices.value.map((v) => ({ title: v.name, value: v.name })));

  const loadWebSpeechVoices = () => {
    if (!HAS_WEB_SPEECH) return;
    webSpeechVoices.value = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ja'));
  };
  loadWebSpeechVoices();
  if (HAS_WEB_SPEECH) {
    speechSynthesis.addEventListener('voiceschanged', loadWebSpeechVoices);
    onScopeDispose(() => speechSynthesis.removeEventListener('voiceschanged', loadWebSpeechVoices));
  }

  const speakWithWebSpeech = (text: string, speaker: string, onEnd: () => void) => {
    if (!HAS_WEB_SPEECH) {
      onEnd();
      return;
    }
    const setting = store.webSpeechSettingOf(speaker);
    const utter = new SpeechSynthesisUtterance(text);
    const selectedVoice = webSpeechVoices.value.find((v) => v.name === setting.voice);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.rate = setting.rate;
    utter.pitch = setting.pitch;
    utter.volume = webSpeechMuted.value ? 0 : webSpeechVolume.value * VOLUME_MASTER.webSpeech;
    // onerror（音声未インストール・language-unavailable等）でもonEndを呼びautoplay停止を防ぐ
    utter.onend = onEnd;
    utter.onerror = onEnd;
    speechSynthesis.speak(utter);
  };

  const cancelSpeech = () => {
    if (HAS_WEB_SPEECH) speechSynthesis.cancel();
    voicevox.cancelSynthesis();
  };

  type VoiceBarSegClass = 'seg-none' | 'seg-zip' | 'seg-pending' | 'seg-loading' | 'seg-cached';

  const voiceBarSegments = computed((): Array<VoiceBarSegClass> => {
    // 非リアクティブMap (prefetchCache) の変更を依存追跡するためのトリガー
    void voicevox.prefetchVersion.value;
    const loadingFrame = voicevox.prefetchingFrame.value;
    return frameVoices.value.map((v, i): VoiceBarSegClass => {
      if (v.eventVoice) return 'seg-zip';
      if (!v.text) return 'seg-none';
      if (voicevox.hasPrefetched(i)) return 'seg-cached';
      if (i === loadingFrame) return 'seg-loading';
      return 'seg-pending';
    });
  });

  const voiceBarTooltip = computed(() => {
    const segs = voiceBarSegments.value;
    let noVoice = 0,
      cached = 0,
      loading = 0,
      pending = 0;
    for (const s of segs) {
      if (s === 'seg-none' || s === 'seg-zip') noVoice++;
      else if (s === 'seg-cached') cached++;
      else if (s === 'seg-loading') loading++;
      else pending++;
    }
    return `${segs.length}フレーム: ロード不要 ${noVoice} / ロード済 ${cached} / 読込中 ${loading} / 待機 ${pending}`;
  });

  /** event収録 →（読み上げON）VOICEVOX → Web Speech /（読み上げOFF）キャラ収録(V9xx) → 無音 の優先順で、選ばれた音源だけ解決する */
  const resolveFrameVoice = async (idx: number, resolveAsset: (asset: Asset) => Promise<string | null>): Promise<VoiceResolution> => {
    const voice = frameVoices.value[idx];
    if (!voice) return { type: 'none' };

    const fromRecording = async (asset: Asset | null): Promise<VoiceResolution | null> => {
      const url = asset ? await resolveAsset(asset) : null;
      return url ? { type: 'url', url, source: 'zip' } : null;
    };
    const event = () => fromRecording(voice.eventVoice);
    const charaV9xx = () => fromRecording(voice.charaVoice);
    const voicevoxTts = async (): Promise<VoiceResolution | null> => {
      if (!voice.text || !voicevox.available.value) return null;
      const url = await voicevox.getVoiceForFrame(idx);
      return url ? { type: 'url', url, source: 'voicevox' } : null;
    };
    const webSpeechTts = async (): Promise<VoiceResolution | null> =>
      voice.text ? { type: 'webSpeech', text: voice.text, speaker: voice.speaker } : null;

    const candidates = ttsEnabled.value ? [event, voicevoxTts, webSpeechTts] : [event, charaV9xx];
    for (const candidate of candidates) {
      const resolution = await candidate();
      if (resolution) return resolution;
    }
    return { type: 'none' };
  };

  return {
    ttsEnabled,
    ttsSpeakers,
    voiceBarSegments,
    voiceBarTooltip,
    resolveFrameVoice,
    speakWithWebSpeech,
    isWebSpeechSpeaking,
    cancelSpeech,
    toggleTts,
    connectAndPrefetch,
    invalidatePrefetch: voicevox.invalidatePrefetch,
    startPrefetch: voicevox.startPrefetch,
    voicevox,
    webSpeech: {
      voiceItems: webSpeechVoiceItems,
      settingOf: store.webSpeechSettingOf,
      setSetting: store.setWebSpeechSetting,
    } satisfies WebSpeechApi,
  };
}

export type VoiceApi = ReturnType<typeof useVoice>;
