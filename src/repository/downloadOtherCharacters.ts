import JSZip from 'jszip';
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
for (let i = 1; i <= 27; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
for (let i = 51; i <= 57; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
// ボイス
// 声 V901からV941
const voiceList = new Array<{ type: string; id: string }>();
for (let i = 1; i <= 41; i++) voiceList.push({ type: '-', id: `V9${String(i).padStart(2, '0')}` });

export const downloadCharacter = async (dir: JSZip, createCanvas: () => HTMLCanvasElement) => {
  const promises = new Array<Promise<void>>();
  const characterList = characters as Array<OtherCharacter>;
  const charactersFetchResponse = await fetch(
    'https://raw.githubusercontent.com/Connect-a/ancl-loader/master/src/repository/characters.json',
  );
  if (charactersFetchResponse.ok) {
    for (const c of (await charactersFetchResponse.json()) as Array<OtherCharacter>) {
      if (characterList.find((x) => x.id === c.id)) continue;
      characterList.push(c);
    }
  }

  for (const c of characterList) {
    const d = dir?.folder(`${c.id}_${c.name}`);
    //
    const imageBase = `https://ancl.jp/img/game/chara/${c.id}/graphic/${c.id}_`;
    const imageDir = d?.folder('image');
    if (!imageDir) continue;
    if (c.hasStandingPicture) {
      promises.push(
        loadCharaImage(
          imageDir,
          createCanvas(),
          imageBase,
          imageSuffixList.concat(sdImageSuffixList),
        ),
      );
    }
    if (!c.hasStandingPicture) {
      promises.push(loadCharaImage(imageDir, createCanvas(), imageBase, sdImageSuffixList));
    }
    //
    const voiceDir = d?.folder('voice');
    if (!voiceDir) continue;
    const voices = voiceList.map((x) => ({
      name: `${x.id}.m4a`,
      res: fetch(`https://ancl.jp/img/game/chara/${c.id}/voice/${x.id}.m4a`),
    }));
    for (const x of voices) {
      const res = await x.res;
      if (res.ok) voiceDir?.file(x.name, res.blob());
    }
  }

  await Promise.all(promises);
};

export const downloadCharacterSkeleton = async (dir: JSZip) => {
  for (const c of charaSkeletons) {
    const charaDir = dir?.folder(c.name);
    const d = charaDir?.folder('skeleton');
    //
    const extensions = ['.atlas', '.json', '.png'];
    for (const e of extensions) {
      const res = await fetch(`${c.path}${e}`);
      if (res.ok) d?.file(`skeleton${e}`, res.blob());
    }
  }
};
