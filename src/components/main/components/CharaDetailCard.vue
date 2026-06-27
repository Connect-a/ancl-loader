<script setup lang="ts">
import { mdiMagnifyPlusOutline } from '@mdi/js';
import { computed, reactive } from 'vue';
import CharaBattleAttributes from './CharaBattleAttributes.vue';
import CharaStatusChips from './CharaStatusChips.vue';
import SoundPlayButton from './SoundPlayButton.vue';
import DownloadButton from '@/components/DownloadButton.vue';
import { setDownloadMessage } from '@/composables/useDownloadAction';
import { statModeLabels, type CharaListItem, type StatMode } from '@/constants/characterAttributes';
import { charaImage } from '@/repository/assetMap';
import { downloadCharacter } from '@/repository/download';

const props = defineProps<{
  items: Array<CharaListItem>;
  targetId: string;
  prevCharaId: string | null;
  nextCharaId: string | null;
}>();

const statMode = defineModel<StatMode>('statMode', { required: true });

const state = reactive({
  showLargeImage: false,
  selectedFaceImageSuffix: 'st_01.png',
});

const emit = defineEmits(['clickEsc', 'clickProfileKeyword', 'clickKeyword', 'changeTargetId']);

const charaDetail = computed(() => props.items.find((x) => x.chara_id === props.targetId) ?? ({ profile: {}, sortTarget: {} } as CharaListItem));

// キーワード検索には本名部のみ送るため括弧部と分割
const charaName = computed(() => {
  const name = charaDetail.value.name ?? '';
  const i = name.indexOf('(');
  return i >= 0 ? { base: name.slice(0, i), paren: name.slice(i) } : { base: name, paren: '' };
});

const battleStats = computed(() => [
  { key: 'hp', label: 'HP', value: charaDetail.value.sortTarget.hp },
  { key: 'atk', label: 'ATK', value: charaDetail.value.sortTarget.atk },
  { key: 'cri', label: 'CRI', value: charaDetail.value.sortTarget.cri },
  { key: 'def', label: 'DEF', value: charaDetail.value.sortTarget.def },
  { key: 'res', label: 'RES', value: charaDetail.value.sortTarget.res },
  { key: 'agi', label: 'AGI', value: charaDetail.value.sortTarget.agi },
  { key: 'pos', label: 'POS', value: charaDetail.value.sortTarget.pos },
]);

const changeChara = (charaId: string | null) => {
  if (!charaId) return;
  emit('changeTargetId', charaId);
};

const downloadChara = async () => {
  if (!charaDetail.value.chara_id) return;
  setDownloadMessage('ダウンロード中…');
  await downloadCharacter(charaDetail.value);
};
</script>

