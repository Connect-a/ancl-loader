<script setup lang="ts">
import { ref } from 'vue';
import * as browser from "webextension-polyfill";
import JSZip from 'jszip';
import dayjs from 'dayjs';
import { downloadCharacter, downloadCharacterSkeleton } from '@/repository/downloadOtherCharacters';
import chara from "@/repository/characters.json";
import charaSkeletons from "@/repository/characterSkeletons.json";
import images from "@/repository/images.json";
import { Enemy, Radio } from '@/@types';

let status = ref("");
let workingId = ref("");

const characters = (chara as Array<{ id: string, name: string }>)
  .concat(charaSkeletons as Array<{ id: string, name: string }>)
  .sort((a, b) => a.id.localeCompare(b.id));

const downloadCharacters = async () => {
  status.value = "開始中…";
  workingId.value = "characters";

  const zip = new JSZip();
  const charaDir = zip.folder("キャラクター");
  if (!charaDir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // 基本
  status.value = "基本情報のダウンロード中…";
  const createCanvas = () => document.createElement("canvas");
  await downloadCharacter(charaDir, createCanvas);
  await downloadCharacterSkeleton(charaDir);

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_ストーリーキャラクター.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  status.value = "";
  workingId.value = "";
}

const downloadEnemies = async () => {
  status.value = "開始中…";
  workingId.value = "enemies";

  const zip = new JSZip();
  const dir = zip.folder("エネミー");
  if (!dir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  const enemies = await browser.runtime.sendMessage({ type: "getEnemy" }) as Enemy;

  for (const [id, enemy] of Object.entries(enemies)) {
    const images = [
      { name: "icon.png", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_icon.png`) },
      { name: "pc.png", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_pc.png`) },
      { name: "ok.png", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_ok.png`) },
    ]
    const skeletons = [
      { name: "skeleton.json", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.json`) },
      { name: "skeleton.png", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.png`) },
      { name: "skeleton.atlas", res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.atlas`) },
    ]

    const enemyDir = dir.folder(`${enemy.section_id}_${enemy.name}`);
    enemyDir?.file("meta.json", JSON.stringify(enemy));
    const imageDir = enemyDir?.folder("image");
    for (const image of images) {
      const r = await image.res;
      if (!r.ok) continue;
      imageDir?.file(image.name, r.blob());
    }
    const skeletonDir = enemyDir?.folder("skeleton");
    for (const skeleton of skeletons) {
      const r = await skeleton.res;
      if (!r.ok) continue;
      skeletonDir?.file(skeleton.name, r.blob());
    }
  }

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_エネミー_${dayjs().format('YYYYMMDD')}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  status.value = "";
  workingId.value = "";
}

