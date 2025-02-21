<script setup lang="ts">
import { computed, nextTick, reactive } from 'vue';
import SoundPlayButton from './SoundPlayButton.vue';
import type { Character } from '@/@types';

type Chara = Character & { acquired: boolean; battleTypeText: string };

const props = defineProps<{
  items: Array<Chara>;
  targetId: string;
  loadingStatusMessage: string;
  workingCharaId: string;
}>();

const state = reactive({
  showLargeImage: false,
  selectedFaceImageSuffix: 'st_01.png',
  standingPicture: new Map<string, ImageBitmap>(),
});

const emit = defineEmits(['clickEsc', 'clickProfileKeyword', 'clickKeyword', 'clickDownload', 'changeTargetId']);

const charaDetail = computed(() => props.items.find((x) => x.chara_id === props.targetId) ?? ({ profile: {} } as Chara));

const changeStandingPicture = async () => {
  const canvas = document.getElementById('standing-picture') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const baseImageSuffix = `st_99.png`;
  let standinbPictureBase = state.standingPicture.get(baseImageSuffix);
  if (!standinbPictureBase) {
    const res = await fetch(`https://ancl.jp/img/game/chara/${props.targetId}/graphic/${props.targetId}_${baseImageSuffix}`);
    standinbPictureBase = await createImageBitmap(await res.blob());
    state.standingPicture.set(baseImageSuffix, standinbPictureBase);
  }
  let facePicture = state.standingPicture.get(state.selectedFaceImageSuffix);
  if (!facePicture) {
    const res = await fetch(`https://ancl.jp/img/game/chara/${props.targetId}/graphic/${props.targetId}_${state.selectedFaceImageSuffix}`);
    facePicture = await createImageBitmap(await res.blob());
    state.standingPicture.set(state.selectedFaceImageSuffix, facePicture);
  }
  canvas.width = standinbPictureBase.width;
  canvas.height = standinbPictureBase.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(standinbPictureBase, 0, 0);
  ctx.drawImage(facePicture, 0, 0);
};

const showNextCharaDetail = async () => {
  const currentIndex = props.items.findIndex((x) => x.chara_id === props.targetId);
  if (currentIndex === -1) return;
  const nextItem = props.items[currentIndex + 1];
  if (!nextItem) {
    window.alert('次のキャラが見つかりませんでした。');
    return;
  }
  await changeChara(nextItem.chara_id);
};
const showPrevCharaDetail = async () => {
  const currentIndex = props.items.findIndex((x) => x.chara_id === props.targetId);
  if (currentIndex === -1) return;
  const prevItem = props.items[currentIndex - 1];
  if (!prevItem) {
    window.alert('前のキャラが見つかりませんでした。');
    return;
  }
  await changeChara(prevItem.chara_id);
};

const changeChara = (charaId: string) => {
  emit('changeTargetId', charaId);
  nextTick(async () => {
    state.standingPicture.clear();
    if (state.showLargeImage) await changeStandingPicture();
  });
};
</script>

