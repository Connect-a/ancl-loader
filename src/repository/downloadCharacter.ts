import { ZipDir } from '@/scripts/zip';
import type { Character } from '@/@types';
import specialVoice from './specialVoice.json';
import voice from './voice.json';
import imageSuffixes from './imageSuffixes.json';
import molabLeft from './molab_left.json';
import { loadCharaImage } from './anclCharaImageLoader';
import { useMainStore } from '@/store';

export const downloadCharacter = async (zipDir: ZipDir, character: Character, canvas: HTMLCanvasElement) => {
  const mainStore = useMainStore();
  const isFulten = character.name.includes('ふる転');

  const V413Text = (molabLeft as Array<{ id: string; text: string }>).find((x) => x.id === character.chara_id)?.text ?? '';

  zipDir.fileAsync(
    'meta.json',
    JSON.stringify({
      id: character.chara_id,
      name: character.name,
      msg: character.msg,
      voiceTextMap: V413Text ? { V413: V413Text } : undefined,
      profile: character.profile,
    }),
  );

  // ボイス
  {
    const voiceList = (voice as Array<{ type: string; id: string }>).filter((x) => !isFulten || (x.id !== 'V101' && x.id !== 'V112'));

    // 総選挙 V404からV406 存在しないキャラあり
    voiceList.push({ type: 'm15', id: 'V404' });

    // 応援 V407からV410 存在しないキャラあり
    voiceList.push({ type: 'm18', id: 'V407' });

    // 戦闘 V801からV822
    for (let i = 1; i <= 22; i++) {
      voiceList.push({ type: '-', id: `V8${String(i).padStart(2, '0')}` });
    }

    // その他 V901からV941
    if (!isFulten) {
      for (let i = 1; i <= 41; i++) {
        voiceList.push({ type: '-', id: `V9${String(i).padStart(2, '0')}` });
      }
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
    const af = specialVoices2.filter((x) => x.chara_id.includes(character.chara_id)).flatMap((x) => x.id.map((y) => ({ type: x.type, id: y })));
    voiceList.push(...af);

    // NOTE:重複除去してからfetch
    const voiceTasks = new Array<Promise<unknown>>();
    const voices = new Set(voiceList.map((v) => v.id).filter((x) => x));
    if (voices.size) {
      const voiceDir = zipDir.folder(`voice`);
      for (const id of voices) {
        const name = `${id}.m4a`;
        voiceTasks.push(voiceDir?.fileFromUrlAsync(name, `https://ancl.jp/img/game/chara/${character.chara_id}/voice/${id}.m4a`));
      }

      await Promise.all(voiceTasks);
      // 総選挙 V405～V406のダウンロードはV404の存在が確認できたら
      if (voiceDir.has('V404.m4a')) {
        for (const id of ['V405', 'V406']) {
          const name = `${id}.m4a`;
          voiceDir?.fileFromUrlAsync(name, `https://ancl.jp/img/game/chara/${character.chara_id}/voice/${id}.m4a`);
        }
      }

      // 応援 V408～V420のダウンロードはV407の存在が確認できたら
      if (voiceDir.has('V407.m4a')) {
        for (const id of ['V408', 'V409', 'V410']) {
          const name = `${id}.m4a`;
          voiceDir?.fileFromUrlAsync(name, `https://ancl.jp/img/game/chara/${character.chara_id}/voice/${id}.m4a`);
        }
      }
    }
  }
  // 画像
  const base = `https://ancl.jp/img/game/chara/${character.chara_id}/graphic/${character.chara_id}_`;
  const imageSuffixList = imageSuffixes as Array<string>;
  for (let i = 1; i <= 7; i++) imageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
  if (!isFulten) imageSuffixList.push(`sd_${String(8).padStart(2, '0')}.png`);
  for (let i = 9; i <= 22; i++) imageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
  imageSuffixList.push(`sd_${String(23).padStart(2, '0')}.png`);
  for (let i = 51; i <= 56; i++) imageSuffixList.push(`sd_${String(i).padStart(2, '0')}.png`);
  const imageDir = zipDir?.folder('image');
  await loadCharaImage(imageDir ?? zipDir, canvas, base, imageSuffixList);
  // sd_24～sd_26のダウンロードはsd_23の存在が確認できたら。
  if (imageDir.has('sd_23.png')) await loadCharaImage(imageDir ?? zipDir, undefined, base, ['sd_24.png']);
  if (imageDir.has('sd_24.png')) await loadCharaImage(imageDir ?? zipDir, undefined, base, ['sd_25.png']);
  if (imageDir.has('sd_25.png')) await loadCharaImage(imageDir ?? zipDir, undefined, base, ['sd_26.png']);
};
