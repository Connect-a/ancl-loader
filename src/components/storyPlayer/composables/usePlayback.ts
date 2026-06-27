import { ref, computed, onScopeDispose, type Ref, type ToRefs } from 'vue';
import { delayAbortable } from '@/scripts/abortable';
import type { Resolver } from '@/scripts/resolver/resolver';
import { assets, type Asset } from '@/scripts/resolver/asset';
import { defaultSlot, type NormalizedStoryElement, type CharaSlot, type FrameResources } from '../types';
import { getFrameState, type FrameState } from '../utils/frameState';
import { isNoSe, isNoEmoticon, isNoChoice } from '../utils/storySource';
import type { LoadedStory } from '../utils/loadStory';
import type { StageApi } from './useStageState';
import type { FrameAudioApi } from './useFrameAudio';

type PlaybackValues = {
  currentIndex: number;
  autoPlay: boolean;
  hasMovie: boolean;
  movieUrls: ReadonlyArray<string>;
  current: NormalizedStoryElement | undefined;
  hasPrev: boolean;
  hasNext: boolean;
  choices: Array<{ label: string; flag: string }>;
  hasUsedOnlineResource: boolean;
  onlineResourceUrls: ReadonlyArray<string>;
};

type PlaybackMethods = {
  navigateTo(index: number): void;
  selectChoice(flag: string): void;
  goNext(): void;
  goPrev(): void;
  replayCurrent(): void;
  toggleAutoPlay(): void;
  pauseAutoPlay(): void;
  resumeAutoPlay(): void;
  resolveAsset(asset: Asset): Promise<string | null>;
  leaveEpisode(): void;
  enterEpisode(): void;
};

export type PlaybackApi = ToRefs<PlaybackValues> & PlaybackMethods;

type PlaybackDeps = {
  story: Ref<LoadedStory | null>;
  resolver: Resolver;
  frameAudio: Pick<FrameAudioApi, 'playFrame' | 'isVoicePlaying' | 'cancelVoice' | 'stopBgm'>;
  stage: StageApi;
  savePlayerConfig: () => void;
  onReachEnd?: () => void;
};

const AUTO_PLAY_DELAY = 500;

/** emotion + SD/立ち絵区分からファイル名を構築。SD=sd_NN.png / 立ち絵=_merged_st_NN.png（emotion-1を0-6にクランプ） */
const charaImageFile = (emotion: string, isSd: boolean): string => {
  const num = parseInt(emotion) || 1;
  return isSd ? `sd_${String(num).padStart(2, '0')}.png` : `_merged_st_${String(Math.max(0, Math.min(6, num - 1))).padStart(2, '0')}.png`;
};

async function buildFrameResources(args: {
  state: FrameState;
  el: NormalizedStoryElement;
  eventId: string;
  resolveAsset: (asset: Asset) => Promise<string | null>;
}): Promise<FrameResources> {
  const { state, el, eventId, resolveAsset } = args;
  const seIds = [el.bg_sound_start, ...el.slots.map((s) => s.soundStart)];

  const [bgUrl, movieUrl, charaSlots, bgmUrl, seUrls, emoticonSlots] = await Promise.all([
    state.bg ? resolveAsset(state.bg) : Promise.resolve(null),
    el.movie_text ? resolveAsset(assets.storyMovie(eventId, el.movie_text)) : Promise.resolve(null),
    Promise.all(
      state.slotSpecs.map(async (spec): Promise<CharaSlot> => {
        if (!spec.visible || !spec.charaId) return defaultSlot();
        const url = await resolveAsset(assets.charaImage(spec.charaId, charaImageFile(spec.emotion, spec.isSd)));
        return { url, isSd: spec.isSd, size: spec.size, direction: spec.direction, pos: spec.pos, posX: spec.posX, posY: spec.posY, visible: true };
      }),
    ),
    state.bgmId ? resolveAsset(assets.bgm(`${state.bgmId}.m4a`)) : Promise.resolve(null),
    Promise.all(seIds.map((id) => (isNoSe(id) ? Promise.resolve(null) : resolveAsset(assets.se(`${id}.m4a`))))),
    Promise.all(
      el.slots.map(async (s) => ({
        url: isNoEmoticon(s.charaEmoticonId) ? null : await resolveAsset(assets.emo(`${s.charaEmoticonId}.png`)),
        posX: parseFloat(s.charaEmoticonPosX) || 0,
        posY: parseFloat(s.charaEmoticonPosY) || 0,
      })),
    ),
  ]);

  return { bgUrl, movieUrl, charaSlots, bgmUrl, seUrls, emoticonSlots };
}