<template>
  <v-card
    id="chara-detail-card"
    @keydown.left.prevent="showPrevCharaDetail"
    @keydown.right.prevent="showNextCharaDetail"
    class="focusable"
    tabindex="-1"
  >
    <v-card-title class="d-flex align-center">
      <v-toolbar flat>
        <v-toolbar-title>
          <span
            class="text-cyan text-decoration-underline cursor-pointer"
            @click="emit('clickKeyword', charaDetail.name.split('(')[0] ?? charaDetail.name)"
            >{{ charaDetail.name.split('(')[0] ?? charaDetail.name }}</span
          >
          <span v-if="charaDetail.name.includes('(')">{{ `(${charaDetail.name.split('(')[1]}` }}</span>
          <span>{{ `：${charaDetail.chara_id}` }}</span></v-toolbar-title
        >
        <v-spacer />
        <v-btn @click="emit('clickDownload')" variant="flat" color="primary" class="mx-3" :disabled="props.loadingStatusMessage !== ''">{{
          props.workingCharaId === charaDetail.chara_id ? props.loadingStatusMessage : 'ダウンロード'
        }}</v-btn>
        <v-btn variant="outlined" @click="showPrevCharaDetail">＜＜</v-btn>
        <v-btn variant="outlined" @click="showNextCharaDetail">＞＞</v-btn>
        <v-btn variant="outlined" @click="emit('clickEsc')" class="mx-3">ESC</v-btn>
      </v-toolbar>
    </v-card-title>
    <v-card-text style="font-size: medium">
      <v-row>
        <v-col :order="state.showLargeImage ? 3 : 1" cols="12" :sm="state.showLargeImage ? 12 : 4" :lg="state.showLargeImage ? 12 : 3">
          <v-img
            v-if="!state.showLargeImage"
            :src="`https://ancl.jp/img/game/chara/${props.targetId}/graphic/${props.targetId}_gr_t.jpg`"
            :alt="`${charaDetail.name}`"
            @click="
              async () => {
                state.showLargeImage = true;
                await changeStandingPicture();
              }
            "
            class="rounded cursor-pointer"
          />
          <v-img
            v-if="state.showLargeImage"
            :src="`https://ancl.jp/img/game/chara/${props.targetId}/graphic/${props.targetId}_gr_it.jpg`"
            :alt="`${charaDetail.name}`"
            @click="state.showLargeImage = false"
            class="rounded cursor-pointer"
          />
          <v-btn-toggle
            v-if="state.showLargeImage"
            v-model="state.selectedFaceImageSuffix"
            @update:modelValue="changeStandingPicture"
            mandatory
            color="primary"
            class="mt-5"
          >
            <v-btn value="st_01.png">01</v-btn>
            <v-btn value="st_02.png">02</v-btn>
            <v-btn value="st_03.png">03</v-btn>
            <v-btn value="st_04.png">04</v-btn>
            <v-btn value="st_05.png">05</v-btn>
            <v-btn value="st_06.png">06</v-btn>
            <v-btn value="st_07.png">07</v-btn>
          </v-btn-toggle>
          <canvas id="standing-picture" v-show="state.showLargeImage" style="width: 100%"></canvas>
        </v-col>
        <v-col :order="state.showLargeImage ? 1 : 2" cols="12" sm="8" :md="state.showLargeImage ? 5 : 3" lg="3">
          <ul>
            <li>
              <span class="text-cyan text-decoration-underline cursor-pointer" @click="emit('clickProfileKeyword', charaDetail.battleTypeText)">{{
                charaDetail.battleTypeText
              }}</span>
            </li>
            <li>
              所属：<span
                class="text-cyan text-decoration-underline cursor-pointer"
                @click="emit('clickProfileKeyword', charaDetail.profile?.group)"
                >{{ charaDetail.profile?.group }}</span
              >
            </li>
            <li>
              CV：<span
                class="text-cyan text-decoration-underline cursor-pointer"
                @click="emit('clickProfileKeyword', charaDetail.profile?.cv_name)"
                >{{ charaDetail.profile?.cv_name }}</span
              >
            </li>
            <li>
              イラスト：<span
                class="text-cyan text-decoration-underline cursor-pointer"
                @click="emit('clickProfileKeyword', charaDetail.profile?.illust)"
                >{{ charaDetail.profile?.illust }}</span
              >
            </li>
            <li>誕生日：{{ charaDetail.profile?.birth }}</li>
            <li>身長：{{ charaDetail.profile?.height }}</li>
            <li>体重：{{ charaDetail.profile?.weight }}</li>
            <li>サイズ：{{ charaDetail.profile?.size }}</li>
          </ul>
        </v-col>
        <v-col :order="state.showLargeImage ? 2 : 3" cols="12" :md="state.showLargeImage ? 7 : 5" lg="6">
          <ul>
            <li>{{ charaDetail.profile?.flavor }}</li>
            <li>{{ charaDetail.profile?.details }}</li>
          </ul>
        </v-col>
        <v-col order="4" cols="12">
          <!-- ボイス -->
          <v-expansion-panels>
            <v-expansion-panel title="ボイス" color="primary">
              <v-expansion-panel-text>
                <div class="d-flex flex-wrap my-1">
                  <SoundPlayButton :charaId="props.targetId" voiceType="タイトルコール" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="投票時？" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="食材開放" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="ランクアップ" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="レベルアップ" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="スキルレベルアップ" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="キャラ詳細画面" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="誕生日" />
                </div>
                <div class="d-flex flex-wrap my-1">
                  <SoundPlayButton :charaId="props.targetId" voiceType="m1" textId="m1" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m2" textId="m2" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m3" textId="m3" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m4" textId="m4" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m5" textId="m5" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m6" textId="m6" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m7" textId="m7" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m8" textId="m8" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m9" textId="m9" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m10" textId="m10" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m11" textId="m11" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m12" textId="m12" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m13" textId="m13" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m14" textId="m14" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m15" textId="m15" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m16" textId="m16" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m17" textId="m17" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m18" textId="m18" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m19" textId="m19" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="m20" textId="m20" :textMap="charaDetail.msg" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="V413" textId="V413" />
                </div>
                <div class="d-flex flex-wrap my-1">
                  <SoundPlayButton :charaId="props.targetId" voiceType="入手時" imgSuffix="word.png" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="聖典覚醒１" imgSuffix="star1.png" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="聖典覚醒２" imgSuffix="star2.png" />
                </div>
                <div class="d-flex flex-wrap my-1">
                  <SoundPlayButton :charaId="props.targetId" voiceType="聖典覚醒３" imgSuffix="star3.png" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="聖典覚醒４" imgSuffix="star4.png" />
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
