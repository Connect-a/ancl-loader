<script setup lang="ts">
import { reactive, type CSSProperties, computed, watch, onMounted } from 'vue';
import {
  mdiDockWindow,
  mdiWindowClose,
  mdiDrag,
  mdiFormatSize,
  mdiOpacity,
  mdiThemeLightDark,
  mdiContentSave,
} from '@mdi/js';
import type { StoryElement } from '@/@types';
import { selectNext, selectPrev } from '@/scripts/selectConrol';
import { type IUnzipper } from '@/scripts/zip';

type CardTheme = 'dark' | 'light';
type CardStyle = {
  fonSize: number;
  theme: CardTheme;
  width: string;
  opacity: number;
};

const toUrl = URL.createObjectURL;
const props = defineProps<{
  zip: IUnzipper;
  fileNames: Array<string>;
  volume: number;
}>();

const state = reactive({
  target: '',
  index: 0,
  elements: new Array<StoryElement>(),
  element: {} as StoryElement,
  fontSize: 1,
  theme: 'dark' as CardTheme,
  float: false,
  dragPositionOffset: { x: 0, y: 0 },
  style: {
    position: 'initial',
    opacity: '1',
    resize: 'horizontal',
    top: '64px',
    left: 0,
    zIndex: 0,
    width: 'initial',
    height: 'initial',
  } as CSSProperties,
});

const storySourceFileNames = computed(
  () => props.fileNames?.filter((x) => x.includes('source.json')) ?? [],
);

// NOTE: ファイル名配列が空になった時にクリア
watch(props.fileNames, async (v, _old) => {
  if (v?.length) return;
  state.target = '';
  state.element = {} as StoryElement;
});

onMounted(() => {
  setResizeObserver();
  loadStyle();
});

const getCard = () => document.getElementById('story-card');

const saveStyle = () => {
  localStorage.setItem(
    'playerCardStyle',
    JSON.stringify({
      fonSize: state.fontSize,
      theme: state.theme,
      width: state.style.width,
      opacity: state.style.opacity,
    } as CardStyle),
  );
};

const loadStyle = () => {
  const style = JSON.parse(
    localStorage.getItem('playerCardStyle') ??
      JSON.stringify({
        fonSize: 1,
        theme: 'dark',
        width: 'initial',
        opacity: 1,
      } as CardStyle),
  ) as CardStyle;
  state.fontSize = style.fonSize;
  state.theme = style.theme;
  state.style.width = style.width;
  state.style.opacity = style.opacity;
};

const setStoryElements = async () => {
  state.elements.splice(0);
  state.elements.push(...JSON.parse((await props.zip.readFileAsTextAsync(state.target)) ?? '[]'));
};

const changeStoryElement = async () => {
  const audio = document.getElementById('story-audio') as HTMLAudioElement;
  if (!audio) return;
  const text = `${
    state.element.p1_chara_voice_text +
    state.element.p2_chara_voice_text +
    state.element.p3_chara_voice_text +
    state.element.p4_chara_voice_text +
    state.element.p5_chara_voice_text
  }`;
  if (!text) return;
  const targetVoice = `${state.target}/${text}`.replace('source.json', 'voice');
  const t = await props.zip.readFileAsBlobAsync(targetVoice);
  if (!t) return;
  audio.src = toUrl(t);
  audio.play();
};

const cardControll = {
  floatCard: () => {
    state.float = true;
    state.style.position = 'fixed';
    state.style.zIndex = 1000;
    const card = getCard();
    const rect = card?.getBoundingClientRect();
    state.style.left = `${rect?.x}px`;
    state.style.top = `${rect?.y}px`;
  },
  fixCard: () => {
    state.float = false;
    state.style.position = 'initial';
    state.style.zIndex = 0;
  },
  startCardMove: (e: DragEvent) => {
    const card = getCard();
    const rect = card?.getBoundingClientRect();
    state.dragPositionOffset = { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.y ?? 0) };
    state.style.left = `${e.clientX - state.dragPositionOffset.x}px`;
    state.style.top = `${e.clientY - state.dragPositionOffset.y}px`;
  },
  moveCard: (e: DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    state.style.left = `${e.clientX - state.dragPositionOffset.x}px`;
    state.style.top = `${e.clientY - state.dragPositionOffset.y}px`;
  },
  toggleTheme: () => {
    switch (state.theme) {
      case 'dark':
        state.theme = 'light';
        return;
      case 'light':
      default:
        state.theme = 'dark';
        return;
    }
  },
};

