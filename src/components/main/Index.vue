<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import * as browser from "webextension-polyfill";
import JSZip from 'jszip';
import dayjs from 'dayjs';
import { Characters, AllStories, AdditionalStory, Character } from "@/@types";
import { downloadCharacter } from '@/repository/downloadCharacter';
import { getCharacterStory, getEnableStidMap } from '@/repository/downloadCharaStory';
import { downloadStory, fillStoryData } from '@/repository/downloadStory';

type DownloadHistory = { id: string, date: string }

const search = ref("");
const additional = ref("");
const loadAdditionalChara = async () => {
  const charaList = additional.value.split("\n");
  if (charaList.length <= 1) return;
  const data = charaList.map(x => {
    const s = x.split("_");
    return {
      charaId: s[0],
      charaName: s[1],
      stid: Number(s[2]),
      storyId: s[3]
    } as AdditionalStory
  });
  await browser.runtime.sendMessage({ type: "setAdditionalStories", data });
  enableStidMap = await getEnableStidMap();
  search.value = "";
}

let status = ref("");
let workingCharaId = ref("");
const key_downloadHistory = "downloadHistory";
const downloadHistory: Array<DownloadHistory> = reactive(JSON.parse(localStorage.getItem(key_downloadHistory) ?? "[]"));
const state = reactive({
  stories: await browser.runtime.sendMessage({ type: "getStories" }) as AllStories,
  characters: await browser.runtime.sendMessage({ type: "getCharacters" }) as Characters
})

const items = computed(() => {
  const s = search.value.replace(/[\u3041-\u3096]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 0x60));
  return Object.values(state.characters?.chara_data ?? {})
    .filter(x => x.name.includes(s) || x.kana.includes(s))
    .filter(x => x.chara_id !== "000000");
});

let enableStidMap = await getEnableStidMap();

const download = async (character: Character) => {
  status.value = "開始中…";
  workingCharaId.value = character.chara_id;

  const zip = new JSZip();
  const charaDir = zip.folder(character.name);
  if (!charaDir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // 基本
  status.value = "基本情報のダウンロード中…";
  await downloadCharacter(charaDir, character, document.createElement("canvas"));

  // スケルトン
  {
    const skeletonDir = charaDir.folder("skeleton");
    const types = ["spine_n", "spine_w"];
    const extensions = [".atlas", ".json", ".png"];
    for (const t of types) {
      const d = skeletonDir?.folder(t);
      for (const e of extensions) {
        const r = await fetch(`https://ancl.jp/img/game/chara/${character.chara_id}/${t}/skeleton${e}`);
        if (!r.ok) continue;
        d?.file(`skeleton${e}`, r.blob());
      }
    }
  }

  // ストーリー
  status.value = "ストーリーデータのダウンロード中…";
  const stories = await getCharacterStory(character);
  const filledStories = await fillStoryData(stories, enableStidMap);
  const promises = new Array<Promise<Response>>();
  for await (const s of filledStories) {
    await downloadStory(charaDir, s, character);
    promises.push(fetch(`https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${character.chara_id}_${character.name}_${s.st_id}_${s.storyId}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      credentials: 'same-origin'
    }));
  }

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_${character.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(promises);
  downloadHistory.push({ id: character.chara_id, date: dayjs().format('YYYY/M/D HH:mm') });
  localStorage.setItem(key_downloadHistory, JSON.stringify(downloadHistory));

  status.value = "";
  workingCharaId.value = "";
}
</script>

<template>
  <v-card v-if="!state.characters?.chara_data || !state.stories?.chara?.story">
    <v-card-title primary-title>🚨「ゲームスタート」してから再度開いてくださいますか</v-card-title>
  </v-card>
  <v-card>
    <v-card-title primary-title>機能</v-card-title>
    <v-card-text class="py-0 pl-10">
      <ul>
        <li>キャラクターの基本情報ダウンロード</li>
        <li>
          キャラクターのストーリーダウンロード
          <ul>
            <li>好感度が足りていても解放されていなければならん</li>
            <li>ストーリー解放したらエンクリの画面を再読み込みしろ</li>
          </ul>
        </li>
      </ul>
    </v-card-text>
  </v-card>
  <!-- 検索 -->
  <v-text-field v-model="search" label="キャラ名検索" outlined dense class="ma-3" />
  <template v-if="search === 'opensesame'">
    <v-textarea v-model="additional"></v-textarea>
    <v-btn @click="loadAdditionalChara">ロード</v-btn>
  </template>
  <!-- リスト -->
  <v-list three-line v-if="state.characters?.chara_data && state.stories?.chara?.story">
    <v-list-item v-for="item of items">
      <v-list-item-avatar :style="{ height: '90px', width: '90px' }">
        <v-img
          :src="`https://ancl.jp/img/game/chara/${item.chara_id}/graphic/${item.chara_id}_ss.png`"
        ></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`${item.name} : ${item.chara_id}`"></v-list-item-title>
        <v-list-item-subtitle>
          <ul>
            <template v-for="story of state.stories?.chara?.story[item.chara_id]">
              <li v-if="enableStidMap.has(story.st_id)">{{ story.st_id }} : {{ story.name }}</li>
              <li v-if="!enableStidMap.has(story.st_id)">
                <s>{{ story.st_id }} : {{ story.name }}</s>
              </li>
            </template>
          </ul>
        </v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-action class="ml-auto mr-5 d-flex flex-column align-end">
        <v-btn
          @click="download(item)"
          color="success"
          :disabled="status !== ''"
        >{{ workingCharaId === item.chara_id ? status : 'ダウンロード' }}</v-btn>
        <p class="blue">{{ downloadHistory.find(x => x.id === item.chara_id)?.date ?? '-' }}</p>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>