const downloadRadio = async () => {
  status.value = "開始中…";
  workingId.value = "radio";

  const zip = new JSZip();
  const dir = zip.folder("ラジオ");
  if (!dir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  const radio = await browser.runtime.sendMessage({ type: "getRadio" }) as Radio;

  // 番組表取得
  const getHashCode = (e: any) => Array.from(e ? JSON.stringify(e) : "")
    .reduce((e, t) => ((e << 5) - e + t.charCodeAt(0) | 0), 0);
  const query = `?h=${(new Date).getTime()}${getHashCode(radio.radio_guide)}`;
  {
    const r = await fetch(`https://ancl.jp/img/game/asset/radio/list.jpg${query}`);
    if (r.ok) dir.file("_番組表.jpg", r.blob());
  }

  //
  const programs = Object.entries(radio.radio_guide)
    .flatMap(([id, p]) => p.list.map(x => ({
      name: `${p.start.replace(":", "")}_${p.name}_${x}`,
      res: fetch(`https://ancl.jp/img/game/asset/radio/pg/${x}.m4a`)
    })));
  const promises = new Array<Promise<Response>>();
  for (const p of programs) {
    promises.push(fetch(`https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=radio_${p.name}_${query.split("=")[1]}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      credentials: 'same-origin'
    }));
    const r = await p.res;
    if (!r.ok) continue;
    dir.file(`${p.name}.m4a`, r.blob());
  }

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_ラジオ_${dayjs().format('YYYYMMDD')}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(promises);
  status.value = "";
  workingId.value = "";
}

// 使ってない
const downloadImages = async () => {
  status.value = "開始中…";
  workingId.value = "images";

  const zip = new JSZip();
  const imagesDir = zip.folder("画像集");
  if (!imagesDir) {
    status.value = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  status.value = "ダウンロード中…";
  for (const i of images) {
    const r = await fetch(i.url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      credentials: 'same-origin'
    });
    if (r.ok) imagesDir.file(i.name, r.blob());
  }

  // zipアーカイブ
  status.value = "アーカイブなう…（時間かかるよ）";
  const blob = await zip.generateAsync({ type: "blob" });

  status.value = "リンク生成中…";
  const a = document.createElement('a');
  a.download = `エンクリ_画像集.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  status.value = "";
  workingId.value = "";
}
</script>

<template>
  <v-card>
    <v-card-title primary-title>機能</v-card-title>
    <v-card-text class="py-0 pl-10">
      <ul>
        <li>ストーリーキャラクターのダウンロード</li>
        <li>敵キャラクターのダウンロード</li>
        <li>ラジオのダウンロード</li>
        <li>画像集（適当）（求情報）</li>
      </ul>
    </v-card-text>
  </v-card>
  <!-- リスト -->
  <v-list three-line>
    <!-- ストーリーキャラ -->
    <v-list-item>
      <v-list-item-avatar :style="{ height: '90px', width: '90px' }">
        <v-img src="https://ancl.jp/img/game/chara/N01JIW/graphic/N01JIW_ss.png"></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`ストーリーキャラ`"></v-list-item-title>
        <v-list-item-subtitle>
          <ul>
            <li v-for="c of characters">{{ c.id }}：{{ c.name }}</li>
          </ul>
        </v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-action class="ml-auto mr-5 d-flex flex-column align-end">
        <v-btn
          @click="downloadCharacters"
          color="success"
          :disabled="status !== ''"
        >{{ workingId === 'characters' ? status : 'ダウンロード' }}</v-btn>
      </v-list-item-action>
    </v-list-item>
    <!-- エネミー -->
    <v-list-item>
      <v-list-item-avatar :style="{ height: '90px', width: '90px' }">
        <v-img src="https://ancl.jp/img/game/monster/W001QZ/graphic/W001QZ_icon.png"></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`エネミー`"></v-list-item-title>
      </v-list-item-content>

      <v-list-item-action class="ml-auto mr-5 d-flex flex-column align-end">
        <v-btn
          @click="downloadEnemies"
          color="success"
          :disabled="status !== ''"
        >{{ workingId === 'enemies' ? status : 'ダウンロード' }}</v-btn>
      </v-list-item-action>
    </v-list-item>
    <!-- ラジオ -->
    <v-list-item>
      <v-list-item-avatar :style="{ height: '90px', width: '90px' }">
        <v-img
          src="https://ancl.jp/game/client/pc/res/raw-assets/d9/d9506b81-d0a5-48c6-89cc-44e0638a17b9.78a49.png"
        ></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`ラジオ`"></v-list-item-title>
        <v-list-item-subtitle>番組表＆ラジオ</v-list-item-subtitle>
      </v-list-item-content>

      <v-list-item-action class="ml-auto mr-5 d-flex flex-column align-end">
        <v-btn
          @click="downloadRadio"
          color="success"
          :disabled="status !== ''"
        >{{ workingId === 'radio' ? status : 'ダウンロード' }}</v-btn>
      </v-list-item-action>
    </v-list-item>
    <!-- 画像集 -->
    <v-list-item>
      <v-list-item-avatar :style="{ height: '90px', width: '90px' }">
        <v-img src="https://ancl.jp/img/game/chara/N01JIW/graphic/N01JIW_sd_23.png"></v-img>
      </v-list-item-avatar>

      <v-list-item-content class="ml-5">
        <v-list-item-title v-text="`画像集`"></v-list-item-title>
        <v-list-item-subtitle class="bg-grey">
          <ul>
            <li v-for="i of images">
              <a :href="i.url" target="_brank">{{ i.name }}</a>
            </li>
          </ul>
        </v-list-item-subtitle>
      </v-list-item-content>

      <!-- <v-list-item-action class="ml-auto mr-5 d-flex flex-column align-end">
        <v-btn
          @click="downloadImages"
          color="success"
          :disabled="status !== ''"
        >{{ workingId === 'images' ? status : 'ダウンロード' }}</v-btn>
      </v-list-item-action>-->
    </v-list-item>
  </v-list>
</template>