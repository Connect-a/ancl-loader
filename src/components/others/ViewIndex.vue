<script setup lang="ts">
import { reactive } from 'vue';
import JSZip from 'jszip';
import dayjs from 'dayjs';
import { downloadCharacter, downloadCharacterSkeleton } from '@/repository/downloadOtherCharacters';
import chara from '@/repository/characters.json';
import charaSkeletons from '@/repository/characterSkeletons.json';
import images from '@/repository/images.json';
import { useMainStore } from '@/store';

const mainStore = useMainStore();

const state = reactive({
  loadStatusMessage: '',
  workingId: '',
});

const characters = (chara as Array<{ id: string; name: string }>)
  .concat(charaSkeletons as Array<{ id: string; name: string }>)
  .sort((a, b) => a.id.localeCompare(b.id));

const downloadCharacters = async () => {
  state.loadStatusMessage = '開始中…';
  state.workingId = 'characters';

  const zip = new JSZip();
  const charaDir = zip.folder('キャラクター');
  if (!charaDir) {
    state.loadStatusMessage = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  // 基本
  state.loadStatusMessage = '基本情報のダウンロード中…';
  const createCanvas = () => document.createElement('canvas');
  await downloadCharacter(charaDir, createCanvas);
  await downloadCharacterSkeleton(charaDir);

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.generateAsync({ type: 'blob' });

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = 'エンクリ_ストーリーキャラクター.zip';
  a.href = URL.createObjectURL(blob);
  a.click();

  state.loadStatusMessage = '';
  state.workingId = '';
};

const downloadEnemies = async () => {
  state.loadStatusMessage = '開始中…';
  state.workingId = 'enemies';

  const zip = new JSZip();
  const dir = zip.folder('エネミー');
  if (!dir) {
    state.loadStatusMessage = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  if (!mainStore.enemy) {
    state.loadStatusMessage = '【例外】エネミーの取得失敗した。';
    throw '【例外】エネミーの取得失敗した。';
  }

  for (const enemy of Object.values(mainStore.enemy)) {
    const images = [
      {
        name: 'icon.png',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_icon.png`),
      },
      {
        name: 'pc.png',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_pc.png`),
      },
      {
        name: 'ok.png',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_ok.png`),
      },
    ];
    const skeletons = [
      {
        name: 'skeleton.json',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.json`),
      },
      {
        name: 'skeleton.png',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.png`),
      },
      {
        name: 'skeleton.atlas',
        res: fetch(`https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.atlas`),
      },
    ];

    const enemyDir = dir.folder(`${enemy.section_id}_${enemy.name}`);
    enemyDir?.file('meta.json', JSON.stringify(enemy));
    const imageDir = enemyDir?.folder('image');
    for (const image of images) {
      const r = await image.res;
      if (!r.ok) continue;
      imageDir?.file(image.name, r.blob());
    }
    const skeletonDir = enemyDir?.folder('skeleton');
    for (const skeleton of skeletons) {
      const r = await skeleton.res;
      if (!r.ok) continue;
      skeletonDir?.file(skeleton.name, r.blob());
    }
  }

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.generateAsync({ type: 'blob' });

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_エネミー_${dayjs().format('YYYYMMDD')}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  state.loadStatusMessage = '';
  state.workingId = '';
};

const downloadRadio = async () => {
  state.loadStatusMessage = '開始中…';
  state.workingId = 'radio';

  const zip = new JSZip();
  const dir = zip.folder('ラジオ');
  if (!dir) {
    state.loadStatusMessage = '【例外】なんかディレクトリ作るの失敗した。';
    throw '【例外】なんかディレクトリ作るの失敗した。';
  }

  if (!mainStore.radio) {
    state.loadStatusMessage = '【例外】ラジオの取得失敗した。';
    throw '【例外】ラジオの取得失敗した。';
  }

  // 番組表取得
  const getHashCode = (ee: object) =>
    Array.from(ee ? JSON.stringify(ee) : '').reduce(
      (e, t) => ((e << 5) - e + t.charCodeAt(0)) | 0,
      0,
    );
  const query = `?h=${new Date().getTime()}${getHashCode(mainStore.radio.radio_guide)}`;
  {
    const r = await fetch(`https://ancl.jp/img/game/asset/radio/list.jpg${query}`);
    if (r.ok) dir.file('_番組表.jpg', r.blob());
  }

  //
  const programs = Object.entries(mainStore.radio.radio_guide).flatMap(([_id, p]) =>
    p.list.map((x) => ({
      name: `${p.start.replace(':', '')}_${p.name}_${x}`,
      res: fetch(`https://ancl.jp/img/game/asset/radio/pg/${x}.m4a`),
    })),
  );
  const radioLoggingTasks = new Array<Promise<Response>>();
  for (const p of programs) {
    radioLoggingTasks.push(
      fetch(
        `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=radio_${p.name}_${
          query.split('=')[1]
        }?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`,
        {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          credentials: 'same-origin',
        },
      ),
    );
    const r = await p.res;
    if (!r.ok) continue;
    dir.file(`${p.name}.m4a`, r.blob());
  }

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.generateAsync({ type: 'blob' });

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_ラジオ_${dayjs().format('YYYYMMDD')}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(radioLoggingTasks);
  state.loadStatusMessage = '';
  state.workingId = '';
};
</script>

<template>
  <v-card>
    <v-card-title primary-title>機能</v-card-title>
    <v-card-text>
      <ul>
        <li>ストーリーキャラクターのダウンロード</li>
        <li>敵キャラクターのダウンロード</li>
        <li>ラジオのダウンロード</li>
        <li>画像集（適当）（求情報）</li>
      </ul>
    </v-card-text>
  </v-card>
  <!-- リスト -->
  <v-list>
    <v-list-item title="ストーリーキャラ">
      <template v-slot:prepend>
        <v-avatar size="100" rounded="sm">
          <v-img
            src="https://ancl.jp/img/game/chara/N01JIW/graphic/N01JIW_ss.png"
            alt="ストーリーキャラ"
          />
        </v-avatar>
      </template>
      <v-list-item-subtitle>
        <ul>
          <li v-for="c of characters" :key="c.id">{{ c.id }}：{{ c.name }}</li>
        </ul>
      </v-list-item-subtitle>
      <template v-slot:append>
        <v-btn
          @click="downloadCharacters"
          color="success"
          :disabled="state.loadStatusMessage !== ''"
          >{{ state.workingId === 'characters' ? state.loadStatusMessage : 'ダウンロード' }}</v-btn
        >
      </template>
    </v-list-item>

    <v-list-item title="エネミー">
      <template v-slot:prepend>
        <v-avatar size="100" rounded="sm">
          <v-img
            src="https://ancl.jp/img/game/monster/W001QZ/graphic/W001QZ_icon.png"
            alt="エネミー"
          />
        </v-avatar>
      </template>

      <template v-slot:append>
        <v-btn
          @click="downloadEnemies"
          color="success"
          :disabled="state.loadStatusMessage !== ''"
          >{{ state.workingId === 'enemies' ? state.loadStatusMessage : 'ダウンロード' }}</v-btn
        >
      </template>
    </v-list-item>

    <v-list-item title="ラジオ">
      <template v-slot:prepend>
        <v-avatar size="100" rounded="sm">
          <v-img
            src="https://ancl.jp/game/client/pc/res/raw-assets/d9/d9506b81-d0a5-48c6-89cc-44e0638a17b9.78a49.png"
            alt="番組表＆ラジオ"
          />
        </v-avatar>
      </template>
      <v-list-item-subtitle> 番組表＆ラジオ </v-list-item-subtitle>
      <template v-slot:append>
        <v-btn @click="downloadRadio" color="success" :disabled="state.loadStatusMessage !== ''">{{
          state.workingId === 'radio' ? state.loadStatusMessage : 'ダウンロード'
        }}</v-btn>
      </template>
    </v-list-item>

    <v-list-item title="画像集">
      <template v-slot:prepend>
        <v-avatar size="100" rounded="sm">
          <v-img
            src="https://ancl.jp/img/game/chara/N01JIW/graphic/N01JIW_sd_23.png"
            alt="画像集"
          />
        </v-avatar>
      </template>
      <v-list-item-subtitle>
        <ul>
          <li v-for="i of images" :key="i.name">
            <a :href="i.url" target="_brank">{{ i.name }}</a>
          </li>
        </ul>
      </v-list-item-subtitle>
    </v-list-item>
  </v-list>
</template>
