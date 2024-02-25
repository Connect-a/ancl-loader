<script setup lang="ts">
import { computed, reactive } from 'vue';
import { type IUnzipper } from '@/scripts/zip';
import { selectNext, selectPrev } from '@/scripts/selectConrol';
import { spine } from '@/spine-ts/3.7/spine-player';
import '@/spine-ts/3.7/spine-player.css';

const props = defineProps<{ zip: IUnzipper; fileNames: Array<string> }>();

const state = reactive({
  skeleton: {
    sources: new Map<string, { json: string; atlas: string; png: Blob | null }>(),
    target: '',
    expand: false,
  },
});

const skeletonNames = computed(() => props.fileNames.filter((x) => x.includes('skeleton')));

const clearSpine = () => {
  const player = document.getElementById('spine-player');
  if (!player) return;
  while (player.firstChild) player.firstChild.remove();
  state.skeleton.target = '';
};

const selectSpine = async () => {
  const buf = state.skeleton.target;
  clearSpine();
  state.skeleton.target = buf;

  const player = document.getElementById('spine-player');
  if (!player) return;

  const targetFiles = props.fileNames.filter((x) => x.includes(state.skeleton.target));

  const png = await props.zip.readFileAsData64UriAsync(
    targetFiles.find((x) => x.includes('.png')) ?? '',
    'image/png',
  );
  if (!png) return;
  const json = await props.zip.readFileAsData64UriAsync(
    targetFiles.find((x) => x.includes('.json')) ?? '',
    'application/json',
  );
  const atlas = (
    await props.zip.readFileAsTextAsync(targetFiles.find((x) => x.includes('.atlas')) ?? '')
  )?.replace('skeleton.png', png);

  const conf: Partial<spine.SpinePlayerConfig> = {
    jsonUrl: json,
    atlasUrl: `data:text/plain;base64,${window.btoa(atlas ?? '')}`,
    backgroundColor: '#666666',
    premultipliedAlpha: false,
  };
  new spine.SpinePlayer('spine-player', conf as spine.SpinePlayerConfig);
};
</script>

<template>
  <v-col cols="3">
    <v-card
      v-show="skeletonNames.length !== 0"
      color="blue darken-3"
      density="compact"
      tabindex="-1"
      @keydown.up.prevent="selectPrev('skel-select')"
      @keydown.left.prevent="selectPrev('skel-select')"
      @keydown.down.prevent="selectNext('skel-select')"
      @keydown.right.prevent="selectNext('skel-select')"
      class="focusable"
    >
      <v-card-title>◆SDアニメーション</v-card-title>
      <v-card-text>
        <select v-model="state.skeleton.target" @change="selectSpine" id="skel-select">
          <option
            v-for="skel in new Set(
              skeletonNames.map((x) => `${x.split('/').at(-3)}/${x.split('/').at(-2)}`),
            )"
            :value="skel"
            :key="skel"
          >
            {{ skel }}
          </option>
        </select>
      </v-card-text>
      <v-card-actions>
        <v-btn size="x-small" variant="outlined" @click="clearSpine">クリア</v-btn>
        <label class="mx-2">
          広げる
          <input v-model="state.skeleton.expand" type="checkbox" />
        </label>
      </v-card-actions>
    </v-card>
  </v-col>
  <v-col :cols="state.skeleton.expand ? 12 : 9">
    <div
      v-show="state.skeleton.target"
      id="spine-player"
      :style="{
        height: state.skeleton.expand ? '520px' : '320px',
        width: state.skeleton.expand ? '100%' : 'unset',
      }"
    />
  </v-col>
</template>