<template>
  <v-card
    @keydown.left.prevent="changeChara(props.prevCharaId)"
    @keydown.right.prevent="changeChara(props.nextCharaId)"
    class="focusable"
    tabindex="-1"
  >
    <v-card-title>
      <v-toolbar>
        <v-toolbar-title class="d-none d-sm-flex">
          <span class="text-cyan text-decoration-underline cursor-pointer" @click="emit('clickKeyword', charaName.base)">{{ charaName.base }}</span>
          <span v-if="charaName.paren">{{ charaName.paren }}</span>
          <span>{{ `：${charaDetail.chara_id}` }}</span>
        </v-toolbar-title>
        <v-spacer />
        <DownloadButton class="mx-3" :id="charaDetail.chara_id" requires-token :task="downloadChara" />
        <v-btn variant="outlined" @click="changeChara(props.prevCharaId)" :disabled="!props.prevCharaId" title="前のキャラ">＜＜</v-btn>
        <v-btn variant="outlined" @click="changeChara(props.nextCharaId)" :disabled="!props.nextCharaId" title="次のキャラ">＞＞</v-btn>
        <v-btn variant="outlined" @click="emit('clickEsc')" title="閉じる" class="mx-3">ESC</v-btn>
      </v-toolbar>
    </v-card-title>
    <v-card-text style="font-size: medium">
      <v-row>
        <v-col :order="state.showLargeImage ? 3 : 1" cols="12" :sm="state.showLargeImage ? 12 : 4" :lg="state.showLargeImage ? 12 : 3">
          <v-img
            v-if="!state.showLargeImage"
            :src="charaImage.webUrlOf(props.targetId, 'gr_t.jpg')"
            :alt="`${charaDetail.name}`"
            @click="state.showLargeImage = true"
            class="rounded cursor-pointer"
          >
            <div class="d-flex align-end justify-end fill-height pa-2">
              <v-icon :icon="mdiMagnifyPlusOutline" size="x-large" color="green" class="bg-white rounded-circle pa-1" />
            </div>
          </v-img>
          <v-img
            v-if="state.showLargeImage"
            :src="charaImage.webUrlOf(props.targetId, 'gr_it.jpg')"
            :alt="`${charaDetail.name}`"
            @click="state.showLargeImage = false"
            class="rounded cursor-pointer"
          />
          <div v-if="state.showLargeImage" class="d-flex align-center ga-2 mt-5">
            <v-label text="表情" class="text-h6 text-medium-emphasis" />
            <v-btn-toggle v-model="state.selectedFaceImageSuffix" mandatory color="primary">
              <v-btn value="st_01.png">01</v-btn>
              <v-btn value="st_02.png">02</v-btn>
              <v-btn value="st_03.png">03</v-btn>
              <v-btn value="st_04.png">04</v-btn>
              <v-btn value="st_05.png">05</v-btn>
              <v-btn value="st_06.png">06</v-btn>
              <v-btn value="st_07.png">07</v-btn>
            </v-btn-toggle>
          </div>
          <!-- 立ち絵（体+顔をCSS合成） -->
          <v-img v-if="state.showLargeImage" :src="charaImage.webUrlOf(props.targetId, 'st_99.png')">
            <img :src="charaImage.webUrlOf(props.targetId, state.selectedFaceImageSuffix)" class="position-absolute top-0 left-0 w-100 h-100" />
          </v-img>
        </v-col>
        <v-col :order="state.showLargeImage ? 1 : 2" cols="12" sm="8" :md="state.showLargeImage ? 5 : 3" lg="3">
          <CharaStatusChips :charaId="props.targetId" class="mb-1" />
          <CharaBattleAttributes :chara="charaDetail" />
          <li class="d-flex d-sm-none">
            <span class="text-cyan text-decoration-underline cursor-pointer" @click="emit('clickKeyword', charaName.base)">{{ charaName.base }}</span>
            <span v-if="charaName.paren">{{ charaName.paren }}</span>
            <span>{{ `：${charaDetail.chara_id}` }}</span>
          </li>
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
            <li>
              誕生日：<span
                class="text-cyan text-decoration-underline cursor-pointer"
                @click="emit('clickProfileKeyword', charaDetail.profile?.birth?.split('月')[0] + '月')"
                >{{ charaDetail.profile?.birth?.split('月')[0] }}月</span
              >{{ charaDetail.profile?.birth?.split('月')[1] }}
            </li>
            <li>身長：{{ charaDetail.profile?.height }}</li>
            <li>体重：{{ charaDetail.profile?.weight }}</li>
            <li>サイズ：{{ charaDetail.profile?.size }}</li>
          </ul>
        </v-col>
        <v-col :order="state.showLargeImage ? 2 : 3" cols="12" :md="state.showLargeImage ? 7 : 5" lg="6">
          <v-radio-group v-model="statMode" inline density="compact" hide-details class="mb-2">
            <v-radio v-for="m in statModeLabels" :key="m.value" :label="m.label" :value="m.value" />
          </v-radio-group>
          <div class="d-flex flex-wrap ga-1 mb-2">
            <v-chip v-for="s in battleStats" :key="s.key" size="small" variant="tonal" label>
              <span class="text-medium-emphasis mr-1">{{ s.label }}</span>
              <span class="font-weight-bold">{{ s.value }}</span>
            </v-chip>
          </div>
          <ul>
            <li>{{ charaDetail.profile?.flavor }}</li>
            <li>{{ charaDetail.profile?.details }}</li>
          </ul>
        </v-col>
        <v-col order="4" cols="12">
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
                  <SoundPlayButton
                    v-for="i in 20"
                    :key="`m${i}`"
                    :charaId="props.targetId"
                    :voiceType="`m${i}`"
                    :textId="`m${i}`"
                    :textMap="charaDetail.msg"
                  />
                  <SoundPlayButton :charaId="props.targetId" voiceType="V413" textId="V413" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="イベントミッション" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="イベントステージ" />
                  <SoundPlayButton :charaId="props.targetId" voiceType="イベントトップ" />
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
