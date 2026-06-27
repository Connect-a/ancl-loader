<script setup lang="ts">
import { ref, shallowRef, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { mdiClose } from '@mdi/js';
import type { IUnzipper } from '@/scripts/zip';
import { AssetResolver } from '@/scripts/resolver/resolver';
import type { EntryManifest } from '@/scripts/resolver/entryManifest';
import { useAudioSettingsStore } from '@/store/audioSettingsStore';
import type { Panel } from './types';
import { loadStory, type LoadedStory } from './utils/loadStory';
import { createPlayerConfig } from './utils/playerConfig';
import { useVoice } from './composables/useVoice';
import { useFrameAudio } from './composables/useFrameAudio';
import { useSidePanel } from './composables/useSidePanel';
import { useStageState } from './composables/useStageState';
import { usePlayback } from './composables/usePlayback';
import VolumePanel from './components/VolumePanel.vue';
import VoiceSettingsPanel from './components/VoiceSettingsPanel.vue';
import StoryStage from './components/StoryStage.vue';
import SidePanelView from './components/SidePanelView.vue';
import StoryControlBar from './components/StoryControlBar.vue';
import FrameListDrawer from './components/FrameListDrawer.vue';

const props = defineProps<{
  entryZip: IUnzipper;
  sharedZip: IUnzipper | null;
  charaHandleMap: ReadonlyMap<string, FileSystemFileHandle>;
  manifest: EntryManifest;
  sourcePath: string;
  /** epごとのサムネblob URL（スプラッシュ表示用） */
  thumbnails?: ReadonlyMap<string, string>;
}>();
const emit = defineEmits<{ close: [] }>();

const resolver = AssetResolver.create({
  entryZip: props.entryZip,
  sharedZip: props.sharedZip,
  charaHandleMap: props.charaHandleMap,
  manifest: props.manifest,
});

// prop sourcePathは初期値、以降はopenEpisodeで切替える（再オープンは :keyで再マウント）
const currentSourcePath = ref(props.sourcePath);
const story = shallowRef<LoadedStory | null>(null);
const loading = ref(false);
const awaitingStart = ref(false);
const errorMessage = ref('');

const audioStore = useAudioSettingsStore();
const voice = useVoice(story);
const frameAudio = useFrameAudio(voice);
const { bgmAudio, zipVoiceAudio, voicevoxAudio } = frameAudio;
const stage = useStageState();
const sidePanel = useSidePanel({ resolver, manifest: props.manifest }, () => savePlayerConfig());
const playback = usePlayback({
  story,
  resolver,
  frameAudio,
  stage,
  savePlayerConfig: () => savePlayerConfig(),
  onReachEnd: () => {
    const next = episodeAt(1);
    dialog.value = next ? { kind: 'episode', path: next } : { kind: 'lastFrame' };
  },
});
const { load: loadPlayerConfig, save: savePlayerConfig } = createPlayerConfig({
  autoPlay: playback.autoPlay,
  sidePanel: {
    open: sidePanel.open,
    ratio: sidePanel.ratio,
    tab: sidePanel.tab,
    vertical: sidePanel.vertical,
    originalSize: sidePanel.originalSize,
  },
});

const playbackView = reactive(playback);
const voicevoxView = reactive(voice.voicevox);
const webSpeechView = reactive(voice.webSpeech);

const showOnlineUrls = ref(false);
const showFrameList = ref(false);
const activePanel = ref<Panel | null>(null);
const showVideoControls = ref(false);

const playableEpisodes = props.manifest.episodes.filter((e) => e.playable);
const episodeItems = playableEpisodes.map((e) => ({ title: e.folderName, value: e.sourcePath }));
// イベント時評価なのでcomputedにしない（端はundefined）
const episodeAt = (offset: number) => {
  const i = playableEpisodes.findIndex((e) => e.sourcePath === currentSourcePath.value);
  return i >= 0 ? playableEpisodes[i + offset]?.sourcePath : undefined;
};
const currentEpisode = computed(() => playableEpisodes.find((e) => e.sourcePath === currentSourcePath.value));
const currentThumbnail = computed(() => (currentEpisode.value ? props.thumbnails?.get(currentEpisode.value.folderName) : undefined));

type PlayerDialog = { kind: 'episode'; path: string } | { kind: 'lastFrame' } | null;
const dialog = ref<PlayerDialog>(null);
// VDialogのafterEnterは内部フォーカス(contentEl)より先に発火するので、@after-enterでこのボタンへ移してEnterを効かせる
const dialogBtn = ref<{ $el?: HTMLElement } | null>(null);
const dialogOpen = computed({
  get: () => dialog.value !== null,
  set: (v) => {
    if (!v) dialog.value = null;
  },
});
const dialogEpisodeTitle = computed(() => {
  const d = dialog.value;
  if (d?.kind !== 'episode') return '';
  return episodeItems.find((e) => e.value === d.path)?.title ?? '';
});
const promptEpisode = (path: string | undefined) => {
  if (path) dialog.value = { kind: 'episode', path };
};
const confirmEpisode = () => {
  const d = dialog.value;
  dialog.value = null;
  if (d?.kind === 'episode') void openEpisode(d.path);
};

const showPrefetchWarning = computed(() => !voice.voicevox.synthesizing.value && voice.voicevox.prefetchPaused.value);
const onToggleTts = () => voice.toggleTts(playback.currentIndex.value);
const onConnect = () => void voice.connectAndPrefetch(playback.currentIndex.value);
const onDisconnect = () => voice.voicevox.disconnect();

const openPanel = (panel: Panel) => {
  activePanel.value = panel;
  playback.pauseAutoPlay();
};
const closeActivePanel = () => {
  // voiceパネルで話者変更→キャッシュ無効化されるので、閉じる時にprefetch再開
  if (activePanel.value === 'voice') voice.startPrefetch(playback.currentIndex.value);
  activePanel.value = null;
  playback.resumeAutoPlay();
};
const togglePanel = (panel: Panel) => (activePanel.value === panel ? closeActivePanel() : openPanel(panel));
const openOnlineUrls = () => {
  if (playback.hasUsedOnlineResource.value) showOnlineUrls.value = true;
};
const jumpToFrame = (index: number) => {
  playback.navigateTo(index);
  showFrameList.value = false;
};

// 連続呼び出しはcurrentSourcePathでrace-checkし後発優先
const openEpisode = async (path: string) => {
  currentSourcePath.value = path;
  playback.leaveEpisode();
  voice.invalidatePrefetch();
  story.value = null;
  awaitingStart.value = false;
  errorMessage.value = '';
  loading.value = true;
  try {
    const episode = props.manifest.episodes.find((e) => e.sourcePath === path);
    if (!episode) {
      errorMessage.value = 'ストーリーが見つかりません';
      return;
    }
    const loaded = await loadStory(resolver, episode);
    if (currentSourcePath.value !== path) return;
    if (loaded) {
      story.value = loaded;
      awaitingStart.value = true;
    } else {
      errorMessage.value = 'ストーリーデータが空です';
    }
  } catch (e) {
    if (currentSourcePath.value !== path) return;
    errorMessage.value = `読み込みエラー: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    if (currentSourcePath.value === path) loading.value = false;
  }
};
const startPlayback = () => {
  if (!awaitingStart.value) return;
  awaitingStart.value = false;
  playback.enterEpisode();
};
// 未開始なら開始、再生中なら次フレーム
const advance = () => (awaitingStart.value ? startPlayback() : playback.goNext());

// 再生UIにフォーカスが無くても操作可能にする（入力中・フォーカス中ボタンの既定動作は譲る）
const onKeydown = (e: KeyboardEvent) => {
  if (dialog.value) return; // ダイアログ表示中はv-dialog側（Esc/外側クリック）に任せる
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return; // 入力中は譲る
  if (e.key === 'Escape') {
    if (!awaitingStart.value && activePanel.value) closeActivePanel();
    else emit('close');
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    promptEpisode(episodeAt(e.key === 'ArrowDown' ? 1 : -1)); // ↑↓で話移動（スプラッシュ/再生中共通）
  } else if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
    if (e.key === ' ' && el?.closest('button')) return; // フォーカス中ボタンのSpaceは奪わない
    e.preventDefault();
    advance();
  } else if (e.key === 'ArrowLeft' && !awaitingStart.value) {
    e.preventDefault();
    playback.goPrev();
  }
};

// 初期エピソードをキック（setup同期部でloading=true。onMountedだと初回が空表示になる）
void openEpisode(props.sourcePath);
window.addEventListener('keydown', onKeydown);
onBeforeUnmount(() => {
  resolver.revokeAll();
  window.removeEventListener('keydown', onKeydown);
});
onMounted(async () => {
  await Promise.all([audioStore.load(), loadPlayerConfig()]);
  if (voice.voicevox.url.value && voice.ttsEnabled.value) await voice.connectAndPrefetch(0);
});
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <v-dialog v-model="showOnlineUrls" max-width="760" scrollable>
      <v-card>
        <v-card-title>オンライン解決リソース（{{ playbackView.onlineResourceUrls.length }}）</v-card-title>
        <v-card-text style="max-height: 60vh">
          <ol class="text-body-2 pl-4">
            <li v-for="url in playbackView.onlineResourceUrls" :key="url" class="mb-1" style="word-break: break-all">
              <a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
            </li>
          </ol>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="showOnlineUrls = false">閉じる</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <div class="story-main d-flex flex-grow-1" :class="{ vertical: sidePanel.vertical.value }">
      <div class="d-flex flex-column flex-grow-1 bg-black" :class="{ 'pointer-events-none': sidePanel.dragging.value }">
        <div class="d-flex align-center px-1 py-1 ga-1 flex-shrink-0">
          <template v-if="!loading && !awaitingStart && !errorMessage">
            <v-chip
              v-if="playbackView.hasUsedOnlineResource"
              size="x-small"
              label
              variant="flat"
              color="deep-orange-darken-3"
              class="cursor-pointer"
              @click="openOnlineUrls"
            >
              オンライン再生 ({{ playbackView.onlineResourceUrls.length }})
            </v-chip>
            <v-chip v-if="!playbackView.hasUsedOnlineResource" size="x-small" label variant="flat" color="green-darken-3"> オフライン再生 </v-chip>
          </template>
          <v-spacer />
          <v-btn size="small" variant="flat" color="grey-darken-3" @click="sidePanel.toggle" title="画像パネル"> IMG </v-btn>
          <v-btn size="small" variant="flat" color="grey-darken-3" @click="$emit('close')" title="終了 (Esc)"> ESC </v-btn>
        </div>
        <div class="flex-grow-1 d-flex align-center justify-center position-relative">
          <div
            v-if="loading || awaitingStart"
            class="d-flex flex-column align-center justify-center ga-3"
            :class="{ 'cursor-pointer': awaitingStart }"
            style="position: absolute; inset: 0"
            @click="advance"
          >
            <div v-if="currentThumbnail || loading" class="splash-thumb">
              <v-img v-if="currentThumbnail" :src="currentThumbnail" cover class="bg-black w-100 h-100" />
              <div v-if="loading" class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate size="64" />
              </div>
            </div>
            <div v-if="awaitingStart && currentEpisode?.folderName" class="text-center">
              <div class="text-white font-weight-bold" style="font-size: 1.75rem; line-height: 1.2">
                {{ currentEpisode.folderName }}
              </div>
            </div>
          </div>
          <v-alert v-if="errorMessage" type="error" class="ma-4">{{ errorMessage }}</v-alert>
          <StoryStage
            v-if="!awaitingStart && playbackView.current"
            :stage="stage"
            :movie-urls="playbackView.movieUrls"
            :video-controls="showVideoControls"
            @click="advance"
          />
          <div
            v-if="!awaitingStart && playbackView.choices.length"
            class="position-absolute d-flex flex-column align-center justify-center ga-3"
            style="inset: 0; z-index: 5; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(2px)"
          >
            <v-btn
              v-for="c in playbackView.choices"
              :key="c.flag"
              color="primary"
              size="large"
              variant="elevated"
              min-width="260"
              @click="playbackView.selectChoice(c.flag)"
            >
              {{ c.label }}
            </v-btn>
          </div>
        </div>
      </div>
      <div
        v-if="sidePanel.open.value"
        class="resize-handle d-flex align-center justify-center flex-shrink-0"
        :class="{ vertical: sidePanel.vertical.value }"
        @pointerdown="sidePanel.startResize"
      />
      <SidePanelView v-if="sidePanel.open.value" :side-panel="sidePanel" />
    </div>

    <template v-if="playbackView.current && !awaitingStart">
      <VolumePanel v-if="activePanel === 'volume'" @close="closeActivePanel" />
      <VoiceSettingsPanel
        v-if="activePanel === 'voice'"
        :voicevox="voicevoxView"
        :tts-speakers="voice.ttsSpeakers.value"
        :web-speech="webSpeechView"
        @close="closeActivePanel"
        @toggle-tts="onToggleTts"
        @connect="onConnect"
        @disconnect="onDisconnect"
      />

      <!-- audio要素は再生継続のため常時マウント。v-showでパネル表示だけ切替 -->
      <v-sheet v-show="activePanel === 'audioControls'" color="grey-darken-3" class="border-t-thin border-b-thin border-opacity-10" @click.stop>
        <div class="px-3 py-2">
          <div class="d-flex align-center mb-1">
            <span class="text-caption text-medium-emphasis">音声コントロール</span>
            <v-spacer />
            <v-btn :icon="mdiClose" size="x-small" variant="text" title="閉じる" @click="closeActivePanel" />
          </div>
          <v-row no-gutters align="center" class="mb-1">
            <v-col cols="1" class="text-caption">BGM</v-col>
            <v-col><audio ref="bgmAudio" loop controls class="w-100" /></v-col>
          </v-row>
          <v-row no-gutters align="center" class="mb-1">
            <v-col cols="1" class="text-caption">ボイス</v-col>
            <v-col><audio ref="zipVoiceAudio" controls class="w-100" /></v-col>
          </v-row>
          <v-row no-gutters align="center">
            <v-col cols="1" class="text-caption">VOICEVOX</v-col>
            <v-col><audio ref="voicevoxAudio" controls class="w-100" /></v-col>
          </v-row>
        </div>
      </v-sheet>

      <StoryControlBar
        :playback="playback"
        :voice="voice"
        :elements="story?.elements ?? []"
        :reserved-lines="story?.reservedLines ?? 2"
        :show-prefetch-warning="showPrefetchWarning"
        :active-panel="activePanel"
        :video-controls="showVideoControls"
        :episode-items="episodeItems"
        :source-path="currentSourcePath"
        :backlog-open="showFrameList"
        @close="$emit('close')"
        @change-episode="openEpisode"
        @toggle-panel="togglePanel"
        @toggle-frame-list="showFrameList = !showFrameList"
        @toggle-video-controls="showVideoControls = !showVideoControls"
      />

      <FrameListDrawer
        v-model:open="showFrameList"
        :elements="story?.elements ?? []"
        :current-index="playbackView.currentIndex"
        :resolve-asset="playbackView.resolveAsset"
        @jump="jumpToFrame"
      />
    </template>

    <v-dialog v-model="dialogOpen" max-width="360" @after-enter="dialogBtn?.$el?.focus()">
      <v-card>
        <v-card-text v-if="dialog?.kind === 'episode'" class="text-body-1">「{{ dialogEpisodeTitle }}」を読みますか？</v-card-text>
        <v-card-text v-if="dialog?.kind === 'lastFrame'" class="text-body-1">最後のフレームです。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn v-if="dialog?.kind === 'episode'" variant="text" @click="dialogOpen = false">キャンセル</v-btn>
          <v-btn v-if="dialog?.kind === 'episode'" ref="dialogBtn" color="primary" variant="flat" @click="confirmEpisode">読む</v-btn>
          <v-btn v-if="dialog?.kind === 'lastFrame'" ref="dialogBtn" color="primary" variant="flat" @click="dialogOpen = false">閉じる</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* overflow!=visibleでflexのauto min-sizeが0になり、中身（原寸画像等）に合わせて伸びずroot内に収まる */
.story-main {
  overflow: hidden;
  &.vertical {
    flex-direction: column-reverse;
  }
}

/* 16:9のスプラッシュサムネ枠。親の幅・高さに収まる範囲で最大624px幅まで拡大する */
.splash-thumb {
  width: 624px;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 16 / 9;
  position: relative;
}

.resize-handle {
  width: 10px;
  cursor: col-resize;
  background: #5d5d5d;
  transition: background 0.15s ease;
  &:hover {
    background: #7d7d7d;
  }
  &::before {
    content: '';
    width: 3px;
    height: 40px;
    background: #fff;
    border-radius: 1.5px;
  }
  &.vertical {
    width: auto;
    height: 10px;
    cursor: row-resize;
    &::before {
      width: 40px;
      height: 3px;
    }
  }
}
</style>
