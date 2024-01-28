<script setup lang="ts">
import { reactive, ref } from 'vue';
import * as browser from "webextension-polyfill";
import JSZip from 'jszip';
import { AllStories, BattleEvent, Section, StoryElement } from "@/@types";
import { downloadStory, downloadBg, downloadSectionImage, fillStoryData } from '@/repository/downloadStory';
import { getEnableStidMap, getSection, getStory } from '@/repository/downloadEventStory';

let status = ref("");
let workingSectionId = ref("");
const state = reactive({
  section: await getSection(),
  stories: await browser.runtime.sendMessage({ type: "getStories" }) as AllStories,
  sectionEventIdMap:
    new Map(
      Object.entries(await browser.runtime.sendMessage({ type: "getBattleEvent" }) as BattleEvent)
        .map(([k, v]) => [Object.entries(v.dungeons)[0][1].story_section, v.event_id]))
})

const enableStidMap = await getEnableStidMap();

const download = async (section: Section) => {
  status.value = "開始中…";
  workingSectionId.value = section.section_id;

  const zip = new JSZip();
  const sectionDir = zip.folder(section.name);
  if (!sectionDir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // ストーリー
  status.value = "ストーリーデータのダウンロード中…";
  const stories = await getStory(section.section_id);
  const promises = new Array<Promise<Response>>();
  const storyElements = new Array<StoryElement>();
  const filledStories = await fillStoryData(stories, enableStidMap);
  for await (const s of filledStories) {
    await downloadStory(sectionDir, s, section);
    storyElements.push(...s.elements);
    promises.push(fetch(`https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${section.section_id}_${section.name}_${s.st_id}_${s.storyId}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      credentials: 'same-origin'
    }));
  }
  await downloadBg(sectionDir, storyElements);
  await downloadSectionImage(sectionDir, section);
  // イベントロゴ、背景、BGM
  if (state.sectionEventIdMap.has(section.section_id)) {
    const eventId = state.sectionEventIdMap.get(section.section_id);
    const rLogo = await fetch(`https://ancl.jp/img/game/asset/event/${eventId}/logo.png`);
    if (rLogo.ok) sectionDir.file('logo.png', rLogo.blob());
    const rBgm = await fetch(`https://ancl.jp/img/game/asset/event/${eventId}/bgm.m4a`);
    if (rBgm.ok) sectionDir.file('bgm.m4a', rBgm.blob());
    const rBg = await fetch(`https://ancl.jp/img/game/asset/event/${eventId}/bg.jpg`);
    if (rBg.ok) sectionDir.file('bg.jpg', rBg.blob());
  }

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_イベントストーリー_${section.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(promises);
  status.value = "";
  workingSectionId.value = "";
}
</script>

<template>
  <v-card>
    <v-card-title primary-title>機能</v-card-title>
    <v-card-text class="py-0 pl-10">
      <ul>
        <li>
          イベントストーリーのダウンロード
          <ul>
            <li>解放されていないストーリーは情報が取れないのでダウンロード不可</li>
            <li>ストーリー解放したらエンクリの画面を再読み込みしろ</li>
          </ul>
        </li>
      </ul>
    </v-card-text>
  </v-card>
  <!-- リスト -->
  <v-list three-line v-if="state.section">
    <v-list-item v-for="item of state.section">
      <v-list-item-avatar :style="{ height: '81px', width: '144px' }">
        <v-img :src="`https://ancl.jp/img/game/event/section/${item.section_id}.jpg`"></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`${item.name} : ${item.section_id}`"></v-list-item-title>
        <v-list-item-subtitle>
          <ul>
            <template v-for="story of state.stories?.event?.story[item.section_id]">
              <li v-if="enableStidMap.has(story.st_id)">{{ story.st_id }} : {{ story.name }}</li>
              <li v-if="!enableStidMap.has(story.st_id)">
                <s>{{ story.st_id }} : {{ story.name }}</s>
              </li>
            </template>
          </ul>
        </v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-action class="ml-auto mr-5">
        <v-btn
          @click="download(item)"
          color="success"
          :disabled="status !== ''"
        >{{ workingSectionId === item.section_id ? status : 'ダウンロード' }}</v-btn>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>