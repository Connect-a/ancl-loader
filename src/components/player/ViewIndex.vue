<script setup lang="ts">
import { computed, reactive } from 'vue';
import {
  mdiVolumeHigh,
  mdiArrowExpand,
  mdiCheckerboard,
  mdiChevronLeft,
  mdiChevronRight,
} from '@mdi/js';
import { Unzipper } from '@/scripts/zip';
import type { StoryElement } from '@/@types';
import VideoContainer, { type VideoMedia } from './components/VideoContainer.vue';
import SkeletonViewCols from './components/SkeletonListCols.vue';
import AudioListCols from './components/AudioListCols.vue';
import StoryElements from './components/StoryElements.vue';
import { selectNext, selectPrev } from '@/scripts/selectConrol';

const toUrl = URL.createObjectURL;
const msgMap = new Map<string, string>([
  ['m1', 'V201.m4a'],
  ['m2', 'V202.m4a'],
  ['m3', 'V203.m4a'],
  ['m4', 'V204.m4a'],
  ['m5', 'V205.m4a'],
  ['m6', 'V206.m4a'],
  ['m7', 'V424.m4a'],
  ['m8', 'V309.m4a'],
  ['m9', 'V310.m4a'],
  ['m10', 'V311.m4a'],
  ['m11', 'V312.m4a'],
  ['m12', 'V313.m4a'],
  ['m13', 'V314.m4a'],
  ['m14', 'V315.m4a'],
  ['m15', 'V404.m4a'],
  ['m16', 'V405.m4a'],
  ['m17', 'V406.m4a'],
  ['m18', 'V407.m4a'],
  ['m19', 'V408.m4a'],
  ['m20', 'V410.m4a'],
]);

const state = reactive({
  zip: new Unzipper(),
  loadingNow: false,
  dragOn: false,
  name: '',
  audioTextMap: new Map<string, string>(),
  messageImageMap: new Map<string, string>(),
  movie: {
    stack: new Array<VideoMedia>(),
    expands: new Set<string>(),
  },
  image: {
    selected: '',
    expand: false,
    showChecker: true,
  },
  story: {
    elements: new Array<StoryElement>(),
  },
  volume: parseInt(localStorage.getItem('volume') ?? '50'),
});

const fileNames = computed(() =>
  state.zip.entries
    .filter((x) => !x.directory)
    .filter((x) => x.filename)
    .map((x) => x.filename)
    .toSorted(),
);

const movieFileNames = computed(() => fileNames.value.filter((x) => x.includes('mp4')));
const imageFileNames = computed(() =>
  fileNames.value.filter((x) => x.includes('png') || x.includes('jpg')),
);

const readAllFiles = async (file: File) => {
  if (!file.name.includes('zip')) return;
  await state.zip.initAsync(file);
  // 音声の内容設定
  for (const entry of state.zip.entries.filter((x) => x.filename?.includes('.json'))) {
    const obj = await state.zip.readFileAsJsonAsync(entry.filename);
    if (entry.filename.includes('source.json') && Array.isArray(obj)) {
      for (const t of obj) {
        const vo =
          t.p1_chara_voice_text +
          t.p2_chara_voice_text +
          t.p3_chara_voice_text +
          t.p4_chara_voice_text +
          t.p5_chara_voice_text;
        if (!vo) continue;

        state.audioTextMap.set(`${entry.filename}/${vo}`.replace('source.json', 'voice'), t.text);
      }
    }

    if (entry.filename.includes('meta.json')) {
      if ('name' in obj) state.name = obj.name as string;
      if ('msg' in obj) {
        for (let i = 1; i <= 20; i++) {
          const key = `m${i}`;
          state.audioTextMap.set(msgMap.get(key) ?? '', (obj.msg as Record<string, string>)[key]);
        }
      }

      if ('voiceTextMap' in obj) {
        for (const [k, v] of Object.entries(obj.voiceTextMap as { [index: string]: string })) {
          state.audioTextMap.set(`${k}.m4a`, v);
        }
      }
    }
  }
};

const selectImage = async () => {
  const t = await state.zip.readFileAsBlobAsync(state.image.selected);
  if (!t) return;
  const e = document.getElementById('image-sample') as HTMLImageElement;
  if (!e) return;
  e.src = toUrl(t);
};
const addMovie = async (name: string) =>
  state.movie.stack.push({
    name,
    blob: (await state.zip.readFileAsBlobAsync(name)) ?? new Blob(),
  });
const addAllMovie = async () => {
  state.movie.stack.splice(0);
  for (const m of movieFileNames.value) {
    await addMovie(m);
  }
};
const removeMovie = async (name: string) =>
  state.movie.stack.splice(
    state.movie.stack.findIndex((x) => x.name === name),
    1,
  );
const toggleMovieExpand = (name: string) => {
  if (state.movie.expands.has(name)) {
    state.movie.expands.delete(name);
  } else {
    state.movie.expands.add(name);
  }
};

// 読み込みまわり
const clear = () => {
  state.zip.entries.splice(0);
  state.story.elements.splice(0);
  state.image.selected = '';
  state.movie.stack.splice(0);
  state.audioTextMap.clear();
  //
  const fileInput = document.getElementById('zipInput') as HTMLInputElement;
  fileInput.value = '';
  const player = document.getElementById('spine-player');
  while (player?.firstChild) player.firstChild.remove();
};
const onDrop = (e: DragEvent) => {
  state.dragOn = false;
  loadItems(e.dataTransfer?.files);
};
const onInput = (e: Event) => loadItems((e.target as HTMLInputElement)?.files);

const loadItems = async (files: FileList | undefined | null) => {
  if (!files) return;
  if (files.length === 0) return;
  state.loadingNow = true;
  await readAllFiles(files[0]);
  state.loadingNow = false;
};

