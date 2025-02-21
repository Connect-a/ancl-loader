<script setup lang="ts">
import { computed } from 'vue';
import voice from '@/repository/voice.json';
import molabLeft from '@/repository/molab_left.json';
import { mdiPlayCircle } from '@mdi/js';

const voiceMap = new Map(voice.map((x) => [x.type as string, x.id as string]));
voiceMap.set('V413', 'V413');

const props = defineProps<{
  charaId: string;
  voiceType: string;
  textId?: string;
  textMap?: Record<string, string>;
  imgSuffix?: string;
}>();

const combinedTextMap = computed(() => ({
  ...props.textMap,
  ...({ V413: molabLeft.find((x) => x.id === props.charaId)?.text ?? '-' } as Record<string, string>),
}));

const playbackVoice = async (charaId: string, voiceType: string) => {
  const audio = new Audio(`https://ancl.jp/img/game/chara/${charaId}/voice/${voiceMap.get(voiceType)}.m4a`);
  audio.onended = audio.remove;
  audio.onerror = (e) => {
    window.alert(`ボイスの再生に失敗しました。ボイスが存在していない可能性があります。\ncode：${audio.error?.code}（${audio.error?.message}）`);
    console.log({ e });
  };
  audio.oncanplay = audio.play;
};
</script>
<template>
  <v-btn
    v-if="(!props.imgSuffix && !props.textId) || (!props.imgSuffix && props.textId && combinedTextMap[props.textId])"
    :prepend-icon="mdiPlayCircle"
    variant="outlined"
    @click="playbackVoice(props.charaId, props.voiceType)"
  >
    <template v-if="props.textId">{{ props.textId }}：{{ combinedTextMap[props.textId] }}</template>
    <template v-if="!props.textId">{{ props.voiceType }}</template>
  </v-btn>

  <v-img
    v-if="props.imgSuffix"
    class="border-sm rounded cursor-pointer"
    style="border-color: white !important; height: 3em"
    @click="playbackVoice(props.charaId, props.voiceType)"
    :src="`https://ancl.jp/img/game/chara/${props.charaId}/graphic/${props.charaId}_${props.imgSuffix}`"
  />
</template>
