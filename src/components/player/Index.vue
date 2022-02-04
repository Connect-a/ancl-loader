<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import JSZip from 'jszip';
import { spine } from "@/spine-ts/3.7/spine-player";
import "@/spine-ts/3.7/spine-player.css";
import { StoryElement } from '@/@types';

type AnclFile = { fullPath: string, name: string, file: File | Promise<File> };
type Media = {
  name: string;
  file: File | Promise<File>;
  cutStart: number;
  cutEnd: number;
  rate: number;
  repeat: boolean;
};

const toUrl = URL.createObjectURL;
const readAsFile = (f: FileSystemFileEntry) =>
  new Promise((r: FileCallback, rej) => f.file(r, rej));
const readEntries = (f: FileSystemDirectoryEntry) =>
  new Promise((r: EntriesCallback, rej) => (f.createReader()).readEntries(r, rej));
const newFile = async (obj: JSZip.JSZipObject) =>
  new File([await (obj as JSZip.JSZipObject).async("blob")], obj.name);

const loadStatus = reactive({ status: "", file: "" });
const storySources = reactive(new Map<string, Array<StoryElement>>());
const targetStory = ref("");
const storyElement = ref({} as StoryElement);
const changeStoryElement = () => {
  const audio = document.getElementById("story-audio") as HTMLAudioElement;
  if (!audio) return;
  const targetVoice = `${targetStory.value}/${storyElement.value.p1_chara_voice_text
    + storyElement.value.p2_chara_voice_text
    + storyElement.value.p3_chara_voice_text
    + storyElement.value.p4_chara_voice_text
    + storyElement.value.p5_chara_voice_text
    }`.replace("source.json", "voice");
  const t = audios.value.find(x => x.name === targetVoice)?.file;
  if (!t) return;
  audio.src = toUrl(t as File)
  audio.play();
}
const medias = reactive(new Array<Media>());
const movies = computed(() => medias.filter(x => x.name.includes("mp4")));
const audios = computed(() => medias.filter(x => x.name.includes("m4a")).sort((a, b) => a.name.localeCompare(b.name)));
const audioStack = reactive(new Array<Media>());
const audioTextMap = reactive(new Map<string, string>());
const msgMap = new Map<string, string>([
  ["m1", "V201.m4a"],
  ["m2", "V202.m4a"],
  ["m3", "V203.m4a"],
  ["m4", "V204.m4a"],
  ["m5", "V205.m4a"],
  ["m6", "V206.m4a"],
  ["m7", "V424.m4a"],
  ["m8", "V309.m4a"],
  ["m9", "V310.m4a"],
  ["m10", "V311.m4a"],
  ["m11", "V312.m4a"],
  ["m12", "V313.m4a"],
  ["m13", "V314.m4a"],
  ["m14", "V315.m4a"],
  ["m15", "V404.m4a"],
  ["m16", "V405.m4a"],
  ["m17", "V406.m4a"],
  ["m18", "V407.m4a"],
  ["m19", "V408.m4a"],
  ["m20", "V410.m4a"],
]);

// 画像
const images = reactive(Array<{ name: string, file: Promise<File> }>());
const imageTarget = ref("");
const selectImage = async () => {
  const imageElement = document.getElementById("image-sample") as HTMLImageElement;
  const t = await images.find(x => x.name === imageTarget.value)?.file;
  if (!t) return;
  imageElement.src = (await blobToBase64(t)).replace("application/octet-stream", `image/${imageTarget.value.split('.').pop()}`);
}
const clearImage = () => (imageTarget.value = "");
const expandImage = ref(false);
const showImageChecker = ref(true);

const audioTarget = ref("");
const audioElemet = document.createElement('audio') as HTMLAudioElement;
const selectAudio = () => {
  const t = audios.value.find(x => x.name === audioTarget.value)?.file;
  if (!t) return;
  audioElemet.src = toUrl(t as File);
  audioElemet.play();
}

const playAllAudio = async () => {
  const playingArray = audioStack.map(x => () => {
    const v = document.getElementById(x.name) as HTMLMediaElement;
    v.setAttribute('repeat', "false");
    if (!v) return;
    v.currentTime = Number(v.getAttribute('cutStart'));
    const w = v.duration - v.currentTime;
    v.play();
    return v;
  });

  const play = (i: number) => {
    if (i + 1 > playingArray.length) i = 0;
    const v = playingArray[i]();
    if (!v) return;
    v.onended = (ev) => play(i + 1);
  }
  play(0);
}

