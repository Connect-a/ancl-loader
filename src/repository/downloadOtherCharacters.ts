import type { ZipDir } from '@/scripts/zip';
import { loadCharaImage } from './anclCharaImageLoader';
import characters from './characters.json';
import charaSkeletons from '@/repository/characterSkeletons.json';

type OtherCharacter = {
  id: string;
  name: string;
  hasStandingPicture: boolean;
};

// 画像
const imageSuffixList = [
  'st_01.png',
  'st_02.png',
  'st_03.png',
  'st_04.png',
  'st_05.png',
  'st_06.png',
  'st_07.png',
  'st_99.png',
  'st_s_01.png',
  'st_s_02.png',
  'st_s_03.png',
  'st_s_04.png',
  'st_s_05.png',
  'st_s_06.png',
  'st_s_07.png',
  'st_s_99.png',
];
const sdImageSuffixList = ['ss.png'];
for (let i = 1; i <= 23; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
for (let i = 51; i <= 56; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
// ボイス
// 声 V901からV941
const voiceList = new Array<{ type: string; id: string }>();
for (let i = 1; i <= 41; i++) voiceList.push({ type: '-', id: `V9${String(i).padStart(2, '0')}` });

export const downloadCharacter = async (dir: ZipDir, createCanvas: () => HTMLCanvasElement) => {
  const tasks = new Array<Promise<unknown>>();
  const characterList = characters as Array<OtherCharacter>;
  const charactersFetchResponse = await fetch('https://raw.githubusercontent.com/Connect-a/ancl-loader/master/src/repository/characters.json');
  if (charactersFetchResponse.ok) {
    for (const c of (await charactersFetchResponse.json()) as Array<OtherCharacter>) {
      if (characterList.find((x) => x.id === c.id)) continue;
      characterList.push(c);
    }
  }

  for (const c of characterList) {
    const d = dir.folder(`${c.id}_${c.name}`);
    //
    const imageBase = `https://ancl.jp/img/game/chara/${c.id}/graphic/${c.id}_`;
    const imageDir = d.folder('image');
    if (c.hasStandingPicture) {
      tasks.push(loadCharaImage(imageDir, createCanvas(), imageBase, imageSuffixList.concat(sdImageSuffixList)));
    }
    if (!c.hasStandingPicture) {
      tasks.push(loadCharaImage(imageDir, undefined, imageBase, sdImageSuffixList));
    }
    //
    const voiceDir = d.folder('voice');
    for (const v of voiceList) {
      tasks.push(voiceDir.fileFromUrlAsync(`${v.id}.m4a`, `https://ancl.jp/img/game/chara/${c.id}/voice/${v.id}.m4a`));
    }
  }

  await Promise.all(tasks);

  for (const c of characterList) {
    // sd_24～sd_26のダウンロードはsd_23の存在が確認できたら。
    const d = dir.folder(`${c.id}_${c.name}`);
    //
    const imageBase = `https://ancl.jp/img/game/chara/${c.id}/graphic/${c.id}_`;
    const imageDir = d.folder('image');

    if (imageDir.has('sd_23.png')) await loadCharaImage(imageDir ?? dir, undefined, imageBase, ['sd_24.png']);
    if (imageDir.has('sd_24.png')) await loadCharaImage(imageDir ?? dir, undefined, imageBase, ['sd_25.png']);
    if (imageDir.has('sd_25.png')) await loadCharaImage(imageDir ?? dir, undefined, imageBase, ['sd_26.png']);
  }
};

export const downloadCharacterSkeleton = async (dir: ZipDir) => {
  const tasks = new Array<Promise<unknown>>();
  for (const c of charaSkeletons) {
    const charaDir = dir.folder(c.name);
    const d = charaDir.folder('skeleton');
    //
    const extensions = ['.atlas', '.json', '.png'];
    for (const e of extensions) {
      tasks.push(d.fileFromUrlAsync(`skeleton${e}`, `${c.path}${e}`));
    }
  }
  await Promise.all(tasks);
};