export function usePlayback(deps: PlaybackDeps): PlaybackApi {
  const { resolver, story, frameAudio, stage } = deps;

  const currentIndex = ref(0);
  const autoPlay = ref(false);

  let frameController = new AbortController();
  let autoPlayTimerId: ReturnType<typeof setTimeout> | undefined;

  const clearAutoPlayTimer = () => {
    clearTimeout(autoPlayTimerId);
    autoPlayTimerId = undefined;
  };

  const elements = computed(() => story.value?.elements ?? []);
  const movieUrls = computed<ReadonlyArray<string>>(() => story.value?.movieUrls ?? []);
  const getFrames = (): ReadonlyArray<FrameState> => story.value?.frames ?? [];
  const getEventId = (): string => story.value?.eventId ?? '';

  const current = computed(() => elements.value[currentIndex.value]);

  // choice_flgが '0'/'' か選んだ番号と一致するフレームだけ再生対象。バックログは非対応
  const selectedChoice = ref('');
  const isActiveIdx = (i: number): boolean => {
    const flg = elements.value[i]?.choice_flg ?? '0';
    return isNoChoice(flg) || flg === selectedChoice.value;
  };
  const nextActiveIdx = (from: number): number => {
    for (let i = from + 1; i < elements.value.length; i++) if (isActiveIdx(i)) return i;
    return -1;
  };
  const prevActiveIdx = (from: number): number => {
    for (let i = from - 1; i >= 0; i--) if (isActiveIdx(i)) return i;
    return -1;
  };

  const hasPrev = computed(() => prevActiveIdx(currentIndex.value) !== -1);
  const hasNext = computed(() => nextActiveIdx(currentIndex.value) !== -1);
  const choices = computed(() =>
    [current.value?.choice1, current.value?.choice2, current.value?.choice3]
      .map((label, i) => ({ label: label ?? '', flag: String(i + 1) }))
      .filter((c) => c.label),
  );

  const onlineUrls = ref<Set<string>>(new Set());
  const hasUsedOnlineResource = computed(() => onlineUrls.value.size > 0);
  const onlineResourceUrls = computed<ReadonlyArray<string>>(() => [...onlineUrls.value].sort());

  /** web解決された（オフラインに無い）URLを記録する */
  const resolveAsset = async (asset: Asset): Promise<string | null> => {
    const url = await resolver.resolve(asset);
    if (url !== null && url.startsWith('http') && !onlineUrls.value.has(url)) onlineUrls.value = new Set(onlineUrls.value).add(url);
    return url;
  };

  /** フレーム用解決。bg/bgm は現ストーリーのローカル上書きを優先し、無ければcanonicalにフォールバックする */
  const resolveFrameAsset = async (asset: Asset): Promise<string | null> => {
    if (asset.kind === 'Bg') {
      const local = await resolveAsset(assets.storyBg(getEventId(), asset.file));
      if (local !== null) return local;
    } else if (asset.kind === 'Bgm') {
      const local = await resolveAsset(assets.storyBgm(getEventId(), asset.file));
      if (local !== null) return local;
    }
    return resolveAsset(asset);
  };

  const cancelPending = () => {
    frameController.abort();
    frameController = new AbortController();
    clearAutoPlayTimer();
    frameAudio.cancelVoice();
  };

  const scheduleAutoNext = (delayMs: number = AUTO_PLAY_DELAY) => {
    clearAutoPlayTimer();
    if (!autoPlay.value || !hasNext.value || choices.value.length) return; // プロンプトでは自動進行しない

    const nextIdx = nextActiveIdx(currentIndex.value);
    if (nextIdx === -1) return;
    // 次フレームのリソースをresolverのURLキャッシュに乗せておく
    const nextEl = elements.value[nextIdx];
    if (nextEl) {
      const nextState = getFrameState(getFrames(), nextIdx);
      void loadFrameResources(nextState, nextEl);
    }

    autoPlayTimerId = setTimeout(() => {
      autoPlayTimerId = undefined;
      if (autoPlay.value) navigateTo(nextIdx);
    }, delayMs);
  };

  const triggerAutoPlayIfReady = () => {
    if (autoPlay.value && !frameAudio.isVoicePlaying()) {
      scheduleAutoNext();
    }
  };

  const loadFrameResources = (state: FrameState, el: NormalizedStoryElement): Promise<FrameResources> =>
    buildFrameResources({ state, el, eventId: getEventId(), resolveAsset: resolveFrameAsset });

  const updateFrame = async () => {
    const { signal } = frameController;
    const idx = currentIndex.value;
    const el = elements.value[idx];
    if (!el) return;

    const state = getFrameState(getFrames(), idx);
    const resources = await loadFrameResources(state, el);
    if (signal.aborted) return;

    stage.apply(state, resources);

    const frameHoldMs = el.text ? Math.max(1500, el.text.length * 150) : 500;
    const holdPromise = delayAbortable(frameHoldMs, signal);
    const framePlayed = frameAudio.playFrame(resources, idx, signal, resolveFrameAsset);

    try {
      await Promise.all([holdPromise, framePlayed]);
      if (signal.aborted) return;
      scheduleAutoNext();
    } catch {
      if (!signal.aborted) scheduleAutoNext();
    }
  };

  const navigateTo = (index: number) => {
    if (index < 0 || index >= elements.value.length) return;
    cancelPending();
    currentIndex.value = index;
    updateFrame();
  };

  const goNext = () => {
    if (choices.value.length) return; // プロンプトでは選択肢クリックで進む（選ばないと分岐を飛ばさない）
    const next = nextActiveIdx(currentIndex.value);
    if (next === -1) return deps.onReachEnd?.();
    navigateTo(next);
  };
  const goPrev = () => {
    const prev = prevActiveIdx(currentIndex.value);
    if (prev !== -1) navigateTo(prev);
  };
  const replayCurrent = () => navigateTo(currentIndex.value);

  const selectChoice = (flag: string) => {
    selectedChoice.value = flag;
    const next = nextActiveIdx(currentIndex.value);
    if (next === -1) return deps.onReachEnd?.();
    navigateTo(next);
  };

  const toggleAutoPlay = () => {
    autoPlay.value = !autoPlay.value;
    deps.savePlayerConfig();
    if (!autoPlay.value) clearAutoPlayTimer();
    else triggerAutoPlayIfReady();
  };

  // activeEventPrefixは離脱時に前エピソードのblobだけ解放するため保持
  let activeEventPrefix = '';
  const leaveEpisode = () => {
    cancelPending();
    frameAudio.stopBgm();
    if (activeEventPrefix) resolver.revokeByPrefix(activeEventPrefix);
    activeEventPrefix = '';
    stage.reset();
    onlineUrls.value = new Set();
    selectedChoice.value = '';
  };
  const enterEpisode = () => {
    const eid = story.value?.eventId ?? '';
    activeEventPrefix = eid ? `event/${eid}/` : '';
    navigateTo(0);
  };

  onScopeDispose(cancelPending);

  return {
    currentIndex,
    autoPlay,
    hasMovie: stage.hasMovie,
    movieUrls,
    current,
    hasPrev,
    hasNext,
    choices,
    hasUsedOnlineResource,
    onlineResourceUrls,
    navigateTo,
    selectChoice,
    goNext,
    goPrev,
    replayCurrent,
    toggleAutoPlay,
    pauseAutoPlay: clearAutoPlayTimer,
    resumeAutoPlay: triggerAutoPlayIfReady,
    resolveAsset,
    leaveEpisode,
    enterEpisode,
  };
}
