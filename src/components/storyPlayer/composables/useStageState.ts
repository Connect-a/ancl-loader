import { ref, computed } from 'vue';
import type { Asset } from '@/scripts/resolver/asset';
import { SLOT_COUNT, defaultSlot, defaultEmoticon, type CharaSlot, type EmoticonInfo, type FrameResources } from '../types';
import { computeZoom, DEFAULT_ZOOM } from '../utils/layout';
import type { FrameState } from '../utils/frameState';

export function useStageState() {
  const activeBgUrl = ref<string | null>(null);
  const activeBg = ref<Asset | null>(null);
  const isSceneBg = computed(() => {
    const k = activeBg.value?.kind;
    return k === 'SceneImg' || k === 'StoryImage';
  });
  const charaSlots = ref<Array<CharaSlot>>(Array.from({ length: SLOT_COUNT }, defaultSlot));
  const emoticonSlots = ref<Array<EmoticonInfo>>(Array.from({ length: SLOT_COUNT }, defaultEmoticon));
  const activeMovieUrl = ref<string | null>(null);
  const hasMovie = computed(() => activeMovieUrl.value !== null);
  const stageZoom = ref(DEFAULT_ZOOM);

  const apply = (state: FrameState, resources: FrameResources) => {
    activeBg.value = state.bg;
    activeBgUrl.value = resources.bgUrl;
    activeMovieUrl.value = resources.movieUrl;
    charaSlots.value = resources.charaSlots;
    emoticonSlots.value = resources.emoticonSlots;
    stageZoom.value = computeZoom(state.zoom, state.zoomPos);
  };

  const reset = () => {
    activeBgUrl.value = null;
    activeBg.value = null;
    charaSlots.value = Array.from({ length: SLOT_COUNT }, defaultSlot);
    emoticonSlots.value = Array.from({ length: SLOT_COUNT }, defaultEmoticon);
    activeMovieUrl.value = null;
    stageZoom.value = DEFAULT_ZOOM;
  };

  return { activeBgUrl, isSceneBg, charaSlots, emoticonSlots, activeMovieUrl, hasMovie, stageZoom, apply, reset };
}

export type StageApi = ReturnType<typeof useStageState>;
