<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useMainStore } from '@/store';
import { useAdditionalDataStore } from '@/store/additionalDataStore';
import { downloadChapter, fetchChapterId } from '@/repository/downloadAsmr';
import type { AsmrSection } from '@/@types';
import JSZip from 'jszip';

const mainStore = useMainStore();
const additionalDataStore = useAdditionalDataStore();

const state = reactive({
  loadStatusMessage: '',
  workingSectionId: '',
});

const enableSectionIdSet = computed(
  () =>
    new Set(
      (mainStore.initData?.result.player_data.voice ?? []).concat(
        additionalChapter.map((x) => x.section_id),
      ),
    ),
);
const additionalChapter = (additionalDataStore.voiceAdditionalData ?? []).map((x) => ({
  type: x.type,
  section_id: x.charaName,
  ch_id: x.stid,
  chapterId: x.storyId,
}));

//voice_${section.section_id}_${chapter.ch_id}_${chapterId}

const download = async (section: AsmrSection) => {
  state.loadStatusMessage = '開始中…';
  state.workingSectionId = section.section_id;

  const zip = new JSZip();
  const sectionDir = zip.folder(section.name);
  if (!sectionDir) {
    state.loadStatusMessage = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // セクション
  state.loadStatusMessage = 'セクションのダウンロード中…';
  sectionDir.file('source.json', JSON.stringify(section));
  const imageRes = await fetch(`https://ancl.jp/img/game/event/section/${section.img}.jpg`);
  sectionDir.file(`${section.img}.jpg`, imageRes.arrayBuffer());

  // チャプター
  const chapterIdLoggingTasks = new Array<Promise<Response>>();
  if (enableSectionIdSet.value.has(section.section_id)) {
    state.loadStatusMessage = 'チャプターのダウンロード中…';

    const chapters = mainStore.voice?.all.chapter[section.section_id] ?? [];
    for (const chapter of chapters) {
      const chapterId =
        additionalChapter.find((x) => x.ch_id === chapter.ch_id)?.chapterId ??
        (await fetchChapterId(chapter.ch_id));
      if (!chapterId) continue;
      chapterIdLoggingTasks.push(
        fetch(
          `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=voice_${section.section_id}_${chapter.ch_id}_${chapterId}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`,
          {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
            credentials: 'same-origin',
          },
        ),
      );

      await downloadChapter(sectionDir, { ...chapter, chapterId });
    }
  }

  // サンプル
  if (section.sample_id) {
    state.loadStatusMessage = 'サンプルのダウンロード中…';
    await downloadChapter(sectionDir, {
      ch_id: 0,
      chapterId: section.sample_id,
      name: 'サンプル',
      order: 0,
    });
  }

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.generateAsync({ type: 'blob' });

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_ASMR_${section.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(chapterIdLoggingTasks);

  state.loadStatusMessage = '';
  state.workingSectionId = '';
};

const items = computed(() =>
  Object.values(mainStore.voice?.all?.section ?? {})
    .map((x) => ({
      ...x,
      title: `${x.section_id} : ${x.name}`,
      subtitle: x.details,
    }))
    .sort((a, b) => a.section_id.localeCompare(b.section_id)),
);
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title primary-title>機能</v-card-title>
          <v-card-text>
            <ul>
              <li>
                ASMRのダウンロード
                <ul>
                  <li>解放されていないASMRは情報が取れないためサンプル等のみダウンロード可能</li>
                  <li>ASMRを解放したらヘッダーのボタンから再読み込み</li>
                </ul>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row dense>
      <v-col>
        <!-- リスト -->
        <v-list v-if="mainStore.voice" :items="items" item-props>
          <template v-slot:prepend="{ item }">
            <v-img
              width="256"
              class="mx-2"
              :src="`https://ancl.jp/img/game/event/section/${item.img}.jpg`"
            />
          </template>
          <template v-slot:subtitle="{ item }">
            <ul>
              <li
                v-for="chapter of mainStore.voice?.all.chapter[item.section_id]"
                :key="chapter.ch_id"
                :style="[
                  enableSectionIdSet.has(item.section_id)
                    ? ''
                    : { 'text-decoration': 'line-through' },
                ]"
              >
                {{ chapter.ch_id }} : {{ chapter.name }}
              </li>
            </ul>
          </template>
          <template v-slot:append="{ item }">
            <v-list-item-action center>
              <v-btn
                @click="download(item)"
                color="success"
                :disabled="state.loadStatusMessage !== ''"
                >{{
                  state.workingSectionId === item.section_id
                    ? state.loadStatusMessage
                    : 'ダウンロード'
                }}</v-btn
              >
            </v-list-item-action>
          </template>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>
