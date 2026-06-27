import { ref, computed, shallowRef, onScopeDispose, type Ref, type ToRefs } from 'vue';
import { storeToRefs } from 'pinia';
import { useAudioSettingsStore } from '@/store/audioSettingsStore';
import type { BlobUrlRegistry } from '@/scripts/blobUrlRegistry';
import type { FrameVoice } from '../utils/frameVoice';
import { voicevoxSynthesize, voicevoxConnect, type VoicevoxStyle } from '../utils/voicevoxClient';

const MAX_CONSECUTIVE_ERRORS = 3;

export type VoicevoxValues = {
  url: string;
  available: boolean;
  synthesizing: boolean;
  prefetchingFrame: number | null;
  styles: Array<VoicevoxStyle>;
  checking: boolean;
  error: string;
  prefetchVersion: number;
  prefetchPaused: boolean;
};

export type VoicevoxMethods = {
  getVoiceForFrame(idx: number): Promise<string>;
  cancelSynthesis(): void;
  startPrefetch(fromIndex: number): void;
  invalidatePrefetch(): void;
  invalidateSpeakerCache(speaker: string): void;
  hasPrefetched(idx: number): boolean;
  connect(): Promise<void>;
  disconnect(): void;
  getStyleId(speaker: string): number;
};

export type VoicevoxApi = ToRefs<VoicevoxValues> & VoicevoxMethods;