const storeVolume = () => localStorage.setItem('volume', `${state.volume}`);
</script>

<template>
  <v-container>
    <v-row dense>
      <v-col>
        <v-card title="機能">
          <v-card-text>
            <ul>
              <li>音声の再生</li>
              <li>SDアニメーション再生</li>
              <li>画像の表示</li>
              <li>ストーリーの簡易再生</li>
            </ul>
            <v-slider
              v-model="state.volume"
              :prepend-icon="mdiVolumeHigh"
              :min="0"
              :max="100"
              hide-details
              @update:modelValue="storeVolume"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col>
        <v-card
          @dragover.prevent="state.dragOn = true"
          @dragleave.prevent="state.dragOn = false"
          @drop.prevent="onDrop"
          class="drop-target"
          :class="{ 'drag-enter': state.dragOn }"
        >
          <v-card-text style="text-align: center">
            <v-progress-circular v-show="state.loadingNow" indeterminate />
            <p v-show="!state.loadingNow" style="text-align: center">ここにzipをドロップ</p>
          </v-card-text>
          <v-card-actions>
            <input type="file" @input="onInput" accept=".zip" id="zipInput" />
            <v-btn size="small" variant="outlined" @click="clear">読み込み結果のクリア</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <v-row dense>
      <SkeletonViewCols :zip="state.zip" :file-names="fileNames" />
    </v-row>
    <v-row dense>
      <AudioListCols
        :zip="state.zip"
        :chara-name="state.name"
        :file-names="fileNames"
        :volume="state.volume"
        :audio-text-map="state.audioTextMap"
      />
    </v-row>
    <v-row dense>
      <v-col cols="3">
        <v-card
          v-show="imageFileNames?.length"
          color="blue darken-4"
          density="compact"
          tabindex="-1"
          @keydown.up.prevent="selectPrev('image-select')"
          @keydown.left.prevent="selectPrev('image-select')"
          @keydown.down.prevent="selectNext('image-select')"
          @keydown.right.prevent="selectNext('image-select')"
          class="focusable"
        >
          <v-card-title class="d-flex flex-row">
            <span>◆画像</span>
            <v-spacer></v-spacer>
            <v-btn-group variant="outlined" density="compact">
              <v-btn :icon="mdiChevronLeft" @click="selectPrev('image-select')" title="前へ" />
              <v-btn :icon="mdiChevronRight" @click="selectNext('image-select')" title="次へ" />
            </v-btn-group>
          </v-card-title>
          <v-card-text>
            <select v-model="state.image.selected" @change="selectImage" id="image-select">
              <option v-for="image in imageFileNames" :value="image" :key="image">
                {{ image }}
              </option>
            </select>
          </v-card-text>
          <v-card-actions>
            <v-btn size="x-small" variant="outlined" @click="state.image.selected = ''"
              >クリア</v-btn
            >
            <v-btn
              size="x-small"
              :variant="state.image.expand ? 'plain' : 'outlined'"
              :icon="mdiArrowExpand"
              @click="state.image.expand = !state.image.expand"
            />
            <v-btn
              size="x-small"
              :variant="state.image.showChecker ? 'plain' : 'outlined'"
              :icon="mdiCheckerboard"
              @click="state.image.showChecker = !state.image.showChecker"
            />
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="9" v-show="state.image.selected" class="ml-auto">
        <img
          id="image-sample"
          alt="画像サンプル"
          :style="{
            maxHeight: state.image.expand ? 'unset' : '320px',
            width: state.image.expand ? '100%' : 'unset',
            background: state.image.showChecker
              ? `repeating-conic-gradient(#808080 0% 25%, #D3D3D3 0% 50%) 50% / 40px 40px`
              : '',
          }"
        />
      </v-col>
    </v-row>

    <!-- 動画 -->
    <v-row v-show="movieFileNames.length" dense>
      <v-col>
        <v-card
          title="◆動画"
          v-show="movieFileNames?.length"
          color="blue darken-4"
          density="compact"
          tabindex="-1"
        >
          <v-card-text>
            <v-container>
              <v-row>
                <template v-for="movie in movieFileNames" :key="movie">
                  <v-btn
                    v-show="!state.movie.stack.map((x) => x.name).includes(movie)"
                    @click="addMovie(movie)"
                    color="grey"
                    >{{ movie.split('/').findLast((x) => x) }}</v-btn
                  >
                  <v-btn
                    v-show="state.movie.stack.map((x) => x.name).includes(movie)"
                    @click="removeMovie(movie)"
                    color="green"
                  >
                    {{ movie.split('/').findLast((x) => x) }}
                  </v-btn>
                </template>
              </v-row>
              <v-row v-show="movieFileNames.length">
                <v-btn @click="addAllMovie">全て表示</v-btn>
                <v-btn @click="movieFileNames.forEach(removeMovie)">クリア</v-btn>
                <v-btn @click="state.movie.expands = new Set(movieFileNames)">ひろげる</v-btn>
                <v-btn @click="state.movie.expands = new Set()">ちぢめる</v-btn>
              </v-row>
            </v-container>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col
        v-for="media in state.movie.stack"
        :key="media.name"
        :cols="state.movie.expands.has(media.name) ? 12 : 6"
      >
        <VideoContainer
          :media="media"
          :volume="state.volume / 100"
          @click-expand="toggleMovieExpand(media.name)"
        />
      </v-col>
    </v-row>

    <!-- ストーリー -->
    <v-row dense v-show="fileNames.some((x) => x.includes('source.json'))">
      <v-col cols="6">
        <StoryElements :zip="state.zip" :file-names="fileNames" :volume="state.volume" />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.drop-target {
  border: 8px dashed grey;
}

.drag-enter {
  filter: brightness(2);
}
</style>
