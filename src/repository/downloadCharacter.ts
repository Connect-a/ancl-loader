import JSZip from 'jszip';
import type { Character } from '@/@types';
import specialVoice from './specialVoice.json';
import voice from './voice.json';
import imageSuffixes from './imageSuffixes.json';
import molabLeft from './molab_left.json';
import { loadCharaImage } from './anclCharaImageLoader';
import { useMainStore } from '@/store';

export const downloadCharacter = async (
  dir: JSZip,
  character: Character,
  canvas: HTMLCanvasElement,
) => {
  const mainStore = useMainStore();

  const V413Text =
    (molabLeft as Array<{ id: string; text: string }>).find((x) => x.id === character.chara_id)
      ?.text ?? '';

  dir?.file(
    'meta.json',
    JSON.stringify(
      {
        id: character.chara_id,
        name: character.name,
        msg: character.msg,
        voiceTextMap: V413Text ? { V413: V413Text } : undefined,
        profile: character.profile,
      },
      null,
      '  ',
    ),
  );

  // ボイス
  {
    const voiceList = voice as Array<{ type: string; id: string }>;

    // 戦闘 V801からV823
    for (let i = 1; i <= 23; i++) {
      voiceList.push({ type: '-', id: `V8${String(i).padStart(2, '0')}` });
    }

    // その他 V901からV941
    for (let i = 1; i <= 42; i++) {
      voiceList.push({ type: '-', id: `V9${String(i).padStart(2, '0')}` });
    }

    // 特殊ボイス
    const specialVoices = mainStore.specificVoice ?? [];
    voiceList.push(
      ...specialVoices
        .filter((x) => x.chara_id === character.chara_id)
        .filter((x) => x.voice_id)
        .map((x) => ({ type: '', id: x.voice_id })),
    );
    // 特殊ボイス（手入力）
    const specialVoices2 = specialVoice as Array<{
      chara_id: Array<string>;
      type: string;
      id: Array<string>;
    }>;
    const af = specialVoices2
      .filter((x) => x.chara_id.includes(character.chara_id))
      .flatMap((x) => x.id.map((y) => ({ type: x.type, id: y })));
    voiceList.push(...af);

    // NOTE:重複除去してからfetch
    const voices = [...new Map(voiceList.map((v) => [v.id, v.type])).entries()]
      .filter(([id, _type]) => id)
      .map(([id, _type]) => ({
        name: `${id}.m4a`,
        res: fetch(`https://ancl.jp/img/game/chara/${character.chara_id}/voice/${id}.m4a`),
      }));
    if (voices.length) {
      const voiceDir = dir?.folder('voice');
      for (const x of voices) {
        const d = await x.res;
        if (!d.ok) continue;
        voiceDir?.file(x.name, d.blob());
      }
    }
  }
  // 画像
  const base = `https://ancl.jp/img/game/chara/${character.chara_id}/graphic/${character.chara_id}_`;
  const imageSuffixList = imageSuffixes as Array<string>;
  for (let i = 1; i <= 27; i++) imageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
  for (let i = 51; i <= 57; i++) imageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
  const imageDir = dir?.folder('image');
  await loadCharaImage(imageDir ?? dir, canvas, base, imageSuffixList);
};