export function useVoicevox(blobUrls: BlobUrlRegistry, frameVoices: Ref<ReadonlyArray<FrameVoice>>): VoicevoxApi {
  const store = useAudioSettingsStore();
  const { ttsEnabled, voicevoxUrl, voicevoxSpeakerId, voicevoxStyleMap } = storeToRefs(store);

  type ConnectionState =
    { kind: 'disconnected' } | { kind: 'checking' } | { kind: 'connected'; styles: Array<VoicevoxStyle> } | { kind: 'error'; message: string };

  const connection = ref<ConnectionState>({ kind: 'disconnected' });

  const available = computed(() => connection.value.kind === 'connected');
  const checking = computed(() => connection.value.kind === 'checking');
  const error = computed(() => (connection.value.kind === 'error' ? connection.value.message : ''));
  const styles = computed(() => (connection.value.kind === 'connected' ? connection.value.styles : []));

  type WorkerState =
    | { kind: 'idle' }
    | { kind: 'realtime'; ctrl: AbortController }
    | { kind: 'prefetching'; frame: number; ctrl: AbortController }
    | { kind: 'paused' };

  const worker = ref<WorkerState>({ kind: 'idle' });

  const synthesizing = computed(() => worker.value.kind === 'realtime');
  const prefetchingFrame = computed(() => (worker.value.kind === 'prefetching' ? worker.value.frame : null));
  const prefetchPaused = computed(() => worker.value.kind === 'paused');

  const getStyleId = (speaker: string): number => voicevoxStyleMap.value[speaker || ''] ?? voicevoxSpeakerId.value ?? styles.value[0]?.value ?? 0;

  const prefetchCache = new Map<number, string>();
  const prefetchVersion = shallowRef(0);

  /** 同一ティック内の複数変更を1回のversion incrementにバッチする */
  let pendingNotify = false;
  const notifyPrefetch = () => {
    if (pendingNotify) return;
    pendingNotify = true;
    void Promise.resolve().then(() => {
      pendingNotify = false;
      prefetchVersion.value++;
    });
  };

  const hasPrefetched = (idx: number): boolean => prefetchCache.has(idx);

  let prefetchConsecutiveErrors = 0;

  const abortWorker = (kind: 'realtime' | 'prefetching') => {
    const w = worker.value;
    if (w.kind === kind && 'ctrl' in w) {
      w.ctrl.abort();
      worker.value = { kind: 'idle' };
    }
  };
  const cancelSynthesis = () => abortWorker('realtime');

  const invalidatePrefetch = () => {
    if (worker.value.kind === 'realtime' || worker.value.kind === 'prefetching') {
      worker.value.ctrl.abort();
    }
    worker.value = { kind: 'idle' };
    prefetchConsecutiveErrors = 0;
    for (const url of prefetchCache.values()) blobUrls.revoke(url);
    prefetchCache.clear();
    notifyPrefetch();
  };

  /** 該当話者を合成中ならabortし古いstyle結果のキャッシュ汚染を防ぐ。別話者中ならワーカー継続（次taskでcache miss → 自然再合成） */
  const invalidateSpeakerCache = (speakerKey: string) => {
    const voices = frameVoices.value;
    const w = worker.value;
    if (w.kind === 'prefetching' && voices[w.frame]?.speaker === speakerKey) {
      abortWorker('prefetching');
    }

    let changed = false;
    for (const [idx, url] of prefetchCache) {
      if (voices[idx]?.speaker === speakerKey) {
        blobUrls.revoke(url);
        prefetchCache.delete(idx);
        changed = true;
      }
    }
    if (changed) notifyPrefetch();
  };

  const synthesizeCore = async (text: string, speakerId: number, speaker: string, signal: AbortSignal): Promise<string> => {
    const params = store.voicevoxParamsOf(speaker);
    const blob = await voicevoxSynthesize(voicevoxUrl.value, text, speakerId, params, signal);
    return blob ? blobUrls.create(blob) : '';
  };

  const synthesizeAndCache = async (idx: number, voice: FrameVoice, signal: AbortSignal): Promise<string> => {
    const url = await synthesizeCore(voice.text, getStyleId(voice.speaker), voice.speaker, signal);
    if (signal.aborted) {
      if (url) blobUrls.revoke(url);
      return '';
    }
    if (url) {
      prefetchCache.set(idx, url);
      notifyPrefetch();
    }
    return url;
  };

  const runPrefetchTask = async (idx: number, signal: AbortSignal): Promise<void> => {
    if (signal.aborted) return;
    const voice = frameVoices.value[idx];
    if (!voice?.text || voice.eventVoice) return;
    if (prefetchCache.has(idx)) return;

    if (worker.value.kind !== 'prefetching') return;
    worker.value = { ...worker.value, frame: idx };

    try {
      const url = await synthesizeAndCache(idx, voice, signal);
      if (url) prefetchConsecutiveErrors = 0;
    } catch {
      if (signal.aborted) return;
      prefetchConsecutiveErrors++;
      if (prefetchConsecutiveErrors >= MAX_CONSECUTIVE_ERRORS && worker.value.kind === 'prefetching') {
        worker.value.ctrl.abort();
        worker.value = { kind: 'paused' };
      }
    }
  };

  const startPrefetch = (fromIndex: number) => {
    if (!available.value || !ttsEnabled.value) return;
    const voices = frameVoices.value;
    if (!voices.length) return;

    if (worker.value.kind === 'prefetching') worker.value.ctrl.abort();

    prefetchConsecutiveErrors = 0;
    const ctrl = new AbortController();
    worker.value = { kind: 'prefetching', frame: fromIndex, ctrl };
    const { signal } = ctrl;

    void (async () => {
      for (let i = fromIndex; i < voices.length; i++) {
        if (signal.aborted) return;
        await runPrefetchTask(i, signal);
      }
      // ctrl identity一致で「自分のchainが最新」と判定
      if (worker.value.kind === 'prefetching' && worker.value.ctrl === ctrl) {
        worker.value = { kind: 'idle' };
      }
    })();
  };

  const getVoiceForFrame = async (idx: number): Promise<string> => {
    const voice = frameVoices.value[idx];
    if (!voice?.text) return '';

    const cached = prefetchCache.get(idx);
    if (cached) return cached;

    if (worker.value.kind === 'realtime' || worker.value.kind === 'prefetching') {
      worker.value.ctrl.abort();
    }

    const ctrl = new AbortController();
    worker.value = { kind: 'realtime', ctrl };
    const { signal } = ctrl;

    try {
      return await synthesizeAndCache(idx, voice, signal);
    } catch {
      return '';
    } finally {
      if (!signal.aborted) {
        if (worker.value.kind === 'realtime' && worker.value.ctrl === ctrl) {
          worker.value = { kind: 'idle' };
        }
        startPrefetch(idx + 1);
      }
    }
  };

  onScopeDispose(() => invalidatePrefetch());

  const connect = async () => {
    if (!voicevoxUrl.value) return;
    // 接続先サーバーでstyleId体系が変わる可能性があるため全キャッシュ破棄
    invalidatePrefetch();
    connection.value = { kind: 'checking' };
    const result = await voicevoxConnect(voicevoxUrl.value);
    if (result.ok) {
      if (voicevoxSpeakerId.value == null && result.styles.length) {
        voicevoxSpeakerId.value = result.styles[0]!.value;
      }
      connection.value = { kind: 'connected', styles: result.styles };
    } else {
      connection.value = { kind: 'error', message: result.error };
    }
  };

  const disconnect = () => {
    invalidatePrefetch();
    connection.value = { kind: 'disconnected' };
  };

  return {
    url: voicevoxUrl,
    available,
    checking,
    error,
    styles,
    synthesizing,
    prefetchingFrame,
    prefetchPaused,
    getStyleId,
    prefetchVersion,
    hasPrefetched,
    cancelSynthesis,
    invalidatePrefetch,
    invalidateSpeakerCache,
    startPrefetch,
    getVoiceForFrame,
    connect,
    disconnect,
  };
}
