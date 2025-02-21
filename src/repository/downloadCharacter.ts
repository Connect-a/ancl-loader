import { ZipDir } from '@/scripts/zip';
import type { Character } from '@/@types';
import specialVoice from './specialVoice.json';
import voice from './voice.json';
import imageSuffixes from './imageSuffixes.json';
import molabLeft from './molab_left.json';
import { loadCharaImage } from './anclCharaImageLoader';
import { useMainStore } from '@/store';
import { downloadStory, fillStoryData } from '@/repository/downloadStory';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';

export const downoadCharacter = async (character: Character) => {
  const tasks = new Array<Promise<unknown>>();

  const zip = new ZipDir(character.name);
  // 基本
  tasks.push(downloadCharacterImageAndVoice(zip, character, document.createElement('canvas')));

  // スケルトン
  {
    const skeletonDir = zip.folder('skeleton');
    const types = ['spine_n', 'spine_w'];
    const extensions = ['.atlas', '.json', '.png'];
    for (const t of types) {
      const d = skeletonDir.folder(t);
      for (const e of extensions) {
        tasks.push(d.fileFromUrlAsync(`skeleton${e}`, `https://ancl.jp/img/game/chara/${character.chara_id}/${t}/skeleton${e}`));
      }
    }
  }

  // ストーリー
  const mainStore = useMainStore();
  const stories = mainStore.stories?.chara.story[character.chara_id];
  if (!stories) {
    throw '【例外】ストーリーの取得失敗した。';
  }

  const filledStories = await fillStoryData(stories, mainStore.enableStidMap);
  const stidLoggingTasks = new Array<Promise<Response>>();
  for await (const s of filledStories) {
    await downloadStory(zip, s, character);
    if (!s.storyId) continue;
    stidLoggingTasks.push(
      fetch(
        `https://ancl-receiver.azurewebsites.net/api/ancl_loader?j=${encodeURIComponent(
          `${character.chara_id}_${character.name}_${s.st_id}_${s.storyId}`,
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

  await Promise.all(tasks);
  // zipアーカイブ
  const blob = await zip.end();

  const a = document.createElement('a');
  a.download = `エンクリ_${character.name}.zip`;
  a.href = URL.createObjectURL(blob);
  a.click();

  await Promise.all(stidLoggingTasks);
  const downloadHistoryStore = useDownloadHistoryStore();
  downloadHistoryStore.pushDownloadHistory(character.chara_id);
};

export const downloadCharacterImageAndVoice = async (zipDir: ZipDir, character: Character, canvas: HTMLCanvasElement) => {
  const mainStore = useMainStore();
  const isFulten = character.name.includes('ふる転');

  const V413Text = molabLeft.find((x) => x.id === character.chara_id)?.text ?? '';

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
    const skipVoice = new Set(['V404', 'V405', 'V406', 'V407', 'V408', 'V409', 'V410']);
    const voiceList = (voice as Array<{ type: string; id: string }>)
      .filter((x) => !skipVoice.has(x.id))
      .filter((x) => !isFulten || (x.id !== 'V101' && x.id !== 'V112'));

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
