<script setup lang="ts">
import { reactive, type CSSProperties, computed } from 'vue';
import { mdiDockWindow } from '@mdi/js';
import type { StoryElement } from '@/@types';
import { selectNext, selectPrev } from '@/scripts/selectConrol';
import type JSZip from 'jszip';

const toUrl = URL.createObjectURL;
const props = defineProps<{
  jszip: JSZip;
  fileNames: Array<string>;
  volume: number;
}>();

const state = reactive({
  target: '',
  index: 0,
  elements: new Array<StoryElement>(),
  element: {} as StoryElement,
  float: false,
  fontSize: 1,
  style: {
    position: 'fixed',
    marginTop: '64px',
    top: '',
    right: '',
    bottom: '10px',
    left: '10px',
    width: '500px',
    opacity: '1',
    resize: 'horizontal',
  } as CSSProperties,
  dialog: {
    open: false,
  },
});

const setStoryElements = async () => {
  state.elements.splice(0);
  state.elements.push(
    ...JSON.parse((await props.jszip.file(state.target)?.async('string')) ?? '[]'),
  );
};

const storySourceFileNames = computed(() =>
  props.fileNames.filter((x) => x.includes('source.json')),
);

const changeStoryElement = async () => {
  const audio = document.getElementById('story-audio') as HTMLAudioElement;
  if (!audio) return;
  const targetVoice = `${state.target}/${
    state.element.p1_chara_voice_text +
    state.element.p2_chara_voice_text +
    state.element.p3_chara_voice_text +
    state.element.p4_chara_voice_text +
    state.element.p5_chara_voice_text
  }`.replace('source.json', 'voice');
  const t = props.jszip.file(targetVoice);
  if (!t) return;
  audio.src = toUrl(await t.async('blob'));
  audio.play();
};

const showDialog = () => {
  (document.getElementById('story-dialog') as HTMLDialogElement)?.show();
  state.dialog.open = true;
};
const closeDialog = () => {
  (document.getElementById('story-dialog') as HTMLDialogElement)?.close();
  state.dialog.open = false;
};
</script>

<template>
  <v-card
    :style="[state.float ? state.style : undefined]"
    tabindex="-1"
    @keydown.up.prevent="selectPrev('story-element-select')"
    @keydown.left.prevent="selectPrev('story-element-select')"
    @keydown.down.prevent="selectNext('story-element-select')"
    @keydown.right.prevent="selectNext('story-element-select')"
    class="focusable"
  >
    <v-card-title v-show="!state.float" class="d-flex flex-row">
      <span>◆ストーリー</span>
      <v-spacer></v-spacer>
      <v-btn @click="showDialog" v-show="!state.dialog.open">
        <v-icon :icon="mdiDockWindow" />
      </v-btn>
    </v-card-title>
    <dialog id="story-dialog" draggable="true" style="margin: auto; padding: 1em">
      <menu>
        <v-btn @click="closeDialog">とじる</v-btn>
      </menu>
    </dialog>
    <v-card-text style="line-height: initial">
      <select v-model="state.target" @change="setStoryElements" class="mx-1">
        <option v-for="title in storySourceFileNames" :value="title" :key="title">
          {{ title }}
        </option>
      </select>
      <select
        v-model="state.element"
        @change="changeStoryElement"
        class="mx-1"
        id="story-element-select"
      >
        <option v-for="element in state.elements" :value="element" :key="element.text">
          {{ element.text }}
        </option>
      </select>

      <div :style="{ fontSize: `${state.fontSize}em` }">
        <p class="my-2" style="min-height: 1rem">
          <span v-show="state.element.speaker">【{{ state.element.speaker }}】</span>
        </p>
        <p class="my-2" style="min-height: 3rem">
          {{ state.element.text }}
        </p>
        <p v-show="state.element.choice1">＞{{ state.element.choice1 }}</p>
        <p v-show="state.element.choice2">＞{{ state.element.choice2 }}</p>
        <p v-show="state.element.choice3">＞{{ state.element.choice3 }}</p>
      </div>
      <div class="d-flex">
        <audio id="story-audio" class="my-2" :volume="props.volume / 100" controls></audio>
        <div class="d-flex flex-column">
          <label class="mx-2">
            浮かす
            <input v-model="state.float" type="checkbox" />
          </label>
          <label class="mx-2">
            フォントサイズ
            <input
              v-model="state.fontSize"
              type="number"
              step="0.1"
              min="0"
              max="3"
              style="width: 2.5em; background-color: white"
            />
          </label>
          <label class="mx-2">
            透明度
            <input
              v-model="state.style.opacity"
              type="number"
              step="0.1"
              min="0"
              max="1"
              style="width: 2.5em; background-color: white"
            />
          </label>
          <div class="d-flex" v-if="state.float">
            <v-btn
              size="x-small"
              variant="outlined"
              @click="
                state.style.top = '10px';
                state.style.bottom = '';
              "
              color="grey"
              >↑</v-btn
            >
            <v-btn
              size="x-small"
              variant="outlined"
              @click="
                state.style.left = '';
                state.style.right = '10px';
              "
              color="grey"
              >→</v-btn
            >
            <v-btn
              size="x-small"
              variant="outlined"
              @click="
                state.style.top = '';
                state.style.bottom = '10px';
              "
              color="grey"
              >↓</v-btn
            >
            <v-btn
              size="x-small"
              variant="outlined"
              @click="
                state.style.left = '10px';
                state.style.right = '';
              "
              color="grey"
              >←</v-btn
            >
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
