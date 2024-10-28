<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { mdiChevronLeft, mdiChevronRight, mdiPlus } from '@mdi/js';
import { type IUnzipper } from '@/scripts/zip';
import AudioContainer from './AudioContainer.vue';
import { selectNext, selectPrev } from '@/scripts/selectConrol';

type AudioMedia = {
  name: string;
  blob: Blob;
};

const toUrl = URL.createObjectURL;
const messageImageMap = new Map<string, string>([
  ['V001.m4a', 'word.png'],
  ['V305.m4a', 'star1.png'],
  ['V306.m4a', 'star2.png'],
  ['V307.m4a', 'star3.png'],
  ['V308.m4a', 'star4.png'],
]);

const props = defineProps<{
  zip: IUnzipper;
  charaName: string;
  fileNames: Array<string>;
  volume: number;
  audioTextMap: Map<string, string>;
}>();

const state = reactive({
  audio: {
    selected: '',
    stack: new Array<AudioMedia>(),
    playing: false,
  },
  messageImageMap: new Map<string, string>(),
});

watch(
  () => props.charaName,
  async () => {
    for (const [key, value] of messageImageMap) {
      state.messageImageMap.set(
        key,
        toUrl(
          (await props.zip.readFileAsBlobAsync(`${props.charaName}/image/${value}`)) ?? new Blob(),
        ),
      );
    }
  },
);

const audioFileNames = computed(() => props.fileNames.filter((x) => x.includes('m4a')).sort());

const selectAudio = async () => {
  const t = await props.zip.readFileAsBlobAsync(state.audio.selected);
  if (!t) return;
  const e = document.getElementById('audio-sample') as HTMLAudioElement;
  if (!e) return;
  e.src = toUrl(t);
  e.play();
};

const addAudio = async () => {
  const blob = await props.zip.readFileAsBlobAsync(state.audio.selected);
  if (!blob) return;
  state.audio.stack.push({
    name: state.audio.selected,
    blob,
  });
};

const removeAudio = async (name: string) =>
  state.audio.stack.splice(
    state.audio.stack.findIndex((x) => x.name === name),
    1,
  );

const playAudioAsync = (audio: HTMLAudioElement) =>
  new Promise<Event | void>((resolve, reject) => {
    audio.playbackRate = parseFloat(audio.dataset['playbackRate'] ?? '1');
    audio.volume = (props.volume / 100) * parseFloat(audio.dataset['volume'] ?? '1');
    audio.onended = resolve;
    audio.onerror = reject;
    audio.ontimeupdate = (_ev) => {
      const loopRange = audio.dataset['loopRange']?.split(',').map(parseFloat) ?? [
        0,
        audio.duration,
      ];
      const startTime = loopRange[0] ?? 0;
      const endTime = loopRange[1] ?? audio.duration;
      if (audio.currentTime <= startTime) audio.currentTime = startTime;

      if (audio.currentTime >= endTime) {
        if (audio.dataset['loop'] === 'true') {
          audio.currentTime = startTime;
        } else {
          audio.pause();
          audio.currentTime = startTime;
          resolve();
        }
      }
    };
    audio.play();
  });

const playAudioList = async () => {
  state.audio.playing = true;
  const audioList = state.audio.stack.map(
    (x) => document.getElementById(x.name) as HTMLAudioElement,
  );
  for (const audio of audioList) await playAudioAsync(audio);
  state.audio.playing = false;
};

const stopAudioList = () => {
  state.audio.stack.forEach((x) => {
    (document.getElementById(x.name) as HTMLAudioElement)?.pause();
  });
  state.audio.playing = false;
};

const togglePlaySelectedAudio = () => {
  const audio = document.getElementById('audio-sample') as HTMLMediaElement;
  audio.paused ? audio.play() : audio.pause();
};
</script>

<template>
  <v-col cols="3">
    <v-card
      v-show="audioFileNames.length"
      color="blue darken-3"
      density="compact"
      tabindex="-1"
      @keydown.up.prevent="selectPrev('audio-select')"
      @keydown.left.prevent="selectPrev('audio-select')"
      @keydown.down.prevent="selectNext('audio-select')"
      @keydown.right.prevent="selectNext('audio-select')"
      @keydown.space.prevent="togglePlaySelectedAudio"
      class="focusable"
    >
      <v-card-title class="d-flex flex-row"
        ><span>◆音声</span>
        <v-spacer></v-spacer>
        <v-btn-group variant="outlined" density="compact">
          <v-btn :icon="mdiChevronLeft" @click="selectPrev('audio-select')" title="前へ" />
          <v-btn
            :icon="mdiChevronRight"
            @click="selectNext('audio-select')"
            title="次へ"
          /> </v-btn-group
      ></v-card-title>
      <v-card-text>
        <select v-model="state.audio.selected" @change="selectAudio" id="audio-select">
          <option v-for="audio in audioFileNames" :value="audio" :key="audio">
            {{ audio }}
          </option>
        </select>
        <p>
          {{
            props.audioTextMap.get(state.audio.selected) ??
            props.audioTextMap.get(state.audio.selected.split('/').at(-1) ?? '') ??
            ''
          }}
        </p>
        <img
          v-if="state.messageImageMap.has(state.audio.selected.split('/').at(-1) ?? '')"
          :src="state.messageImageMap.get(state.audio.selected.split('/').at(-1) ?? '')"
          style="width: 100%"
          alt="メッセージ"
        />
        <audio id="audio-sample" controls :volume="props.volume / 100" style="width: 100%" />
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-show="state.audio.stack.length > 0 && !state.audio.playing"
          size="small"
          variant="outlined"
          @click="playAudioList"
          class="mx-2"
          >初めから再生
        </v-btn>
        <v-btn
          v-show="state.audio.stack.length > 0 && state.audio.playing"
          size="small"
          variant="outlined"
          @click="stopAudioList"
          class="mx-2"
          >停止
        </v-btn>
        <v-spacer />
        <v-btn
          size="x-small"
          v-show="state.audio.selected"
          :icon="mdiPlus"
          @click="addAudio"
          variant="outlined"
        />
      </v-card-actions>
    </v-card>
  </v-col>
  <v-col cols="3" v-for="media in state.audio.stack" :key="media.name">
    <AudioContainer
      :volume="props.volume"
      :media="media"
      @clickCloseBtn="removeAudio(media.name)"
    />
  </v-col>
</template>

<style scoped lang="scss"></style>
