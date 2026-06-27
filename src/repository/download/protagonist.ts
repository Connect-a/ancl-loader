import dayjs from 'dayjs';
import { ZipDir } from '@/scripts/zip';
import { charaImage, charaVoice, charaSpine, SKELETON_EXTS } from '../assetMap';

const CHARA_ID = '000000';
const CHARA_NAME = 'あなた';

// probe実測で存在する範囲のみ。spine_nは存在しない
const GRAPHIC_FILES = ['ss.png', 'gr_t.jpg', 'r.png', 'cr.png', 'sd_ok.png'] as const;
const BATTLE_VOICE_IDS = ['V804', 'V805', 'V806', 'V814', 'V815', 'V816'] as const;

export const buildProtagonistZip = async (): Promise<{ zip: ZipDir; total: number; failed: number }> => {
  const zip = new ZipDir(CHARA_NAME);

  // meta.jsonはローカル書き込みのためDL件数 (total/failed) には含めない
  const metaTask = zip.fileAsync(
    'meta.json',
    JSON.stringify({
      id: CHARA_ID,
      name: CHARA_NAME,
      downloadedAt: dayjs().toISOString(),
      downloaderVersion: __APP_VERSION__,
    }),
  );

  const dlTasks = new Array<Promise<unknown>>();

  const imageDir = zip.folder('image');
  for (const file of GRAPHIC_FILES) {
    dlTasks.push(imageDir.fileFromUrlAsync(file, charaImage.webUrlOf(CHARA_ID, file)));
  }

  const voiceDir = zip.folder('voice');
  for (const id of BATTLE_VOICE_IDS) {
    dlTasks.push(voiceDir.fileFromUrlAsync(`${id}.m4a`, charaVoice.webUrlOf(CHARA_ID, id)));
  }

  const spineDir = zip.folder('skeleton').folder('spine_w');
  for (const ext of SKELETON_EXTS) {
    dlTasks.push(spineDir.fileFromUrlAsync(`skeleton${ext}`, charaSpine.webUrlOf(CHARA_ID, 'spine_w', `skeleton${ext}`)));
  }

  const results = await Promise.all(dlTasks);
  await metaTask;
  const failed = results.filter((r) => r === null).length;
  if (failed === dlTasks.length) throw new Error('すべてのリソース取得に失敗しました');

  return { zip, total: dlTasks.length, failed };
};