// カードリサイズ
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.target instanceof HTMLElement) {
      state.style.width = entry.target.style.width;
      state.style.height = entry.target.style.height;
    }
  }
});
const setResizeObserver = () => {
  const card = getCard();
  if (card) resizeObserver.observe(card);
};
</script>

<template>
  <div v-show="state.float" style="min-height: 400px"></div>
  <v-card
    id="story-card"
    v-show="storySourceFileNames.some((x) => x)"
    tabindex="-1"
    @keydown.up.prevent="selectPrev('story-element-select')"
    @keydown.left.prevent="selectPrev('story-element-select')"
    @keydown.down.prevent="selectNext('story-element-select')"
    @keydown.right.prevent="selectNext('story-element-select')"
    :style="state.style"
    :theme="state.theme"
    class="focusable"
  >
    <v-card-title class="d-flex flex-row">
      <v-icon
        v-show="state.float"
        :icon="mdiDrag"
        draggable="true"
        @dragstart="cardControll.startCardMove"
        @drag="cardControll.moveCard"
        class="cursor-move"
        title="ドラッグで動かす"
      />
      <span v-show="!state.float">◆ストーリー</span>
      <v-spacer></v-spacer>
      <v-btn :icon="mdiContentSave" @click="saveStyle" density="compact" title="スタイルの保存" />
      <v-btn :icon="mdiThemeLightDark" @click="cardControll.toggleTheme" density="compact" />
      <v-btn
        :icon="mdiDockWindow"
        @click="cardControll.floatCard"
        v-show="!state.float"
        density="compact"
        title="浮かす"
      />
      <v-btn
        :icon="mdiWindowClose"
        @click="cardControll.fixCard"
        v-show="state.float"
        density="compact"
      />
    </v-card-title>
    <v-card-text style="line-height: initial">
      <div v-show="state.target" :style="{ fontSize: `${state.fontSize}em` }">
        <p class="my-2">
          <span style="line-height: 1em">{{
            state.element.speaker ? `【${state.element.speaker}】` : '-'
          }}</span>
        </p>
        <p class="my-2" style="min-height: 3rem">
          {{ state.element.text }}
        </p>
        <p v-show="state.element.choice1">＞{{ state.element.choice1 }}</p>
        <p v-show="state.element.choice2">＞{{ state.element.choice2 }}</p>
        <p v-show="state.element.choice3">＞{{ state.element.choice3 }}</p>
      </div>
      <select v-model="state.target" @change="setStoryElements" class="mx-1">
        <option v-for="title in storySourceFileNames ?? []" :value="title" :key="title">
          {{ title }}
        </option>
      </select>
      <select
        v-show="state.target"
        v-model="state.element"
        @change="changeStoryElement"
        class="mx-1"
        id="story-element-select"
      >
        <option v-for="element in state.elements ?? []" :value="element" :key="element.text">
          {{ element.text }}
        </option>
      </select>
      <details>
        <summary>CTRL</summary>
        <audio id="story-audio" :volume="props.volume / 100" controls></audio>
        <v-slider
          v-model="state.fontSize"
          :prepend-icon="mdiFormatSize"
          density="compact"
          min="0.05"
          max="3"
          step="0.01"
          hide-details
        />
        <v-slider
          v-model="state.style.opacity"
          :prepend-icon="mdiOpacity"
          density="compact"
          min="0.05"
          max="1"
          step="0.01"
          hide-details
        />
      </details>
    </v-card-text>
  </v-card>
</template>

<style scoped></style>
