<script setup lang="ts">
import { reactive } from 'vue';
import { ZipDir } from '@/scripts/zip';
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

  const zip = new ZipDir('キャラクター');

  // 基本
  state.loadStatusMessage = '基本情報のダウンロード中…';
  const createCanvas = () => document.createElement('canvas');
  await downloadCharacter(zip, createCanvas);
  await downloadCharacterSkeleton(zip);

  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.end();

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = 'エンクリ_ストーリーキャラクター.zip';
  a.href = URL.createObjectURL(blob);
  a.click();

  state.loadStatusMessage = '';
  state.workingId = '';
};

const downloadEnemies = async () => {
  const tasks = new Array<Promise<unknown>>();
  state.loadStatusMessage = '開始中…';
  state.workingId = 'enemies';

  const zip = new ZipDir('エネミー');

  if (!mainStore.enemy) {
    state.loadStatusMessage = '【例外】エネミーの取得失敗した。';
    throw '【例外】エネミーの取得失敗した。';
  }

  for (const enemy of Object.values(mainStore.enemy)) {
    const enemyDir = zip.folder(`${enemy.section_id}_${enemy.name}`);
    tasks.push(enemyDir?.fileAsync('meta.json', JSON.stringify(enemy)));
    const imageDir = enemyDir.folder('image');
    tasks.push(
      imageDir.fileFromUrlAsync(
        'icon.png',
        `https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_icon.png`,
      ),
    );
    tasks.push(
      imageDir.fileFromUrlAsync(
        'pc.png',
        `https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_pc.png`,
      ),
    );
    tasks.push(
      imageDir.fileFromUrlAsync(
        'ok.png',
        `https://ancl.jp/img/game/monster/${enemy.img}/graphic/${enemy.img}_ok.png`,
      ),
    );
    const skeletonDir = enemyDir.folder('skeleton');
    tasks.push(
      skeletonDir.fileFromUrlAsync(
        'skeleton.json',
        `https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.json`,
      ),
    );
    tasks.push(
      skeletonDir.fileFromUrlAsync(
        'skeleton.png',
        `https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.png`,
      ),
    );
    tasks.push(
      skeletonDir.fileFromUrlAsync(
        'skeleton.atlas',
        `https://ancl.jp/img/game/monster/${enemy.img}/spine/skeleton.atlas`,
      ),
    );
  }

  await Promise.all(tasks);
  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.end();

  state.loadStatusMessage = 'リンク生成中…';
  const a = document.createElement('a');
  a.download = `エンクリ_エネミー_${dayjs().format('YYYYMMDD')}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  state.loadStatusMessage = '';
  state.workingId = '';
};

const downloadRadio = async () => {
  const tasks = new Array<Promise<unknown>>();
  state.loadStatusMessage = '開始中…';
  state.workingId = 'radio';

  const zip = new ZipDir('ラジオ');

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
  tasks.push(
    zip.fileFromUrlAsync('_番組表.jpg', `https://ancl.jp/img/game/asset/radio/list.jpg${query}`),
  );

  const radioLoggingTasks = new Array<Promise<Response>>();
  for (const guide of Object.values(mainStore.radio.radio_guide)) {
    for (const x of guide.list) {
      const name = `${guide.start.replace(':', '')}_${guide.name}_${x}`;
      tasks.push(
        zip.fileFromUrlAsync(`${name}.m4a`, `https://ancl.jp/img/game/asset/radio/pg/${x}.m4a`),
      );
      radioLoggingTasks.push(
        fetch(
          `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${encodeURIComponent(
            `radio_${name}_${query.split('=')[1]}`,
          )}?code=NYaFk80zhl5aa/acKxu96/LIXtutkeTC/he7XG8fS73GidPwKpZzQw==`,
          {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
            credentials: 'same-origin',
          },
        ),
      );
    }
  }

  await Promise.all(tasks);
  // zipアーカイブ
  state.loadStatusMessage = 'アーカイブなう…（時間かかるよ）';
  const blob = await zip.end();

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
            src="https://ancl.jp/game/client/pc/assets/resources/native/d9/d9506b81-d0a5-48c6-89cc-44e0638a17b9.78a49.png"
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