// ストーリー
const floatStory = ref(false);
const storyStyle = reactive({
  position: 'fixed',
  marginTop: '64px',
  top: '',
  right: '',
  bottom: '10px',
  left: '10px',
  width: '500px',
  opacity: '1',
  resize: "horizontal"
} as CSSStyleDeclaration);
const storyFontSize = ref(1);

// SDアニメーション
const skeletons = reactive(new Map<string, { json: string, atlas: string, png: Blob | null }>());
const skeletonTarget = ref("");

const blobToBase64 = async (blob: Blob): Promise<string> =>
  new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
const clearSpine = () => {
  const player = document.getElementById("spine-player");
  if (!player) return;
  while (player.firstChild) player.firstChild.remove();
  skeletonTarget.value = "";
}

const loadSpine = async (data: { json: string, atlas: string, png: Blob | null }) => {
  if (data.png === null) return;
  const buf = skeletonTarget.value;
  clearSpine();
  skeletonTarget.value = buf;
  const player = document.getElementById("spine-player");
  if (!player) return;
  data.atlas = data.atlas.replace("skeleton.png", (await blobToBase64(data.png)).replace("application/octet-stream", "image/png"));
  const conf = {
    jsonUrl: `data:application/json;base64,${btoa(unescape(encodeURIComponent(data.json)))}`,
    atlasUrl: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(data.atlas)))}`,
    backgroundColor: "#666666",
    premultipliedAlpha: false,
  } as unknown as spine.SpinePlayerConfig;
  new spine.SpinePlayer("spine-player", conf);
}

const expandSpine = ref(false);
const selectSkeleton = () => {
  const t = skeletons.get(skeletonTarget.value);
  if (!t?.png) return;
  loadSpine(t);
}

const playingMovies = reactive(new Array<Media>());
const toggleMovie = (media: Media) => {
  const index = playingMovies.findIndex(x => x.name === media.name);
  if (index === -1) {
    playingMovies.push(media);
    return;
  }
  playingMovies.splice(index, 1);

  // HACK:リロードしないとなことなる。video要素が使いまわしされてそう？
  document.querySelectorAll("video").forEach(x => {
    x.load();
    x.play()
  });
}

// 読み込みまわり
const clear = () => {
  medias.splice(0);
  skeletons.clear();
  images.splice(0);
  storySources.clear();
  imageTarget.value = "";
  clearSpine();
  playingMovies.splice(0);
  audioStack.splice(0);
}
const onDrop = (e: DragEvent) => loadItems(e.dataTransfer?.files);
const onInput = (e: Event) => loadItems((e.target as HTMLInputElement)?.files);

const loadItems = async (files: FileList | undefined | null) => {
  if (!files) return;
  if (files.length === 0) return;
  loadStatus.status = "Loading...";
  await readAllFiles(files[0]);
  loadStatus.status = "完了";
  loadStatus.file = "";
}

const readAllFiles = async (file: File) => {
  const anclFiles = new Array<AnclFile>();
  if (!file.name.includes("zip")) return;
  const z = await JSZip.loadAsync(file);
  for (const [k, v] of Object.entries(z.files)) {
    anclFiles.push({ fullPath: v.name, name: v.name.split("/").slice(-1)[0], file: newFile(v) })
    loadStatus.file = v.name;
    // 動画と音声
    if (v.name.includes('mp4') || v.name.includes('m4a')) {
      medias.push({
        name: v.name,
        file: await newFile(v),
        cutStart: 0,
        cutEnd: 0,
        rate: 1,
        repeat: true
      } as Media)
    }

    // 音声の内容
    if (v.name.includes('source.json') || v.name.includes('meta.json')) {
      const obj = JSON.parse(await v.async("string"));
      if (Array.isArray(obj)) {
        storySources.set(v.name, obj);
        for (const t of obj) {
          const vo = t.p1_chara_voice_text
            + t.p2_chara_voice_text
            + t.p3_chara_voice_text
            + t.p4_chara_voice_text
            + t.p5_chara_voice_text;
          if (!vo) continue;

          audioTextMap.set(`${v.name}/${vo}`.replace("source.json", "voice"), t.text);
        }
      }
      if ('msg' in obj) {
        for (let i = 1; i <= 20; i++) {
          const key = 'm' + i.toString();
          const text = obj.msg[key];
          audioTextMap.set(msgMap.get(key) ?? "", text);
        }
      }
    }

    // 画像
    if (!v.dir && (v.name.includes("png") || v.name.includes("jpg"))) {
      images.push({ name: v.name, file: newFile(v) });
    }

    // spine
    if (!v.dir && v.name.includes("skeleton")) {
      const key = v.name.replace(/\/skeleton\..*/, "");
      if (!skeletons.has(key)) skeletons.set(key, { json: "", atlas: "", png: null });
      const d = skeletons.get(key);
      if (d) {
        if (v.name.includes("skeleton.json")) d.json = await v.async("string");
        if (v.name.includes("skeleton.atlas")) d.atlas = await v.async("string");
        if (v.name.includes("skeleton.png")) d.png = await v.async("blob");
      }
    }
  }

  return anclFiles;
}

// 再生制御
const onTimeUpdate = function (this: HTMLMediaElement, ev: Event) {
  if (this.currentTime < (this.duration - Number(this.getAttribute('cutEnd')))) return;
  this.currentTime = Number(this.getAttribute('cutStart'));
  const repeat = this.getAttribute('repeat');
  if (repeat === 'true') this.play();
  if (repeat === 'false') {
    this.pause();
    this.dispatchEvent(new Event("ended"));
  }
}
const onEnd = function (this: HTMLMediaElement, ev: Event) {
  this.currentTime = Number(this.getAttribute('cutStart'));
  if (this.getAttribute('repeat') === 'true') this.play();
}

const mediaDurationMap = reactive(new Map<string, number>());

const updateMediaSettings = (id: string) => {
  const media = movies.value.concat(audios.value).find(x => x.name === id);
  if (!media) return;

  const v = document.getElementById(id) as HTMLMediaElement;

  mediaDurationMap.set(id, v.duration);
  v.playbackRate = media.rate ?? 1;
  v.setAttribute('cutStart', media.cutStart?.toString() ?? 0);
  v.setAttribute('cutEnd', media.cutEnd?.toString() ?? 0);
  v.setAttribute('repeat', media.repeat?.toString() ?? false);
  v.addEventListener("timeupdate", onTimeUpdate);
  v.addEventListener("ended", onEnd);
}

const toggleControll = (id: string) => {
  const v = document.getElementById(id) as HTMLVideoElement;
  v.controls = !v.controls;
};
const togglePlay = (id: string) => {
  const v = document.getElementById(id) as HTMLVideoElement;
  if (v.paused) {
    v.play();
    return;
  }
  v.pause();
}
const fullscreen = (id: string) => (document.getElementById(id) as HTMLVideoElement).requestFullscreen();
const expandMovie = ref(false);
const pip = (id: string) => (document.getElementById(id) as HTMLVideoElement).requestPictureInPicture();

</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title primary-title>機能</v-card-title>
          <v-card-text class="py-0 pl-10">
            <ul>
              <li>音声の再生</li>
              <li>SDアニメーション再生</li>
              <li>画像の表示</li>
              <li>ストーリーの簡易再生</li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col @drop.prevent="onDrop" @dragenter.prevent @dragover.prevent>
        <v-card color="blue-grey">
          <v-card-text>
            <p>zipをここにドロップ</p>
            <p>{{ loadStatus }}</p>
            <input
              class="text-black"
              type="file"
              @input="onInput"
              accept=".zip"
              style="width:100%;"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn @click="clear" color="cyan">読み込み結果のクリア</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <!-- 音声 追加 -->
      <v-col cols="3">
        <v-card v-show="audios && audios.length" color="blue darken-2">
          <v-card-title>◆音声</v-card-title>
          <v-card-text>
            <select
              v-model="audioTarget"
              @change="selectAudio"
              class="bg-white text-black"
              style="width:100%;appearance: auto;"
            >
              <option v-for="audio in audios" :value="audio.name">{{ audio.name }}</option>
            </select>
            <p>{{ audioTextMap.get(audioTarget) ?? audioTextMap.get(audioTarget.split("/").slice(-1)[0]) ?? "" }}</p>
          </v-card-text>

          <v-card-actions v-show="audioTarget">
            <v-btn
              @click="audioStack.push(audios.find(x => x.name === audioTarget) ?? {} as Media)"
            >音声追加</v-btn>
            <v-btn @click="playAllAudio">初めから再生</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="3" v-for="media in audioStack">
        <v-card color="green darken-5" class="d-inline-block" width="100%">
          <v-card-text class="d-flex flex-column">
            <audio
              :id="media.name"
              @loadstart="updateMediaSettings(media.name)"
              controls
              repeat="true"
              style="width:100%;"
            >
              <source :src="toUrl(media.file as File)" />
            </audio>
            <label>
              リピート
              <input
                v-model="media.repeat"
                type="checkbox"
                @change="updateMediaSettings(media.name)"
              />
            </label>
            <label>
              先頭カット
              <input
                v-model="media.cutStart"
                type="range"
                min="0"
                :max="mediaDurationMap.get(media.name)"
                step=".05"
                @change="updateMediaSettings(media.name)"
              />
            </label>
            <label>
              後ろカット
              <input
                v-model="media.cutEnd"
                type="range"
                min="0"
                :max="mediaDurationMap.get(media.name)"
                step=".05"
                @change="updateMediaSettings(media.name)"
              />
            </label>
            <label>
              再生速度
              <input
                v-model="media.rate"
                type="range"
                defaultValue="1"
                step=".1"
                min="0"
                max="2"
                @change="updateMediaSettings(media.name)"
              />
            </label>
          </v-card-text>
          <v-card-actions>
            <v-btn
              @click="audioStack.splice(audioStack.findIndex(x => x.name === media.name), 1)"
            >削除</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="3">
        <v-card v-show="skeletons && skeletons.size" color="blue darken-2">
          <v-card-title>◆SDアニメーション</v-card-title>
          <v-card-text>
            <select
              v-model="skeletonTarget"
              @change="selectSkeleton"
              class="bg-white text-black"
              style="width:100%;appearance: auto;"
            >
              <option v-for="[key, s] in skeletons" :value="key">{{ key }}</option>
            </select>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="clearSpine">クリア</v-btn>
            <label class="mx-2">
              広げる
              <input v-model="expandSpine" type="checkbox" />
            </label>
          </v-card-actions>
        </v-card>
        <v-card v-show="images && images.length" color="blue darken-2 mt-3">
          <v-card-title>◆画像</v-card-title>
          <v-card-text>
            <select
              v-model="imageTarget"
              @change="selectImage"
              class="bg-white text-black"
              style="width:100%;appearance: auto;"
            >
              <option
                v-for="image in images.sort((a, b) => a.name.localeCompare(b.name))"
                :value="image.name"
              >{{ image.name }}</option>
            </select>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="clearImage">クリア</v-btn>
            <label class="mx-2">
              広げる
              <input v-model="expandImage" type="checkbox" />
            </label>
            <label class="mx-2">
              チェック背景
              <input v-model="showImageChecker" type="checkbox" />
            </label>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="9" v-show="skeletonTarget">
        <div
          id="spine-player"
          :style="{
            height: expandSpine ? '520px' : '320px',
            width: expandSpine ? '100%' : 'unset',
          }"
        ></div>
      </v-col>
      <v-col cols="9" v-show="imageTarget" class="ml-auto">
        <img
          v-show="imageTarget"
          id="image-sample"
          alt="画像サンプル"
          :style="{
            maxHeight: expandImage ? 'unset' : '320px',
            width: expandImage ? '100%' : 'unset',
            background: (showImageChecker ? `repeating-conic-gradient(#808080 0% 25%, #D3D3D3 0% 50%) 50% / 40px 40px` : '')
          }"
        />
      </v-col>
    </v-row>

    <!-- 動画 -->
    <v-row class="my-2" v-show="movies.length">
      <v-btn
        v-for="movie in movies"
        @click="toggleMovie(movie)"
        :color="playingMovies.find(x => x.name === movie.name) ? 'green' : 'grey'"
      >{{ movie.name }}</v-btn>
    </v-row>
    <v-row class="my-2">
      <v-col :cols="expandMovie ? 11 : 6" v-for="media in playingMovies">
        <video
          :id="media.name"
          @loadstart="updateMediaSettings(media.name)"
          autoplay
          repeat="true"
          @click="togglePlay(media.name)"
          @dblclick="fullscreen(media.name)"
          style="width:100%;"
        >
          <source :src="toUrl(media.file as File)" type="video/mp4" />
        </video>
        <v-card color="green" class="d-inline-block">
          <v-card-text class="d-flex flex-column">
            <div class="d-flex">
              <label class="mx-2">
                広げる
                <input v-model="expandMovie" type="checkbox" />
              </label>
              <v-btn @click="pip(media.name)" color="grey" size="x-small" title="ピクチャインピクチャ">PiP</v-btn>
              <v-btn
                @click="toggleControll(media.name)"
                color="grey"
                size="x-small"
                title="コントロール表示切替"
              >CTRL</v-btn>
            </div>
            <label>
              先頭カット
              <input
                v-model="media.cutStart"
                type="range"
                min="0"
                :max="mediaDurationMap.get(media.name)"
                step=".05"
                @change="updateMediaSettings(media.name)"
              />
            </label>
            <label>
              後ろカット
              <input
                v-model="media.cutEnd"
                type="range"
                min="0"
                :max="mediaDurationMap.get(media.name)"
                step=".05"
                @change="updateMediaSettings(media.name)"
              />
            </label>
            <label>
              再生速度
              <input
                v-model="media.rate"
                type="range"
                defaultValue="1"
                step=".1"
                min="0"
                max="2"
                @change="updateMediaSettings(media.name)"
              />
            </label>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-show="storySources && storySources.size">
      <v-col cols="6">
        <v-card :style="[floatStory ? storyStyle : undefined]">
          <v-card-title v-show="!floatStory">◆ストーリー</v-card-title>
          <v-card-text style="line-height:initial;">
            <select
              v-model="targetStory"
              class="my-2 bg-white text-black"
              style="width:100%;appearance: auto;"
            >
              <option v-for="[title, v] in storySources" :value="title">{{ title }}</option>
            </select>
            <select
              v-model="storyElement"
              @change="changeStoryElement"
              class="my-2 bg-white text-black"
              style="width:100%;appearance: auto;"
            >
              <option
                v-for="element in storySources.get(targetStory)"
                :value="element"
              >{{ element.text }}</option>
            </select>
            <div :style="{ fontSize: `${storyFontSize}em` }">
              <p
                v-show="storyElement.speaker"
                class="my-2"
                style="min-height: 1rem;"
              >【{{ storyElement.speaker }}】</p>
              <p v-show="!storyElement.speaker" class="my-2" style="min-height: 1rem;"></p>
              <p
                v-show="storyElement.text"
                class="my-2"
                style="min-height: 3rem;"
              >{{ storyElement.text }}</p>
              <p v-show="storyElement.choice1">＞{{ storyElement.choice1 }}</p>
              <p v-show="storyElement.choice2">＞{{ storyElement.choice2 }}</p>
              <p v-show="storyElement.choice3">＞{{ storyElement.choice3 }}</p>
            </div>
            <div class="d-flex">
              <audio id="story-audio" class="my-2" controls></audio>
              <div class="d-flex flex-column">
                <label class="mx-2">
                  浮かす
                  <input v-model="floatStory" type="checkbox" />
                </label>
                <label class="mx-2">
                  フォントサイズ
                  <input
                    v-model="storyFontSize"
                    type="number"
                    step="0.1"
                    min="0"
                    max="3"
                    style="width:2.5em ;background-color: white;"
                  />
                </label>
                <label class="mx-2">
                  透明度
                  <input
                    v-model="storyStyle.opacity"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    style="width:2.5em ;background-color: white;"
                  />
                </label>
                <div class="d-flex" v-if="floatStory">
                  <v-btn
                    @click="storyStyle.top = '10px'; storyStyle.bottom = '';"
                    size="x-small"
                    color="grey"
                  >↑</v-btn>
                  <v-btn
                    @click="storyStyle.left = ''; storyStyle.right = '10px';"
                    size="x-small"
                    color="grey"
                  >→</v-btn>
                  <v-btn
                    @click="storyStyle.top = ''; storyStyle.bottom = '10px';"
                    size="x-small"
                    color="grey"
                  >↓</v-btn>
                  <v-btn
                    @click="storyStyle.left = '10px'; storyStyle.right = '';"
                    size="x-small"
                    color="grey"
                  >←</v-btn>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>