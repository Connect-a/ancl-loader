import { ref, watch, onScopeDispose, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioSettingsStore, VOLUME_MASTER } from '@/store/audioSettingsStore';
import type { Asset } from '@/scripts/resolver/asset';
import type { FrameResources } from '../types';
import type { VoiceApi } from './useVoice';

type FrameAudioVoice = Pick<VoiceApi, 'resolveFrameVoice' | 'speakWithWebSpeech' | 'isWebSpeechSpeaking' | 'cancelSpeech'>;

// audioをdepsに入れることで要素マウント時 (null → element) もトリガーされる
function bindAudio(audio: Ref<HTMLAudioElement | null>, volume: Ref<number>, muted: Ref<boolean>, master: number) {
  watch([audio, volume, muted], () => {
    const el = audio.value;
    if (el) {
      el.volume = volume.value * master;
      el.muted = muted.value;
    }
  });
}

export function useFrameAudio(voice: FrameAudioVoice) {
  const store = useAudioSettingsStore();
  const { bgmVolume, bgmMuted, zipVoiceVolume, zipVoiceMuted, voicevoxVolume, voicevoxMuted, seVolume, seMuted } = storeToRefs(store);

  const bgmAudio = ref<HTMLAudioElement | null>(null);
  const zipVoiceAudio = ref<HTMLAudioElement | null>(null);
  const voicevoxAudio = ref<HTMLAudioElement | null>(null);

  // voice要素はミュート中も無音再生 (el.muted)。BGMだけは下でpauseさせる
  bindAudio(zipVoiceAudio, zipVoiceVolume, zipVoiceMuted, VOLUME_MASTER.zipVoice);
  bindAudio(voicevoxAudio, voicevoxVolume, voicevoxMuted, VOLUME_MASTER.voicevox);

  // BGMはurlありかつ非ミュートのときだけ鳴らす
  let currentBgmUrl: string | null = null;
  const syncBgm = () => {
    const el = bgmAudio.value;
    if (!el) return;
    if (currentBgmUrl && !bgmMuted.value) {
      if (el.src !== currentBgmUrl) el.src = currentBgmUrl;
      if (el.paused) el.play().catch(() => {});
    } else {
      el.pause();
    }
  };
  const setBgm = (url: string | null) => {
    if (url === currentBgmUrl) return;
    currentBgmUrl = url;
    syncBgm();
  };
  watch([bgmAudio, bgmVolume, bgmMuted], () => {
    if (bgmAudio.value) bgmAudio.value.volume = bgmVolume.value * VOLUME_MASTER.bgm;
    syncBgm();
  });

  // SEは並行再生のため毎回new Audio。再生終了 (or abort) でresolveしフレーム送りを待たせる
  const playSe = (url: string, signal: AbortSignal): Promise<void> => {
    const el = new Audio(url);
    el.volume = seVolume.value * VOLUME_MASTER.se;
    el.muted = seMuted.value;
    return new Promise<void>((resolve) => {
      el.addEventListener('ended', () => resolve(), { once: true });
      el.addEventListener('error', () => resolve(), { once: true });
      signal.addEventListener(
        'abort',
        () => {
          el.pause();
          resolve();
        },
        { once: true },
      );
      el.play().catch(() => resolve());
    });
  };

  const playVoiceUrl = (url: string, source: 'zip' | 'voicevox', onEnd: () => void) => {
    const el = source === 'zip' ? zipVoiceAudio.value : voicevoxAudio.value;
    if (!el) {
      onEnd();
      return;
    }
    el.src = url;
    // 再生エラー（読込/decode失敗・play拒否）でもonEndを呼びautoplay停止を防ぐ
    el.onended = onEnd;
    el.onerror = onEnd;
    el.play().catch(() => onEnd());
  };
  const stopVoiceElements = () => {
    for (const el of [zipVoiceAudio.value, voicevoxAudio.value]) {
      if (!el) continue;
      el.pause();
      el.onended = null; // 中断後のstaleな再生終了callbackを防ぐ
      el.onerror = null;
    }
  };

  /** auto-playの次フレーム判定用（BGMは除外） */
  const isVoicePlaying = (): boolean =>
    !!(zipVoiceAudio.value && !zipVoiceAudio.value.paused && !zipVoiceAudio.value.ended) ||
    !!(voicevoxAudio.value && !voicevoxAudio.value.paused && !voicevoxAudio.value.ended) ||
    voice.isWebSpeechSpeaking();

  const cancelVoice = () => {
    voice.cancelSpeech();
    stopVoiceElements();
  };

  /** voiceとSEが鳴り終わる（= 次フレームへ進んでよい / またはsignal abort）まで解決しない */
  const playFrame = async (
    resources: FrameResources,
    idx: number,
    signal: AbortSignal,
    resolveAsset: (asset: Asset) => Promise<string | null>,
  ): Promise<void> => {
    setBgm(resources.bgmUrl);
    // SEミュート中は再生も待機もしない
    const sePromises = seMuted.value ? [] : resources.seUrls.map((url) => (url ? playSe(url, signal) : Promise.resolve()));

    const resolution = await voice.resolveFrameVoice(idx, resolveAsset);
    if (signal.aborted) return;

    const voicePromise = new Promise<void>((resolve) => {
      const done = () => resolve();
      signal.addEventListener('abort', done, { once: true });
      switch (resolution.type) {
        case 'url':
          playVoiceUrl(resolution.url, resolution.source, done);
          break;
        case 'webSpeech':
          voice.speakWithWebSpeech(resolution.text, resolution.speaker, done);
          break;
        case 'none':
          done();
          break;
      }
    });

    await Promise.all([voicePromise, ...sePromises]);
  };

  const stopBgm = () => setBgm(null);

  onScopeDispose(() => {
    stopBgm();
    stopVoiceElements();
  });

  return {
    bgmAudio,
    zipVoiceAudio,
    voicevoxAudio,
    playFrame,
    isVoicePlaying,
    cancelVoice,
    stopBgm,
  };
}

export type FrameAudioApi = ReturnType<typeof useFrameAudio>;
